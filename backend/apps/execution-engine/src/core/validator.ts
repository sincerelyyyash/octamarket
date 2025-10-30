import { z } from 'zod';

export const intentSchema = z.object({
  intentId: z.string().min(1),
  userId: z.string().min(1),
  marketId: z.string().min(1),
  userWallet: z.string().optional(), // Solana wallet address for on-chain settlement
  sourceAllowlist: z.array(z.enum(['POLYMARKET', 'KALSHI'])).optional(),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  constraints: z
    .object({ maxPrice: z.number().optional(), maxSlippage: z.number().optional() })
    .optional(),
  outcomeIndex: z.number().int().nonnegative().optional(),
  copyOfTradeId: z.string().optional(),
  idempotencyKey: z.string().min(1),
  clientMeta: z.record(z.any()).optional(),
  createdAt: z.string().optional(),
});

export type TradeIntent = z.infer<typeof intentSchema>;


