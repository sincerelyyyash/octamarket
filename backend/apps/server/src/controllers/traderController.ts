import { Request, Response, NextFunction } from 'express';
import { prisma } from '@repo/database';
import { MarketSource } from '@repo/database';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

// Validation schemas
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const traderFiltersSchema = z.object({
  source: z.nativeEnum(MarketSource).optional(),
  allowCopyTrading: z.coerce.boolean().optional(),
  isPublic: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['totalPnl', 'totalVolume', 'winRate', 'totalTrades', 'currentRank']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const traderQuerySchema = paginationSchema.merge(traderFiltersSchema);

const idSchema = z.object({
  id: z.string().cuid(),
});

const tradeQuerySchema = z.object({
  marketId: z.string().cuid().optional(),
  source: z.nativeEnum(MarketSource).optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
  status: z.enum(['PENDING', 'EXECUTED', 'CANCELLED', 'FAILED']).optional(),
  isCopyTrade: z.coerce.boolean().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).merge(paginationSchema);

// Validation middleware
export const validateTraderQuery = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsedQuery = traderQuerySchema.parse(req.query);
    (req as any).parsedQuery = parsedQuery;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
      });
      return;
    }
    next(error);
  }
};

export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsedQuery = paginationSchema.parse(req.query);
    // Store parsed query in a custom property
    (req as any).parsedQuery = parsedQuery;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
      });
      return;
    }
    next(error);
  }
};

export const validateId = (req: Request, res: Response, next: NextFunction): void => {
  try {
    req.params = idSchema.parse(req.params);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
      });
      return;
    }
    next(error);
  }
};

export const validateTradeQuery = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsedQuery = tradeQuerySchema.parse(req.query);
    // Store parsed query in a custom property
    (req as any).parsedQuery = parsedQuery;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
      });
      return;
    }
    next(error);
  }
};

// Helper functions
const parseQuery = (req: Request): { page: number; limit: number; offset: number } => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const createMeta = (page: number, limit: number, total: number) => {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
};

const formatTraderResponse = (trader: any) => ({
  id: trader.id,
  source: trader.source,
  sourceTraderId: trader.sourceTraderId,
  username: trader.username || undefined,
  displayName: trader.displayName || undefined,
  profileImageUrl: trader.profileImageUrl || undefined,
  totalTrades: trader.totalTrades,
  totalVolume: parseFloat(trader.totalVolume.toString()),
  totalPnl: parseFloat(trader.totalPnl.toString()),
  winRate: trader.winRate ? parseFloat(trader.winRate.toString()) : undefined,
  avgReturn: trader.avgReturn ? parseFloat(trader.avgReturn.toString()) : undefined,
  currentRank: trader.currentRank || undefined,
  bestRank: trader.bestRank || undefined,
  rankChange: trader.rankChange || undefined,
  lastActiveAt: trader.lastActiveAt?.toISOString(),
  firstTradeAt: trader.firstTradeAt?.toISOString(),
  lastTradeAt: trader.lastTradeAt?.toISOString(),
  isPublic: trader.isPublic,
  allowCopyTrading: trader.allowCopyTrading,
  maxFollowers: trader.maxFollowers || undefined,
});

const formatTradeResponse = (trade: any) => ({
  id: trade.id,
  traderId: trade.traderId,
  source: trade.source,
  sourceTradeId: trade.sourceTradeId,
  marketId: trade.marketId || undefined,
  sourceMarketId: trade.sourceMarketId,
  side: trade.side as 'BUY' | 'SELL',
  outcomeIndex: trade.outcomeIndex || undefined,
  quantity: parseFloat(trade.quantity.toString()),
  price: parseFloat(trade.price.toString()),
  totalValue: parseFloat(trade.totalValue.toString()),
  status: trade.status as 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED',
  executedAt: trade.executedAt.toISOString(),
  realizedPnl: trade.realizedPnl ? parseFloat(trade.realizedPnl.toString()) : undefined,
  unrealizedPnl: trade.unrealizedPnl ? parseFloat(trade.unrealizedPnl.toString()) : undefined,
  isCopyTrade: trade.isCopyTrade,
  originalTradeId: trade.originalTradeId || undefined,
  copiedByTraderId: trade.copiedByTraderId || undefined,
});

// Controller functions
export const getTraders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);
    const filters = (req as any).parsedQuery || req.query;

    const where: any = {
      isPublic: true,
    };

    // Apply filters
    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.allowCopyTrading !== undefined) {
      where.allowCopyTrading = filters.allowCopyTrading;
    }

    if (filters.isPublic !== undefined) {
      where.isPublic = filters.isPublic;
    }

    if (filters.search) {
      where.OR = [
        { username: { contains: filters.search, mode: 'insensitive' } },
        { displayName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'totalPnl':
          orderBy.totalPnl = filters.sortOrder || 'desc';
          break;
        case 'totalVolume':
          orderBy.totalVolume = filters.sortOrder || 'desc';
          break;
        case 'winRate':
          orderBy.winRate = filters.sortOrder || 'desc';
          break;
        case 'totalTrades':
          orderBy.totalTrades = filters.sortOrder || 'desc';
          break;
        case 'currentRank':
          orderBy.currentRank = filters.sortOrder || 'asc';
          break;
        default:
          orderBy.totalPnl = 'desc';
          break;
      }
    } else {
      orderBy.totalPnl = 'desc';
    }

    const [traders, total] = await Promise.all([
      prisma.trader.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.trader.count({ where }),
    ]);

    const traderResponses = traders.map(formatTraderResponse);
    const meta = createMeta(page, limit, total);

    logger.info('Traders retrieved', { count: traderResponses.length, total, filters });

    res.status(200).json({
      success: true,
      data: traderResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get traders', {
      filters: req.query,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getTraderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const trader = await prisma.trader.findUnique({
      where: { id },
    });

    if (!trader) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Trader not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    const traderResponse = formatTraderResponse(trader);

    logger.info('Trader retrieved', { id });

    res.status(200).json({
      success: true,
      data: traderResponse,
    });
  } catch (error) {
    logger.error('Failed to get trader by ID', {
      id: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getTraderStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const trader = await prisma.trader.findUnique({
      where: { id },
      select: {
        id: true,
        totalTrades: true,
        totalVolume: true,
        totalPnl: true,
        winRate: true,
        avgReturn: true,
        currentRank: true,
        bestRank: true,
        rankChange: true,
        lastActiveAt: true,
        firstTradeAt: true,
        lastTradeAt: true,
      },
    });

    if (!trader) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Trader not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    // Get additional stats
    const [tradeStats, followerCount, followingCount] = await Promise.all([
      prisma.trade.aggregate({
        where: { traderId: id },
        _sum: {
          totalValue: true,
          realizedPnl: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.traderFollow.count({
        where: { followingId: id },
      }),
      prisma.traderFollow.count({
        where: { followerId: id },
      }),
    ]);

    const stats = {
      trader: {
        id: trader.id,
        totalTrades: trader.totalTrades,
        totalVolume: parseFloat(trader.totalVolume.toString()),
        totalPnl: parseFloat(trader.totalPnl.toString()),
        winRate: trader.winRate ? parseFloat(trader.winRate.toString()) : undefined,
        avgReturn: trader.avgReturn ? parseFloat(trader.avgReturn.toString()) : undefined,
        currentRank: trader.currentRank || undefined,
        bestRank: trader.bestRank || undefined,
        rankChange: trader.rankChange || undefined,
        lastActiveAt: trader.lastActiveAt?.toISOString(),
        firstTradeAt: trader.firstTradeAt?.toISOString(),
        lastTradeAt: trader.lastTradeAt?.toISOString(),
      },
      additionalStats: {
        totalTradeValue: tradeStats._sum.totalValue ? parseFloat(tradeStats._sum.totalValue.toString()) : 0,
        totalRealizedPnl: tradeStats._sum.realizedPnl ? parseFloat(tradeStats._sum.realizedPnl.toString()) : 0,
        totalTradeCount: tradeStats._count.id,
        followerCount,
        followingCount,
      },
    };

    logger.info('Trader stats retrieved', { id });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get trader stats', {
      id: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getTraderTrades = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { page, limit, offset } = parseQuery(req);
    const filters = (req as any).parsedQuery || req.query;

    const where: any = {
      traderId: id,
    };

    // Apply filters
    if (filters.marketId) {
      where.marketId = filters.marketId;
    }

    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.side) {
      where.side = filters.side;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.isCopyTrade !== undefined) {
      where.isCopyTrade = filters.isCopyTrade;
    }

    if (filters.startDate || filters.endDate) {
      where.executedAt = {};
      if (filters.startDate) {
        where.executedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.executedAt.lte = filters.endDate;
      }
    }

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.trade.count({ where }),
    ]);

    const tradeResponses = trades.map(formatTradeResponse);
    const meta = createMeta(page, limit, total);

    logger.info('Trader trades retrieved', { 
      traderId: id, 
      count: tradeResponses.length, 
      total, 
      filters 
    });

    res.status(200).json({
      success: true,
      data: tradeResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get trader trades', {
      traderId: req.params.id,
      filters: req.query,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getTraderFollowers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { page, limit, offset } = parseQuery(req);

    const [follows, total] = await Promise.all([
      prisma.traderFollow.findMany({
        where: { followingId: id },
        include: {
          follower: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.traderFollow.count({
        where: { followingId: id },
      }),
    ]);

    const followers = follows.map((follow: any) => ({
      id: follow.id,
      follower: {
        id: follow.follower.id,
        username: follow.follower.username,
        displayName: follow.follower.displayName,
        profileImageUrl: follow.follower.profileImageUrl,
        totalPnl: parseFloat(follow.follower.totalPnl.toString()),
        totalVolume: parseFloat(follow.follower.totalVolume.toString()),
      },
      autoCopyTrades: follow.autoCopyTrades,
      maxCopyAmount: follow.maxCopyAmount ? parseFloat(follow.maxCopyAmount.toString()) : undefined,
      copyPercentage: follow.copyPercentage ? parseFloat(follow.copyPercentage.toString()) : undefined,
      totalCopiedTrades: follow.totalCopiedTrades,
      totalCopiedValue: parseFloat(follow.totalCopiedValue.toString()),
      totalCopiedPnl: parseFloat(follow.totalCopiedPnl.toString()),
      createdAt: follow.createdAt.toISOString(),
    }));

    const meta = createMeta(page, limit, total);

    logger.info('Trader followers retrieved', { traderId: id, count: followers.length, total });

    res.status(200).json({
      success: true,
      data: followers,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get trader followers', {
      traderId: req.params.id,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getTraderFollowing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { page, limit, offset } = parseQuery(req);

    const [follows, total] = await Promise.all([
      prisma.traderFollow.findMany({
        where: { followerId: id },
        include: {
          following: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.traderFollow.count({
        where: { followerId: id },
      }),
    ]);

    const following = follows.map((follow: any) => ({
      id: follow.id,
      following: {
        id: follow.following.id,
        username: follow.following.username,
        displayName: follow.following.displayName,
        profileImageUrl: follow.following.profileImageUrl,
        totalPnl: parseFloat(follow.following.totalPnl.toString()),
        totalVolume: parseFloat(follow.following.totalVolume.toString()),
      },
      autoCopyTrades: follow.autoCopyTrades,
      maxCopyAmount: follow.maxCopyAmount ? parseFloat(follow.maxCopyAmount.toString()) : undefined,
      copyPercentage: follow.copyPercentage ? parseFloat(follow.copyPercentage.toString()) : undefined,
      totalCopiedTrades: follow.totalCopiedTrades,
      totalCopiedValue: parseFloat(follow.totalCopiedValue.toString()),
      totalCopiedPnl: parseFloat(follow.totalCopiedPnl.toString()),
      createdAt: follow.createdAt.toISOString(),
    }));

    const meta = createMeta(page, limit, total);

    logger.info('Trader following retrieved', { traderId: id, count: following.length, total });

    res.status(200).json({
      success: true,
      data: following,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get trader following', {
      traderId: req.params.id,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getTradersForCopyTrading = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);
    const filters = (req as any).parsedQuery || req.query;
    const source = filters.source as MarketSource | undefined;

    const where: any = {
      allowCopyTrading: true,
      isPublic: true,
    };

    if (source) {
      where.source = source;
    }

    const [traders, total] = await Promise.all([
      prisma.trader.findMany({
        where,
        orderBy: [
          { totalPnl: 'desc' },
          { totalVolume: 'desc' },
        ],
        skip: offset,
        take: limit,
      }),
      prisma.trader.count({ where }),
    ]);

    const traderResponses = traders.map(formatTraderResponse);
    const meta = createMeta(page, limit, total);

    logger.info('Copy trading traders retrieved', { 
      count: traderResponses.length, 
      total, 
      source 
    });

    res.status(200).json({
      success: true,
      data: traderResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get traders for copy trading', {
      source: req.query.source,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};
