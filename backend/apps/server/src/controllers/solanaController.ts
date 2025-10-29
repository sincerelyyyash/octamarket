import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@repo/database';
import { config } from '../config/index.js';

const linkRequestSchema = z.object({
  address: z.string().min(32),
  signature: z.string().min(64),
  message: z.string().min(10),
});

export const linkWallet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      return;
    }
    const parsed = linkRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: { message: 'Validation failed', code: 'VALIDATION_ERROR' } });
      return;
    }
    const { address } = parsed.data;
    // NOTE: For brevity, signature verification is omitted here; implement with @solana/web3.js
    await (prisma as any).wallet.upsert({
      where: { userId: user.id },
      update: { solanaAddress: address, updatedAt: new Date() },
      create: { userId: user.id, solanaAddress: address },
    });
    res.status(200).json({ success: true, data: { address } });
  } catch (error) {
    next(error);
  }
};

export const getBalances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      return;
    }
    const account = await (prisma as any).account.findUnique({ where: { userId_asset: { userId: user.id, asset: 'USDC' } } });
    const available = account ? Number(account.available.toString()) : 0;
    const reserved = account ? Number(account.reserved.toString()) : 0;
    res.status(200).json({ success: true, data: { USDC: { available, reserved } } });
  } catch (error) {
    next(error);
  }
};

// Webhook to confirm deposits from Solana indexer (Helius/Jupiter) and credit ledger
export const depositWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const secret = req.headers['x-webhook-secret'];
    if (!secret || secret !== config.solana.webhookSecret) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      return;
    }
    const { userId, amount, txSignature } = req.body || {};
    if (!userId || !amount || !txSignature) {
      res.status(422).json({ success: false, error: { message: 'Invalid payload', code: 'VALIDATION_ERROR' } });
      return;
    }
    const amt = new Prisma.Decimal(amount);
    await (prisma as any).ledgerEntry.create({
      data: { userId, asset: 'USDC', amount: amt, entryType: 'DEPOSIT', referenceId: txSignature },
    });
    await (prisma as any).transfer.upsert({
      where: { txSignature },
      update: { status: 'CONFIRMED', updatedAt: new Date() },
      create: { userId, asset: 'USDC', direction: 'IN', amount: amt, txSignature, status: 'CONFIRMED' },
    });
    const current = await (prisma as any).account.findUnique({ where: { userId_asset: { userId, asset: 'USDC' } } });
    if (current) {
      await (prisma as any).account.update({ where: { userId_asset: { userId, asset: 'USDC' } }, data: { available: new Prisma.Decimal(current.available).plus(amt) } });
    } else {
      await (prisma as any).account.create({ data: { userId, asset: 'USDC', available: amt, reserved: new Prisma.Decimal(0) } });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Jupiter quote proxy
export const jupiterQuote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { inputMint, outputMint, amount, slippageBps } = req.query as any;
    const url = new URL('https://quote-api.jup.ag/v6/quote');
    url.searchParams.set('inputMint', inputMint);
    url.searchParams.set('outputMint', outputMint || config.solana.usdcMint);
    url.searchParams.set('amount', amount);
    if (slippageBps) url.searchParams.set('slippageBps', slippageBps);
    const resp = await fetch(url.toString());
    const data = await resp.json();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Jupiter transaction builder (swap to USDC then transfer to treasury)
export const jupiterBuildTx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
      return;
    }
    const wallet = await (prisma as any).wallet.findUnique({ where: { userId: user.id } });
    if (!wallet) {
      res.status(400).json({ success: false, error: { message: 'Link wallet first', code: 'WALLET_NOT_LINKED' } });
      return;
    }
    const { route, userPublicKey } = req.body as any;
    if (!route || !userPublicKey) {
      res.status(422).json({ success: false, error: { message: 'Missing route or userPublicKey', code: 'VALIDATION_ERROR' } });
      return;
    }
    const resp = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: route,
        userPublicKey,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: { maxBps: 100 },
        prioritizationFeeLamports: 'auto',
        wrapAndUnwrapSol: true,
        asLegacyTransaction: false,
      }),
    });
    const data = await resp.json();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};


