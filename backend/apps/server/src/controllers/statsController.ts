import { Request, Response, NextFunction } from 'express';
import { prisma } from '@repo/database';
import { MarketSource, MarketStatus } from '@repo/database';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

// Validation schemas
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const timeframeSchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d', 'all']).default('all'),
});

// Validation middleware
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

export const validateTimeframe = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsedQuery = timeframeSchema.parse(req.query);
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

// Controller functions
export const getPlatformStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = (req as any).parsedQuery || req.query;
    const timeframe = filters.timeframe as string || 'all';
    const timeFilter = getTimeframeFilter(timeframe);

    const [
      totalMarkets,
      activeMarkets,
      resolvedMarkets,
      totalTraders,
      totalVolume,
      totalTrades,
      recentActivity,
    ] = await Promise.all([
      prisma.market.count(),
      prisma.market.count({ where: { status: MarketStatus.ACTIVE } }),
      prisma.market.count({ where: { status: MarketStatus.RESOLVED } }),
      prisma.trader.count({ where: { isPublic: true } }),
      prisma.trade.aggregate({
        _sum: { totalValue: true },
        where: timeFilter ? { executedAt: timeFilter } : undefined,
      }),
      prisma.trade.count({
        where: timeFilter ? { executedAt: timeFilter } : undefined,
      }),
      prisma.trade.count({
        where: {
          executedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
    ]);

    const avgMarketVolume = totalMarkets > 0 ? 
      (totalVolume._sum.totalValue ? parseFloat(totalVolume._sum.totalValue.toString()) : 0) / totalMarkets : 0;

    const avgTraderPnl = totalTraders > 0 ? 
      (await prisma.trader.aggregate({
        _avg: { totalPnl: true },
        where: { isPublic: true },
      }))._avg.totalPnl ? parseFloat((await prisma.trader.aggregate({
        _avg: { totalPnl: true },
        where: { isPublic: true },
      }))._avg.totalPnl!.toString()) : 0 : 0;

    const stats = {
      overview: {
        totalMarkets,
        activeMarkets,
        resolvedMarkets,
        totalTraders,
        totalVolume: totalVolume._sum.totalValue ? parseFloat(totalVolume._sum.totalValue.toString()) : 0,
        totalTrades,
        avgMarketVolume,
        avgTraderPnl,
        recentActivity,
      },
      timeframe,
      generatedAt: new Date().toISOString(),
    };

    logger.info('Platform stats retrieved', { timeframe, stats: stats.overview });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get platform stats', {
      timeframe: req.query.timeframe,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getMarketStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);

    const [
      totalMarkets,
      marketsByCategory,
      marketsBySource,
      marketsByStatus,
      topMarketsByVolume,
      topMarketsByParticipants,
    ] = await Promise.all([
      prisma.market.count(),
      prisma.market.groupBy({
        by: ['category'],
        _count: { id: true },
        where: { category: { not: null } },
      }),
      prisma.sourceMarket.groupBy({
        by: ['source'],
        _count: { id: true },
      }),
      prisma.market.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.market.findMany({
        orderBy: { totalVolume: 'desc' },
        take: limit,
        skip: offset,
        include: {
          outcomes: { orderBy: { index: 'asc' } },
          sourceMarkets: true,
        },
      }),
      prisma.market.findMany({
        orderBy: { participantCount: 'desc' },
        take: limit,
        skip: offset,
        include: {
          outcomes: { orderBy: { index: 'asc' } },
          sourceMarkets: true,
        },
      }),
    ]);

    // Process source markets data
    const sourceStats = await prisma.sourceMarket.groupBy({
      by: ['source'],
      _count: { id: true },
    });

    const marketsBySourceFormatted = sourceStats.map(stat => ({
      source: stat.source,
      count: stat._count.id,
    }));

    const stats = {
      overview: {
        totalMarkets,
        marketsByCategory: marketsByCategory.map(cat => ({
          category: cat.category || 'Uncategorized',
          count: cat._count.id,
        })),
        marketsBySource: marketsBySourceFormatted,
        marketsByStatus: marketsByStatus.map(status => ({
          status: status.status,
          count: status._count.id,
        })),
      },
      topMarkets: {
        byVolume: topMarketsByVolume.map(market => ({
          id: market.id,
          title: market.title,
          category: market.category,
          status: market.status,
          totalVolume: market.totalVolume ? parseFloat(market.totalVolume.toString()) : 0,
          participantCount: market.participantCount || 0,
          outcomes: market.outcomes.map(outcome => ({
            id: outcome.id,
            title: outcome.title,
            currentPrice: outcome.currentPrice ? parseFloat(outcome.currentPrice.toString()) : undefined,
          })),
        })),
        byParticipants: topMarketsByParticipants.map(market => ({
          id: market.id,
          title: market.title,
          category: market.category,
          status: market.status,
          totalVolume: market.totalVolume ? parseFloat(market.totalVolume.toString()) : 0,
          participantCount: market.participantCount || 0,
          outcomes: market.outcomes.map(outcome => ({
            id: outcome.id,
            title: outcome.title,
            currentPrice: outcome.currentPrice ? parseFloat(outcome.currentPrice.toString()) : undefined,
          })),
        })),
      },
      generatedAt: new Date().toISOString(),
    };

    logger.info('Market stats retrieved', { totalMarkets });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get market stats', {
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getSourceStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = (req as any).parsedQuery || req.query;
    const timeframe = filters.timeframe as string || 'all';
    const timeFilter = getTimeframeFilter(timeframe);

    const [
      sourceMarkets,
      sourceTraders,
      sourceTrades,
      sourceVolume,
    ] = await Promise.all([
      prisma.sourceMarket.groupBy({
        by: ['source'],
        _count: { id: true },
      }),
      prisma.trader.groupBy({
        by: ['source'],
        _count: { id: true },
        where: { isPublic: true },
      }),
      prisma.trade.groupBy({
        by: ['source'],
        _count: { id: true },
        where: timeFilter ? { executedAt: timeFilter } : undefined,
      }),
      prisma.trade.groupBy({
        by: ['source'],
        _sum: { totalValue: true },
        where: timeFilter ? { executedAt: timeFilter } : undefined,
      }),
    ]);

    const sourceStats = Object.values(MarketSource).map(source => {
      const markets = sourceMarkets.find(s => s.source === source)?._count.id || 0;
      const traders = sourceTraders.find(s => s.source === source)?._count.id || 0;
      const trades = sourceTrades.find(s => s.source === source)?._count.id || 0;
      const volume = sourceVolume.find(s => s.source === source)?._sum.totalValue || 0;

      return {
        source,
        markets,
        traders,
        trades,
        volume: parseFloat(volume.toString()),
        avgTradeValue: trades > 0 ? parseFloat(volume.toString()) / trades : 0,
      };
    });

    const stats = {
      sources: sourceStats,
      timeframe,
      generatedAt: new Date().toISOString(),
    };

    logger.info('Source stats retrieved', { timeframe, sourceCount: sourceStats.length });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get source stats', {
      timeframe: req.query.timeframe,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getTraderStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);

    const [
      totalTraders,
      tradersBySource,
      topTradersByPnl,
      topTradersByVolume,
      topTradersByWinRate,
    ] = await Promise.all([
      prisma.trader.count({ where: { isPublic: true } }),
      prisma.trader.groupBy({
        by: ['source'],
        _count: { id: true },
        where: { isPublic: true },
      }),
      prisma.trader.findMany({
        where: { isPublic: true },
        orderBy: { totalPnl: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.trader.findMany({
        where: { isPublic: true },
        orderBy: { totalVolume: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.trader.findMany({
        where: { 
          isPublic: true,
          winRate: { not: null },
        },
        orderBy: { winRate: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    const stats = {
      overview: {
        totalTraders,
        tradersBySource: tradersBySource.map(source => ({
          source: source.source,
          count: source._count.id,
        })),
      },
      topTraders: {
        byPnl: topTradersByPnl.map(trader => ({
          id: trader.id,
          username: trader.username,
          displayName: trader.displayName,
          source: trader.source,
          totalPnl: parseFloat(trader.totalPnl.toString()),
          totalVolume: parseFloat(trader.totalVolume.toString()),
          winRate: trader.winRate ? parseFloat(trader.winRate.toString()) : undefined,
          totalTrades: trader.totalTrades,
        })),
        byVolume: topTradersByVolume.map(trader => ({
          id: trader.id,
          username: trader.username,
          displayName: trader.displayName,
          source: trader.source,
          totalPnl: parseFloat(trader.totalPnl.toString()),
          totalVolume: parseFloat(trader.totalVolume.toString()),
          winRate: trader.winRate ? parseFloat(trader.winRate.toString()) : undefined,
          totalTrades: trader.totalTrades,
        })),
        byWinRate: topTradersByWinRate.map(trader => ({
          id: trader.id,
          username: trader.username,
          displayName: trader.displayName,
          source: trader.source,
          totalPnl: parseFloat(trader.totalPnl.toString()),
          totalVolume: parseFloat(trader.totalVolume.toString()),
          winRate: trader.winRate ? parseFloat(trader.winRate.toString()) : undefined,
          totalTrades: trader.totalTrades,
        })),
      },
      generatedAt: new Date().toISOString(),
    };

    logger.info('Trader stats retrieved', { totalTraders });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get trader stats', {
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getLeaderboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);
    const filters = (req as any).parsedQuery || req.query;
    const source = filters.source as MarketSource | undefined;

    const where: any = { isPublic: true };
    if (source) {
      where.source = source;
    }

    const [
      totalTraders,
      leaderboardSnapshots,
      topTraders,
    ] = await Promise.all([
      prisma.trader.count({ where }),
      prisma.leaderboardSnapshot.findMany({
        where: source ? { source } : undefined,
        orderBy: { snapshotDate: 'desc' },
        take: 10,
        include: {
          topTrader: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
            },
          },
        },
      }),
      prisma.trader.findMany({
        where,
        orderBy: { totalPnl: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    const stats = {
      overview: {
        totalTraders,
        source: source || 'all',
      },
      leaderboard: {
        snapshots: leaderboardSnapshots.map(snapshot => ({
          id: snapshot.id,
          source: snapshot.source,
          snapshotDate: snapshot.snapshotDate.toISOString(),
          topTrader: snapshot.topTrader ? {
            id: snapshot.topTrader.id,
            username: snapshot.topTrader.username,
            displayName: snapshot.topTrader.displayName,
            profileImageUrl: snapshot.topTrader.profileImageUrl,
          } : null,
          topTraderPnl: parseFloat(snapshot.topTraderPnl.toString()),
          topTraderVolume: parseFloat(snapshot.topTraderVolume.toString()),
          totalTraders: snapshot.totalTraders,
          totalVolume: parseFloat(snapshot.totalVolume.toString()),
          totalTrades: snapshot.totalTrades,
          avgPnl: parseFloat(snapshot.avgPnl.toString()),
        })),
        topTraders: topTraders.map(trader => ({
          id: trader.id,
          username: trader.username,
          displayName: trader.displayName,
          source: trader.source,
          totalPnl: parseFloat(trader.totalPnl.toString()),
          totalVolume: parseFloat(trader.totalVolume.toString()),
          winRate: trader.winRate ? parseFloat(trader.winRate.toString()) : undefined,
          currentRank: trader.currentRank || undefined,
          totalTrades: trader.totalTrades,
        })),
      },
      generatedAt: new Date().toISOString(),
    };

    logger.info('Leaderboard stats retrieved', { totalTraders, source });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get leaderboard stats', {
      source: req.query.source,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};