import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { prisma, Prisma } from '@repo/database';
import { redis } from '../utils/redis.js';

const router: ReturnType<typeof Router> = Router();

// Simple bearer token auth for internal endpoints (optional)
router.use((req, res, next) => {
  const token = config.server.internalToken;
  if (!token) {
    return next();
  }
  const auth = req.headers.authorization || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (provided === token) {
    return next();
  }
  return res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
});

// POST /internal/trades/:intentId/state
router.post('/trades/:intentId/state', async (req, res) => {
  const { intentId } = req.params as { intentId: string };
  const { state, venue, orderId, avgPrice, fills, reason, error, price } = req.body || {};

  const validStates = new Set(['SUBMITTED', 'FILLED', 'FAILED']);
  if (!validStates.has(state)) {
    return res.status(422).json({
      success: false,
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: [{ field: 'state', message: 'Invalid state' }] },
    });
  }

  // Persist state to TradeIntent and publish SSE notification
  const updateData: any = {
    status: state,
    venue: venue ?? undefined,
    orderId: orderId ?? undefined,
    avgPrice: avgPrice != null ? new Prisma.Decimal(avgPrice) : (price != null ? new Prisma.Decimal(price) : undefined),
    fills: fills ?? undefined,
    reason: reason ?? undefined,
    error: error ?? undefined,
    updatedAt: new Date(),
  };
  if (state === 'SUBMITTED') updateData.submittedAt = new Date();
  if (state === 'FILLED') updateData.filledAt = new Date();
  if (state === 'FAILED') updateData.failedAt = new Date();

  const intent = await (prisma as any).tradeIntent.upsert({
    where: { intentId },
    update: updateData,
    create: {
      intentId,
      source: 'POLYMARKET',
      sourceMarketId: 'unknown',
      side: 'BUY',
      quantity: new Prisma.Decimal(0),
      status: state,
      submittedAt: state === 'SUBMITTED' ? new Date() : null,
    } as any,
  });

  if (state === 'FILLED' && intent.marketId) {
    await (prisma as any).marketEvent.create({
      data: {
        marketId: intent.marketId,
        source: intent.source,
        eventType: 'TRADE_EXECUTED',
        data: { intentId, venue, orderId, avgPrice: updateData.avgPrice ? Number(updateData.avgPrice.toString()) : undefined, fills },
        rawPayload: req.body,
      },
    });
  }

  // Ledger settlement/release for reserved funds (BUY intents only)
  try {
    if (intent.userId && intent.side === 'BUY') {
      // Get reserved notional from intent quantity * avgPrice (or price)
      const priceNum = updateData.avgPrice ? Number(updateData.avgPrice.toString()) : (price != null ? Number(price) : undefined);
      const qtyNum = intent.quantity ? Number(intent.quantity.toString()) : undefined;
      if (priceNum && qtyNum) {
        const notional = new Prisma.Decimal(qtyNum * priceNum);
        const acc = await (prisma as any).account.findUnique({ where: { userId_asset: { userId: intent.userId, asset: 'USDC' } } });
        if (acc) {
          const reserved = new Prisma.Decimal(acc.reserved);
          const available = new Prisma.Decimal(acc.available);
          if (state === 'FILLED') {
            // Convert reservation to settlement: decrease reserved by notional; available unchanged
          const newRes = Prisma.Decimal.max(reserved.minus(notional), new Prisma.Decimal(0));
            await (prisma as any).account.update({ where: { userId_asset: { userId: intent.userId, asset: 'USDC' } }, data: { reserved: newRes } });
            await (prisma as any).ledgerEntry.create({ data: { userId: intent.userId, asset: 'USDC', amount: notional.negated(), entryType: 'TRADE_SETTLEMENT', referenceId: intent.intentId } });
          }
          if (state === 'FAILED') {
            // Release reservation back to available
            const newRes = Prisma.Decimal.max(reserved.minus(notional), new Prisma.Decimal(0));
            const newAvail = available.plus(notional);
            await (prisma as any).account.update({ where: { userId_asset: { userId: intent.userId, asset: 'USDC' } }, data: { reserved: newRes, available: newAvail } });
            await (prisma as any).ledgerEntry.create({ data: { userId: intent.userId, asset: 'USDC', amount: notional, entryType: 'RELEASE', referenceId: intent.intentId } });
          }
        }
      }
    }
  } catch {}

  await redis.getClient().publish(`trades.intent.${intentId}`, JSON.stringify({
    intentId,
    state,
    venue,
    orderId,
    avgPrice: updateData.avgPrice ? Number(updateData.avgPrice.toString()) : undefined,
    fills,
    reason,
    error,
    at: new Date().toISOString(),
  }));

  return res.status(200).json({ success: true, data: { intentId, state } });
});

export default router;


