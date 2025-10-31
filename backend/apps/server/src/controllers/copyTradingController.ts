import { Request, Response, NextFunction } from 'express';
import { prisma, Prisma } from '@repo/database';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Types
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  body: any;
  params: any;
  query: any;
}

// Validation schemas
const followTraderSchema = z.object({
  traderId: z.string().cuid(),
  autoCopyTrades: z.boolean().default(true),
  maxCopyAmount: z.number().positive().optional(),
  copyPercentage: z.number().min(0).max(1).optional(),
});

const updateSettingsSchema = z.object({
  autoCopyTrades: z.boolean().optional(),
  maxCopyAmount: z.number().positive().optional(),
  copyPercentage: z.number().min(0).max(1).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const traderIdSchema = z.object({
  traderId: z.string().cuid(),
});

const followIdSchema = z.object({
  followId: z.string().cuid(),
});

// Validation middleware
export const validateFollowTrader = (req: Request, res: Response, next: NextFunction): void => {
  try {
    req.body = followTraderSchema.parse(req.body);
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

export const validateUpdateSettings = (req: Request, res: Response, next: NextFunction): void => {
  try {
    req.body = updateSettingsSchema.parse(req.body);
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

export const validateTraderId = (req: Request, res: Response, next: NextFunction): void => {
  try {
    req.params = traderIdSchema.parse(req.params);
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

export const validateFollowId = (req: Request, res: Response, next: NextFunction): void => {
  try {
    req.params = followIdSchema.parse(req.params);
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

const formatFollowResponse = (follow: any) => ({
  id: follow.id,
  followerId: follow.followerId,
  followingId: follow.followingId,
  autoCopyTrades: follow.autoCopyTrades,
  maxCopyAmount: follow.maxCopyAmount ? parseFloat(follow.maxCopyAmount.toString()) : undefined,
  copyPercentage: follow.copyPercentage ? parseFloat(follow.copyPercentage.toString()) : undefined,
  totalCopiedTrades: follow.totalCopiedTrades,
  totalCopiedValue: parseFloat(follow.totalCopiedValue.toString()),
  totalCopiedPnl: parseFloat(follow.totalCopiedPnl.toString()),
  createdAt: follow.createdAt.toISOString(),
  updatedAt: follow.updatedAt.toISOString(),
  followingTrader: follow.following ? {
    id: follow.following.id,
    source: follow.following.source,
    sourceTraderId: follow.following.sourceTraderId,
    username: follow.following.username,
    displayName: follow.following.displayName,
    profileImageUrl: follow.following.profileImageUrl,
    totalTrades: follow.following.totalTrades,
    totalVolume: parseFloat(follow.following.totalVolume.toString()),
    totalPnl: parseFloat(follow.following.totalPnl.toString()),
    winRate: follow.following.winRate ? parseFloat(follow.following.winRate.toString()) : undefined,
    currentRank: follow.following.currentRank || undefined,
    isPublic: follow.following.isPublic,
    allowCopyTrading: follow.following.allowCopyTrading,
  } : undefined,
});

// Controller functions
export const followTrader = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const followerId = req.user.id;
    const { traderId, autoCopyTrades, maxCopyAmount, copyPercentage } = req.body;

    // Check if trader exists and allows copy trading
    const trader = await prisma.trader.findUnique({
      where: { id: traderId },
      select: { 
        id: true, 
        allowCopyTrading: true, 
        isPublic: true,
        maxFollowers: true,
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

    if (!trader.allowCopyTrading || !trader.isPublic) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Trader does not allow copy trading',
          code: 'COPY_TRADING_NOT_ALLOWED',
        },
      });
      return;
    }

    // Check follower limit
    if (trader.maxFollowers) {
      const currentFollowers = await prisma.traderFollow.count({
        where: { followingId: traderId },
      });

      if (currentFollowers >= trader.maxFollowers) {
        res.status(403).json({
          success: false,
          error: {
            message: 'Trader has reached maximum follower limit',
            code: 'FOLLOWER_LIMIT_REACHED',
          },
        });
        return;
      }
    }

    // Check if already following
    const existingFollow = await prisma.traderFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: traderId,
        },
      },
    });

    if (existingFollow) {
      res.status(409).json({
        success: false,
        error: {
          message: 'Already following this trader',
          code: 'ALREADY_FOLLOWING',
        },
      });
      return;
    }

    // Create follow relationship
    const follow = await prisma.traderFollow.create({
      data: {
        followerId,
        followingId: traderId,
        autoCopyTrades: autoCopyTrades ?? true,
        maxCopyAmount: maxCopyAmount ? new Prisma.Decimal(maxCopyAmount) : null,
        copyPercentage: copyPercentage ? new Prisma.Decimal(copyPercentage) : null,
      },
      include: {
        following: true,
      },
    });

    const followResponse = formatFollowResponse(follow);

    logger.info('Trader followed successfully', { 
      followerId, 
      followingId: traderId, 
      autoCopyTrades: follow.autoCopyTrades 
    });

    res.status(201).json({
      success: true,
      data: followResponse,
    });
  } catch (error) {
    logger.error('Failed to follow trader', {
      followerId: req.user?.id,
      traderId: req.body.traderId,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const unfollowTrader = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const followerId = req.user.id;
    const { traderId } = req.params;

    const result = await prisma.traderFollow.deleteMany({
      where: {
        followerId,
        followingId: traderId,
      },
    });

    if (result.count === 0) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Follow relationship not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    logger.info('Trader unfollowed successfully', { followerId, followingId: traderId });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to unfollow trader', {
      followerId: req.user?.id,
      traderId: req.params.traderId,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const updateCopySettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const followerId = req.user.id;
    const { followId } = req.params;
    const { autoCopyTrades, maxCopyAmount, copyPercentage } = req.body;

    const follow = await prisma.traderFollow.findFirst({
      where: {
        id: followId,
        followerId,
      },
      include: {
        following: true,
      },
    });

    if (!follow) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Follow relationship not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    const updatedFollow = await prisma.traderFollow.update({
      where: { id: followId },
      data: {
        autoCopyTrades: autoCopyTrades ?? follow.autoCopyTrades,
        maxCopyAmount: maxCopyAmount ? new Prisma.Decimal(maxCopyAmount) : follow.maxCopyAmount,
        copyPercentage: copyPercentage ? new Prisma.Decimal(copyPercentage) : follow.copyPercentage,
        updatedAt: new Date(),
      },
      include: {
        following: true,
      },
    });

    const followResponse = formatFollowResponse(updatedFollow);

    logger.info('Copy settings updated successfully', { 
      followerId, 
      followId, 
      autoCopyTrades: updatedFollow.autoCopyTrades 
    });

    res.status(200).json({
      success: true,
      data: followResponse,
    });
  } catch (error) {
    logger.error('Failed to update copy settings', {
      followerId: req.user?.id,
      followId: req.params.followId,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getMyFollows = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const followerId = req.user.id;
    const { page, limit, offset } = parseQuery(req);

    const [follows, total] = await Promise.all([
      prisma.traderFollow.findMany({
        where: { followerId },
        include: {
          following: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.traderFollow.count({
        where: { followerId },
      }),
    ]);

    const followResponses = follows.map(formatFollowResponse);
    const meta = createMeta(page, limit, total);

    logger.info('User follows retrieved', { 
      followerId, 
      count: followResponses.length, 
      total 
    });

    res.status(200).json({
      success: true,
      data: followResponses,
      meta,
    });
  } catch (error) {
    logger.error('Failed to get user follows', {
      followerId: req.user?.id,
      page: req.query.page,
      limit: req.query.limit,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getCopyTradingStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const followerId = req.user.id;

    const [
      followCount,
      totalCopiedTrades,
      totalCopiedValue,
      totalCopiedPnl,
      recentCopiedTrades,
    ] = await Promise.all([
      prisma.traderFollow.count({
        where: { followerId },
      }),
      prisma.traderFollow.aggregate({
        where: { followerId },
        _sum: { totalCopiedTrades: true },
      }),
      prisma.traderFollow.aggregate({
        where: { followerId },
        _sum: { totalCopiedValue: true },
      }),
      prisma.traderFollow.aggregate({
        where: { followerId },
        _sum: { totalCopiedPnl: true },
      }),
      prisma.trade.findMany({
        where: {
          copiedByTraderId: followerId,
        },
        orderBy: { executedAt: 'desc' },
        take: 10,
        include: {
          trader: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      }),
    ]);

    const stats = {
      overview: {
        followCount,
        totalCopiedTrades: totalCopiedTrades._sum.totalCopiedTrades || 0,
        totalCopiedValue: totalCopiedValue._sum.totalCopiedValue ? 
          parseFloat(totalCopiedValue._sum.totalCopiedValue.toString()) : 0,
        totalCopiedPnl: totalCopiedPnl._sum.totalCopiedPnl ? 
          parseFloat(totalCopiedPnl._sum.totalCopiedPnl.toString()) : 0,
      },
      recentCopiedTrades: recentCopiedTrades.map((trade: any) => ({
        id: trade.id,
        trader: trade.trader,
        side: trade.side,
        quantity: parseFloat(trade.quantity.toString()),
        price: parseFloat(trade.price.toString()),
        totalValue: parseFloat(trade.totalValue.toString()),
        realizedPnl: trade.realizedPnl ? parseFloat(trade.realizedPnl.toString()) : undefined,
        executedAt: trade.executedAt.toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    };

    logger.info('Copy trading stats retrieved', { 
      followerId, 
      followCount, 
      totalCopiedTrades: stats.overview.totalCopiedTrades 
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get copy trading stats', {
      followerId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};