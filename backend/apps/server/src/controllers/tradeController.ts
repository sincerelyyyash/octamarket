import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@repo/database';
import { redis } from '../utils/redis.js';
import { config } from '../config/index.js';

const streamKey: string = (config as any)?.queue?.tradeIntentsStream || 'trades.intents';

const createTradeSchema = z.object({
  intentId: z.string().min(8),
  source: z.enum(['POLYMARKET', 'KALSHI']),
  sourceMarketId: z.string().min(1),
  marketId: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  outcomeIndex: z.number().int().optional(),
  quantity: z.number().positive(),
  limitPrice: z.number().positive().max(1).optional(),
  followerContext: z.object({
    originalTradeId: z.string().optional(),
    followingId: z.string().optional(),
  }).optional(),
});

const getOrCreateUsdcAccount = async (userId: string) => {
  const existing = await (prisma as any).account.findUnique({ where: { userId_asset: { userId, asset: 'USDC' } } });
  if (existing) return existing;
  return (prisma as any).account.create({ data: { userId, asset: 'USDC', available: new Prisma.Decimal(0), reserved: new Prisma.Decimal(0) } });
};

const reserveFunds = async (userId: string, notional: number) => {
  return (prisma as any).$transaction(async (tx: any) => {
    const acc = await tx.account.upsert({
      where: { userId_asset: { userId, asset: 'USDC' } },
      update: {},
      create: { userId, asset: 'USDC', available: new Prisma.Decimal(0), reserved: new Prisma.Decimal(0) },
    });
    const available = new Prisma.Decimal(acc.available);
    const need = new Prisma.Decimal(notional);
    if (available.lessThan(need)) {
      throw new Error('INSUFFICIENT_FUNDS');
    }
    const newAvail = available.minus(need);
    const newRes = new Prisma.Decimal(acc.reserved).plus(need);
    await tx.account.update({ where: { userId_asset: { userId, asset: 'USDC' } }, data: { available: newAvail, reserved: newRes } });
    await tx.ledgerEntry.create({ data: { userId, asset: 'USDC', amount: need.negated(), entryType: 'RESERVATION', referenceId: undefined } });
    return true;
  });
};

export const validateCreateTrade = (req: Request, res: Response, next: NextFunction): void => {
  const parsed = createTradeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.errors.map(err => ({ field: err.path.join('.'), message: err.message })),
      },
    });
    return;
  }
  (req as any).validatedBody = parsed.data;
  next();
};

export const createTrade = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      return;
    }

    const {
      intentId, source, sourceMarketId, marketId, side, outcomeIndex, quantity, limitPrice, followerContext,
    } = (req as any).validatedBody as z.infer<typeof createTradeSchema>;

    // Ensure account exists
    await getOrCreateUsdcAccount(user.id);

    // Compute worst-case notional to reserve (price if provided else 1.0)
    const price = typeof limitPrice === 'number' ? limitPrice : 1.0;
    const feeBuffer = 0.01; // 1% buffer
    const notional = quantity * price * (1 + feeBuffer);

    // Reserve funds for BUY only; SELL may be collateralized differently, keep simple for now
    if (side === 'BUY') {
      try {
        await reserveFunds(user.id, notional);
      } catch (e: any) {
        if (e.message === 'INSUFFICIENT_FUNDS') {
          res.status(402).json({ success: false, error: { message: 'Insufficient funds', code: 'INSUFFICIENT_FUNDS' } });
          return;
        }
        throw e;
      }
    }

    const idempotencyKey = req.header('Idempotency-Key') || intentId;
    const idempKey = `trade:intent:idemp:${idempotencyKey}`;
    const ok = await redis.getClient().set(idempKey, '1', 'NX', 'EX', 60);
    if (!ok) {
      res.status(409).json({ success: false, error: { message: 'Duplicate trade intent', code: 'DUPLICATE' } });
      return;
    }

    await (prisma as any).tradeIntent.upsert({
      where: { intentId },
      update: {
        status: 'SUBMITTED' as any,
        submittedAt: new Date(),
        limitPrice: limitPrice != null ? new Prisma.Decimal(limitPrice) : undefined,
        updatedAt: new Date(),
      },
      create: {
        intentId,
        userId: user.id,
        traderId: null,
        followingId: followerContext?.followingId || null,
        source: source as any,
        marketId,
        sourceMarketId,
        side: side as any,
        outcomeIndex: outcomeIndex ?? null,
        quantity: new Prisma.Decimal(quantity),
        limitPrice: limitPrice != null ? new Prisma.Decimal(limitPrice) : null,
        status: 'SUBMITTED' as any,
        submittedAt: new Date(),
      },
    });

    const fields: (string | number)[] = [
      'intentId', intentId,
      'idempotencyKey', idempotencyKey,
      'userId', user.id,
      'source', source,
      'sourceMarketId', sourceMarketId,
      'marketId', marketId,
      'side', side,
      'quantity', String(quantity),
    ];
    if (outcomeIndex != null) fields.push('outcomeIndex', String(outcomeIndex));
    if (limitPrice != null) fields.push('limitPrice', String(limitPrice));
    if (followerContext?.followingId) fields.push('followingId', followerContext.followingId);
    if (followerContext?.originalTradeId) fields.push('originalTradeId', followerContext.originalTradeId);

    const msgId = await redis.getClient().xadd(streamKey, '*', ...fields);

    res.status(202).json({ success: true, data: { intentId, enqueuedId: msgId } });
  } catch (error) {
    next(error);
  }
};

export const getTradeStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { intentId } = req.params as { intentId: string };
    const intent = await (prisma as any).tradeIntent.findUnique({ where: { intentId } });
    if (!intent) {
      res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
      return;
    }
    res.status(200).json({ success: true, data: intent });
  } catch (error) {
    next(error);
  }
};

export const listRecentTrades = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      return;
    }
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '20')));
    const items = await (prisma as any).tradeIntent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

export const streamTradeStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { intentId } = req.params as { intentId: string };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const existing = await (prisma as any).tradeIntent.findUnique({ where: { intentId } });
    if (existing) {
      res.write(`event: snapshot\ndata: ${JSON.stringify(existing)}\n\n`);
    }

    // Create a new Redis subscriber client
    const Redis = require('ioredis');
    const sub = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      enableReadyCheck: config.redis.enableReadyCheck,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
    });
    
    const channel = `trades.intent.${intentId}`;
    await sub.subscribe(channel);
    
    const onMessage = (_ch: string, message: string) => {
      res.write(`event: update\ndata: ${message}\n\n`);
    };
    sub.on('message', onMessage);

    req.on('close', async () => {
      try {
        sub.removeListener('message', onMessage);
        await sub.unsubscribe(channel);
        await sub.disconnect();
      } catch {}
      res.end();
    });
  } catch (error) {
    next(error);
  }
};


