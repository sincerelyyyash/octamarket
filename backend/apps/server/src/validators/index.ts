import { z } from 'zod';
import { MarketSource, MarketStatus } from '@repo/database';

// Common schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idSchema = z.object({
  id: z.string().cuid(),
});

// Market schemas
export const marketFiltersSchema = z.object({
  status: z.nativeEnum(MarketStatus).optional(),
  category: z.string().optional(),
  source: z.nativeEnum(MarketSource).optional(),
  tags: z.string().optional().transform(val => val ? val.split(',') : undefined),
  search: z.string().optional(),
  sortBy: z.enum(['volume', 'liquidity', 'endDate', 'createdAt', 'participantCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const marketQuerySchema = paginationSchema.merge(marketFiltersSchema);

// Trader schemas
export const traderFiltersSchema = z.object({
  source: z.nativeEnum(MarketSource).optional(),
  allowCopyTrading: z.coerce.boolean().optional(),
  isPublic: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['totalPnl', 'totalVolume', 'winRate', 'totalTrades', 'currentRank']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const traderQuerySchema = paginationSchema.merge(traderFiltersSchema);

// Leaderboard schemas
export const leaderboardFiltersSchema = z.object({
  source: z.nativeEnum(MarketSource).optional(),
  timeframe: z.enum(['day', 'week', 'month', 'all']).optional().default('all'),
  sortBy: z.enum(['totalPnl', 'totalVolume', 'winRate']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const leaderboardQuerySchema = paginationSchema.merge(leaderboardFiltersSchema);

// Auth schemas
export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

// Copy trading schemas
export const copyTradingSettingsSchema = z.object({
  autoCopyTrades: z.boolean(),
  maxCopyAmount: z.number().positive().optional(),
  copyPercentage: z.number().min(0).max(1).optional(),
});

export const followTraderSchema = z.object({
  traderId: z.string().cuid(),
  settings: copyTradingSettingsSchema.optional(),
});

export const updateFollowSettingsSchema = copyTradingSettingsSchema;

// Price history schema
export const priceHistoryQuerySchema = z.object({
  outcomeId: z.string().optional(),
  source: z.nativeEnum(MarketSource).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

// Stats schemas
export const statsQuerySchema = z.object({
  timeframe: z.enum(['day', 'week', 'month', 'all']).optional().default('all'),
  source: z.nativeEnum(MarketSource).optional(),
});

// Trade schemas
export const tradeQuerySchema = z.object({
  marketId: z.string().cuid().optional(),
  source: z.nativeEnum(MarketSource).optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
  status: z.enum(['PENDING', 'EXECUTED', 'CANCELLED', 'FAILED']).optional(),
  isCopyTrade: z.coerce.boolean().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).merge(paginationSchema);

// Export all schemas
export const schemas = {
  pagination: paginationSchema,
  id: idSchema,
  marketFilters: marketFiltersSchema,
  marketQuery: marketQuerySchema,
  traderFilters: traderFiltersSchema,
  traderQuery: traderQuerySchema,
  leaderboardFilters: leaderboardFiltersSchema,
  leaderboardQuery: leaderboardQuerySchema,
  register: registerSchema,
  login: loginSchema,
  updateProfile: updateProfileSchema,
  copyTradingSettings: copyTradingSettingsSchema,
  followTrader: followTraderSchema,
  updateFollowSettings: updateFollowSettingsSchema,
  priceHistoryQuery: priceHistoryQuerySchema,
  statsQuery: statsQuerySchema,
  tradeQuery: tradeQuerySchema,
} as const;
