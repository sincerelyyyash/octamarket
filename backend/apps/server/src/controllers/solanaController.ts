import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@repo/database';
import { config } from '../config/index.js';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { OctamarketClient, encodeIntentId, encodeMarketId } from '@repo/solana-program';
import type { SIWSRequest } from '../middleware/siws.js';

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

// ===== On-Chain Program Transaction Builders =====

// Helper to get Solana client
const getSolanaClient = (): OctamarketClient => {
  const connection = new Connection(config.solana.rpcUrl, 'confirmed');
  // Dummy wallet for read-only operations
  const wallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: Transaction) => tx,
    signAllTransactions: async (txs: Transaction[]) => txs,
  };
  return OctamarketClient.create(connection, wallet);
};

const initUserSchema = z.object({
  kycHash: z.string().optional(),
});

export const buildInitUser = async (req: SIWSRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.solanaWallet) {
      res.status(401).json({ success: false, error: { message: 'Solana wallet not authenticated', code: 'UNAUTHORIZED' } });
      return;
    }

    const parsed = initUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: { message: 'Validation failed', code: 'VALIDATION_ERROR' } });
      return;
    }

    const { kycHash } = parsed.data;
    const client = getSolanaClient();
    const owner = req.solanaWallet.publicKey;
    
    const kycHashBytes = kycHash ? Buffer.from(kycHash, 'hex') : undefined;
    const tx = await client.initUser(owner, kycHashBytes);
    
    const { blockhash, lastValidBlockHeight } = await client.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = owner;

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const base64 = serialized.toString('base64');

    res.status(200).json({
      success: true,
      data: {
        unsignedTxBase64: base64,
        userPda: client.getUserPDA(owner)[0].toBase58(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const openIntentSchema = z.object({
  intentId: z.string().uuid(),
  marketId: z.string().min(1),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  maxPrice: z.number().positive().max(1),
  expiry: z.number().int().positive(),
});

export const buildOpenIntent = async (req: SIWSRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.solanaWallet) {
      res.status(401).json({ success: false, error: { message: 'Solana wallet not authenticated', code: 'UNAUTHORIZED' } });
      return;
    }

    const parsed = openIntentSchema.safeParse(req.body);
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

    const { intentId, marketId, side, quantity, maxPrice, expiry } = parsed.data;
    const client = getSolanaClient();
    const owner = req.solanaWallet.publicKey;
    const usdcMint = new PublicKey(config.solana.usdcMint);

    const intentIdBuf = encodeIntentId(intentId);
    const marketIdBuf = encodeMarketId(marketId);
    const sideEnum = side === 'BUY' ? { buy: {} } : { sell: {} };
    
    // Scale price by 1e6; quantity is in contracts (unscaled)
    const quantityContracts = Math.floor(quantity);
    const maxPriceLamports = Math.floor(maxPrice * 1_000_000);

    const tx = await client.openIntent(
      owner,
      intentIdBuf,
      marketIdBuf,
      sideEnum,
      quantityContracts,
      maxPriceLamports,
      expiry,
      usdcMint
    );

    const { blockhash, lastValidBlockHeight } = await client.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = owner;

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const base64 = serialized.toString('base64');

    const [userPda] = client.getUserPDA(owner);
    const [intentPda] = client.getIntentPDA(userPda, intentIdBuf);

    res.status(200).json({
      success: true,
      data: {
        unsignedTxBase64: base64,
        intentId,
        intentPda: intentPda.toBase58(),
        userPda: userPda.toBase58(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const cancelIntentSchema = z.object({
  intentId: z.string().uuid(),
});

export const buildCancelIntent = async (req: SIWSRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.solanaWallet) {
      res.status(401).json({ success: false, error: { message: 'Solana wallet not authenticated', code: 'UNAUTHORIZED' } });
      return;
    }

    const parsed = cancelIntentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: { message: 'Validation failed', code: 'VALIDATION_ERROR' } });
      return;
    }

    const { intentId } = parsed.data;
    const client = getSolanaClient();
    const owner = req.solanaWallet.publicKey;
    const usdcMint = new PublicKey(config.solana.usdcMint);

    const intentIdBuf = encodeIntentId(intentId);
    const tx = await client.cancelIntent(owner, intentIdBuf, usdcMint);

    const { blockhash, lastValidBlockHeight } = await client.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = owner;

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const base64 = serialized.toString('base64');

    res.status(200).json({
      success: true,
      data: {
        unsignedTxBase64: base64,
        intentId,
      },
    });
  } catch (error) {
    next(error);
  }
};

const setCopyPolicySchema = z.object({
  copyPercentage: z.number().int().min(0).max(100),
  maxCopyAmount: z.number().positive(),
  maxDailyAmount: z.number().positive(),
  expiry: z.number().int().positive(),
});

export const buildSetCopyPolicy = async (req: SIWSRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.solanaWallet) {
      res.status(401).json({ success: false, error: { message: 'Solana wallet not authenticated', code: 'UNAUTHORIZED' } });
      return;
    }

    const parsed = setCopyPolicySchema.safeParse(req.body);
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

    const { copyPercentage, maxCopyAmount, maxDailyAmount, expiry } = parsed.data;
    const client = getSolanaClient();
    const owner = req.solanaWallet.publicKey;

    // Convert to lamports
    const maxCopyAmountLamports = Math.floor(maxCopyAmount * 1_000_000);
    const maxDailyAmountLamports = Math.floor(maxDailyAmount * 1_000_000);

    const tx = await client.setCopyPolicy(
      owner,
      copyPercentage,
      maxCopyAmountLamports,
      maxDailyAmountLamports,
      expiry
    );

    const { blockhash, lastValidBlockHeight } = await client.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = owner;

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const base64 = serialized.toString('base64');

    const [copyPolicyPda] = client.getCopyPolicyPDA(owner);

    res.status(200).json({
      success: true,
      data: {
        unsignedTxBase64: base64,
        copyPolicyPda: copyPolicyPda.toBase58(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const fundEscrowSchema = z.object({
  amount: z.number().positive(),
});

export const buildFundEscrow = async (req: SIWSRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.solanaWallet) {
      res.status(401).json({ success: false, error: { message: 'Solana wallet not authenticated', code: 'UNAUTHORIZED' } });
      return;
    }

    const parsed = fundEscrowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: { message: 'Validation failed', code: 'VALIDATION_ERROR' } });
      return;
    }

    const { amount } = parsed.data;
    const client = getSolanaClient();
    const owner = req.solanaWallet.publicKey;
    const usdcMint = new PublicKey(config.solana.usdcMint);

    // Convert to lamports
    const amountLamports = Math.floor(amount * 1_000_000);

    const tx = await client.fundEscrow(owner, amountLamports, usdcMint);

    const { blockhash, lastValidBlockHeight } = await client.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = owner;

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const base64 = serialized.toString('base64');

    const [userPda] = client.getUserPDA(owner);
    const [vaultPda] = client.getVaultPDA(userPda);

    res.status(200).json({
      success: true,
      data: {
        unsignedTxBase64: base64,
        vaultPda: vaultPda.toBase58(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const withdrawEscrowSchema = z.object({
  amount: z.number().positive(),
});

export const buildWithdrawEscrow = async (req: SIWSRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.solanaWallet) {
      res.status(401).json({ success: false, error: { message: 'Solana wallet not authenticated', code: 'UNAUTHORIZED' } });
      return;
    }

    const parsed = withdrawEscrowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: { message: 'Validation failed', code: 'VALIDATION_ERROR' } });
      return;
    }

    const { amount } = parsed.data;
    const client = getSolanaClient();
    const owner = req.solanaWallet.publicKey;
    const usdcMint = new PublicKey(config.solana.usdcMint);

    // Convert to lamports
    const amountLamports = Math.floor(amount * 1_000_000);

    const tx = await client.withdrawEscrow(owner, amountLamports, usdcMint);

    const { blockhash, lastValidBlockHeight } = await client.provider.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = owner;

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const base64 = serialized.toString('base64');

    res.status(200).json({
      success: true,
      data: {
        unsignedTxBase64: base64,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getVaultBalance = async (req: SIWSRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.solanaWallet) {
      res.status(401).json({ success: false, error: { message: 'Solana wallet not authenticated', code: 'UNAUTHORIZED' } });
      return;
    }

    const client = getSolanaClient();
    const owner = req.solanaWallet.publicKey;
    const [userPda] = client.getUserPDA(owner);
    const [vaultPda] = client.getVaultPDA(userPda);

    const balance = await client.getVaultBalance(userPda);
    
    // Convert from lamports to USDC
    const balanceUsdc = balance / 1_000_000;

    res.status(200).json({
      success: true,
      data: {
        balance: balanceUsdc,
        vaultPda: vaultPda.toBase58(),
      },
    });
  } catch (error) {
    next(error);
  }
};
