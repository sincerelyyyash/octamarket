import { Request, Response, NextFunction } from 'express';
import { prisma, Prisma } from '@repo/database';
import { MarketSource, MarketStatus } from '@repo/database';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

// Validation schemas
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const marketFiltersSchema = z.object({
  status: z.nativeEnum(MarketStatus).optional(),
  category: z.string().optional(),
  source: z.nativeEnum(MarketSource).optional(),
  tags: z.string().optional().transform(val => val ? val.split(',') : undefined),
  search: z.string().optional(),
  sortBy: z.enum(['volume', 'liquidity', 'endDate', 'createdAt', 'participantCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const marketQuerySchema = paginationSchema.merge(marketFiltersSchema);

const idSchema = z.object({
  id: z.string().cuid(),
});

const priceHistoryQuerySchema = z.object({
  outcomeId: z.string().optional(),
  source: z.nativeEnum(MarketSource).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

// Validation middleware
export const validateMarketQuery = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsedQuery = marketQuerySchema.parse(req.query);
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

export const validatePriceHistoryQuery = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const parsedQuery = priceHistoryQuerySchema.parse(req.query);
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

const formatMarketResponse = (market: any) => ({
  id: market.id,
  title: market.title,
  description: market.description || undefined,
  category: market.category || undefined,
  tags: Array.isArray(market.tags) ? market.tags as string[] : [],
  createdAt: market.createdAt.toISOString(),
  updatedAt: market.updatedAt.toISOString(),
  endDate: market.endDate?.toISOString(),
  resolutionDate: market.resolutionDate?.toISOString(),
  status: market.status,
  totalVolume: market.totalVolume ? parseFloat(market.totalVolume.toString()) : undefined,
  totalLiquidity: market.totalLiquidity ? parseFloat(market.totalLiquidity.toString()) : undefined,
  participantCount: market.participantCount || undefined,
  resolvedOutcome: market.resolvedOutcome || undefined,
  resolutionSource: market.resolutionSource || undefined,
  outcomes: market.outcomes?.map((outcome: any) => ({
    id: outcome.id,
    title: outcome.title,
    description: outcome.description || undefined,
    index: outcome.index,
    currentPrice: outcome.currentPrice ? parseFloat(outcome.currentPrice.toString()) : undefined,
    currentVolume: outcome.currentVolume ? parseFloat(outcome.currentVolume.toString()) : undefined,
    currentLiquidity: outcome.currentLiquidity ? parseFloat(outcome.currentLiquidity.toString()) : undefined,
    isWinning: outcome.isWinning || undefined,
  })) || [],
  sourceMarkets: market.sourceMarkets?.map((sourceMarket: any) => ({
    id: sourceMarket.id,
    source: sourceMarket.source,
    sourceMarketId: sourceMarket.sourceMarketId,
    isActive: sourceMarket.isActive,
  })) || [],
});

// Controller functions
export const getMarkets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);
    const filters = (req as any).parsedQuery || req.query;

    const where: any = {};

    // Apply filters
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      };
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Source filter through sourceMarkets
    if (filters.source) {
      where.sourceMarkets = {
        some: {
          source: filters.source,
        },
      };
    }

    // Build orderBy
    const orderBy: any = {};
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'volume':
          orderBy.totalVolume = filters.sortOrder || 'desc';
          break;
        case 'liquidity':
          orderBy.totalLiquidity = filters.sortOrder || 'desc';
          break;
        case 'endDate':
          orderBy.endDate = filters.sortOrder || 'asc';
          break;
        case 'participantCount':
          orderBy.participantCount = filters.sortOrder || 'desc';
          break;
        case 'createdAt':
        default:
          orderBy.createdAt = filters.sortOrder || 'desc';
          break;
      }
    } else {
      orderBy.createdAt = 'desc';
    }

    const [markets, total] = await Promise.all([
      prisma.market.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          outcomes: {
            orderBy: { index: 'asc' },
          },
          sourceMarkets: true,
        },
      }),
      prisma.market.count({ where }),
    ]);

    const marketResponses = markets.map(formatMarketResponse);
    const meta = createMeta(page, limit, total);

    logger.info('Markets retrieved', { count: marketResponses.length, total, filters });

    res.status(200).json({
      success: true,
      data: marketResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get markets', {
      filters: req.query,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getMarketById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        outcomes: {
          orderBy: { index: 'asc' },
        },
        sourceMarkets: true,
      },
    });

    if (!market) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Market not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    const marketResponse = formatMarketResponse(market);

    logger.info('Market retrieved', { id });

    res.status(200).json({
      success: true,
      data: marketResponse,
    });
  } catch (error) {
    logger.error('Failed to get market by ID', {
      id: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getMarketOutcomes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        outcomes: {
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!market) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Market not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    const outcomes = market.outcomes.map(outcome => ({
      id: outcome.id,
      title: outcome.title,
      description: outcome.description || undefined,
      index: outcome.index,
      currentPrice: outcome.currentPrice ? parseFloat(outcome.currentPrice.toString()) : undefined,
      currentVolume: outcome.currentVolume ? parseFloat(outcome.currentVolume.toString()) : undefined,
      currentLiquidity: outcome.currentLiquidity ? parseFloat(outcome.currentLiquidity.toString()) : undefined,
      isWinning: outcome.isWinning || undefined,
    }));

    logger.info('Market outcomes retrieved', { id, outcomeCount: outcomes.length });

    res.status(200).json({
      success: true,
      data: outcomes,
    });
  } catch (error) {
    logger.error('Failed to get market outcomes', {
      id: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getMarketPriceHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const filters = (req as any).parsedQuery || req.query;
    const {
      outcomeId,
      source,
      startDate,
      endDate,
      limit,
    } = filters as any;

    const where: any = {
      marketId: id,
    };

    if (outcomeId) {
      where.outcomeId = outcomeId;
    }

    if (source) {
      where.source = source;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    const priceHistory = await prisma.priceHistory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit || 100,
    });

    const priceHistoryResponses = priceHistory.map(ph => ({
      id: ph.id,
      marketId: ph.marketId,
      outcomeId: ph.outcomeId || undefined,
      source: ph.source,
      price: parseFloat(ph.price.toString()),
      volume: ph.volume ? parseFloat(ph.volume.toString()) : undefined,
      liquidity: ph.liquidity ? parseFloat(ph.liquidity.toString()) : undefined,
      timestamp: ph.timestamp.toISOString(),
    }));

    logger.info('Price history retrieved', { 
      marketId: id, 
      count: priceHistoryResponses.length,
      filters: req.query 
    });

    res.status(200).json({
      success: true,
      data: priceHistoryResponses,
    });
  } catch (error) {
    logger.error('Failed to get price history', {
      marketId: req.params.id,
      filters: req.query,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getActiveMarkets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);

    const where = {
      status: MarketStatus.ACTIVE,
    };

    const [markets, total] = await Promise.all([
      prisma.market.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          outcomes: {
            orderBy: { index: 'asc' },
          },
          sourceMarkets: true,
        },
      }),
      prisma.market.count({ where }),
    ]);

    const marketResponses = markets.map(formatMarketResponse);
    const meta = createMeta(page, limit, total);

    logger.info('Active markets retrieved', { count: marketResponses.length, total });

    res.status(200).json({
      success: true,
      data: marketResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get active markets', {
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getTrendingMarkets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit, offset } = parseQuery(req);

    const where = {
      status: MarketStatus.ACTIVE,
      OR: [
        { totalVolume: { gt: 0 } },
        { participantCount: { gt: 0 } },
      ],
    };

    const orderBy = [
      { totalVolume: 'desc' as const },
      { participantCount: 'desc' as const },
      { createdAt: 'desc' as const },
    ];

    const [markets, total] = await Promise.all([
      prisma.market.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          outcomes: {
            orderBy: { index: 'asc' },
          },
          sourceMarkets: true,
        },
      }),
      prisma.market.count({ where }),
    ]);

    const marketResponses = markets.map(formatMarketResponse);
    const meta = createMeta(page, limit, total);

    logger.info('Trending markets retrieved', { count: marketResponses.length, total });

    res.status(200).json({
      success: true,
      data: marketResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get trending markets', {
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getMarketCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.market.findMany({
      select: { category: true },
      where: {
        category: { not: null },
      },
      distinct: ['category'],
    });

    const categoryList = categories
      .map(c => c.category)
      .filter((category): category is string => category !== null);

    logger.info('Market categories retrieved', { count: categoryList.length });

    res.status(200).json({
      success: true,
      data: categoryList,
    });
  } catch (error) {
    logger.error('Failed to get market categories', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getMarketTags = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const markets = await prisma.market.findMany({
      select: { tags: true },
      where: {
        tags: { not: Prisma.JsonNull },
      },
    });

    const allTags = new Set<string>();
    markets.forEach(market => {
      if (Array.isArray(market.tags)) {
        (market.tags as string[]).forEach(tag => allTags.add(tag));
      }
    });

    const tagList = Array.from(allTags).sort();

    logger.info('Market tags retrieved', { count: tagList.length });

    res.status(200).json({
      success: true,
      data: tagList,
    });
  } catch (error) {
    logger.error('Failed to get market tags', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};
