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

const leaderboardQuerySchema = z.object({
  source: z.nativeEnum(MarketSource).optional(),
  sortBy: z.enum(['totalPnl', 'totalVolume', 'winRate', 'currentRank']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  timeframe: z.enum(['1h', '24h', '7d', '30d', 'all']).optional().default('all'),
}).merge(paginationSchema);

const snapshotQuerySchema = z.object({
  source: z.nativeEnum(MarketSource).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Validation middleware
export const validateLeaderboardQuery = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsedQuery = leaderboardQuerySchema.parse(req.query);
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

export const validateSnapshotQuery = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsedQuery = snapshotQuerySchema.parse(req.query);
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

const getTimeframeFilter = (timeframe: string) => {
  const now = new Date();
  switch (timeframe) {
    case '1h':
      return { gte: new Date(now.getTime() - 60 * 60 * 1000) };
    case '24h':
      return { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
    case '7d':
      return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    case '30d':
      return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    default:
      return undefined;
  }
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

// Controller functions
export const getLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);
    const filters = (req as any).parsedQuery || req.query;
    const { source, sortBy, sortOrder, timeframe } = filters as any;

    const where: any = {
      isPublic: true,
    };

    if (source) {
      where.source = source;
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy) {
      switch (sortBy) {
        case 'totalPnl':
          orderBy.totalPnl = sortOrder || 'desc';
          break;
        case 'totalVolume':
          orderBy.totalVolume = sortOrder || 'desc';
          break;
        case 'winRate':
          orderBy.winRate = sortOrder || 'desc';
          break;
        case 'currentRank':
          orderBy.currentRank = sortOrder || 'asc';
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

    logger.info('Leaderboard retrieved', { 
      count: traderResponses.length, 
      total, 
      source, 
      sortBy, 
      timeframe 
    });

    res.status(200).json({
      success: true,
      data: traderResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get leaderboard', {
      filters: req.query,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getSourceLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { source } = req.params;
    const { page, limit, offset } = parseQuery(req);
    const filters = (req as any).parsedQuery || req.query;
    const { sortBy, sortOrder, timeframe } = filters as any;

    const where: any = {
      source: source as MarketSource,
      isPublic: true,
    };

    // Build orderBy
    const orderBy: any = {};
    if (sortBy) {
      switch (sortBy) {
        case 'totalPnl':
          orderBy.totalPnl = sortOrder || 'desc';
          break;
        case 'totalVolume':
          orderBy.totalVolume = sortOrder || 'desc';
          break;
        case 'winRate':
          orderBy.winRate = sortOrder || 'desc';
          break;
        case 'currentRank':
          orderBy.currentRank = sortOrder || 'asc';
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

    logger.info('Source leaderboard retrieved', { 
      source, 
      count: traderResponses.length, 
      total, 
      sortBy, 
      timeframe 
    });

    res.status(200).json({
      success: true,
      data: traderResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get source leaderboard', {
      source: req.params.source,
      filters: req.query,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getLeaderboardSnapshots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = (req as any).parsedQuery || req.query;
    const { source, limit } = filters as any;

    const where: any = {};
    if (source) {
      where.source = source;
    }

    const snapshots = await prisma.leaderboardSnapshot.findMany({
      where,
      orderBy: { snapshotDate: 'desc' },
      take: limit || 10,
      include: {
        topTrader: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            source: true,
          },
        },
      },
    });

    const snapshotResponses = snapshots.map(snapshot => ({
      id: snapshot.id,
      source: snapshot.source,
      snapshotDate: snapshot.snapshotDate.toISOString(),
      topTrader: snapshot.topTrader ? {
        id: snapshot.topTrader.id,
        username: snapshot.topTrader.username,
        displayName: snapshot.topTrader.displayName,
        profileImageUrl: snapshot.topTrader.profileImageUrl,
        source: snapshot.topTrader.source,
      } : null,
      topTraderPnl: parseFloat(snapshot.topTraderPnl.toString()),
      topTraderVolume: parseFloat(snapshot.topTraderVolume.toString()),
      totalTraders: snapshot.totalTraders,
      totalVolume: parseFloat(snapshot.totalVolume.toString()),
      totalTrades: snapshot.totalTrades,
      avgPnl: parseFloat(snapshot.avgPnl.toString()),
    }));

    logger.info('Leaderboard snapshots retrieved', { 
      count: snapshotResponses.length, 
      source 
    });

    res.status(200).json({
      success: true,
      data: snapshotResponses,
    });
  } catch (error) {
    logger.error('Failed to get leaderboard snapshots', {
      source: req.query.source,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getTopTraders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);
    const filters = (req as any).parsedQuery || req.query;
    const { source, timeframe } = filters as any;

    const where: any = {
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

    logger.info('Top traders retrieved', { 
      count: traderResponses.length, 
      total, 
      source, 
      timeframe 
    });

    res.status(200).json({
      success: true,
      data: traderResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get top traders', {
      source: req.query.source,
      timeframe: req.query.timeframe,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getRisingTraders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);
    const filters = (req as any).parsedQuery || req.query;
    const { source, timeframe } = filters as any;

    const where: any = {
      isPublic: true,
      rankChange: { not: null },
    };

    if (source) {
      where.source = source;
    }

    const [traders, total] = await Promise.all([
      prisma.trader.findMany({
        where,
        orderBy: [
          { rankChange: 'desc' },
          { totalPnl: 'desc' },
        ],
        skip: offset,
        take: limit,
      }),
      prisma.trader.count({ where }),
    ]);

    const traderResponses = traders.map(formatTraderResponse);
    const meta = createMeta(page, limit, total);

    logger.info('Rising traders retrieved', { 
      count: traderResponses.length, 
      total, 
      source, 
      timeframe 
    });

    res.status(200).json({
      success: true,
      data: traderResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get rising traders', {
      source: req.query.source,
      timeframe: req.query.timeframe,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};