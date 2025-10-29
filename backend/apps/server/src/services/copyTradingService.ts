import { prisma, Prisma } from '@repo/database';
import { logger } from '../utils/logger.js';
import type { 
  CopyTradingSettings, 
  TraderFollowResponse 
} from '../types/index.js';

export class CopyTradingService {
  async followTrader(
    followerId: string,
    traderId: string,
    settings?: CopyTradingSettings
  ): Promise<TraderFollowResponse> {
    try {
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
        throw new Error('Trader not found');
      }

      if (!trader.allowCopyTrading || !trader.isPublic) {
        throw new Error('Trader does not allow copy trading');
      }

      // Check follower limit
      if (trader.maxFollowers) {
        const currentFollowers = await prisma.traderFollow.count({
          where: { followingId: traderId },
        });

        if (currentFollowers >= trader.maxFollowers) {
          throw new Error('Trader has reached maximum follower limit');
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
        throw new Error('Already following this trader');
      }

      // Create follow relationship
      const follow = await prisma.traderFollow.create({
        data: {
          followerId,
          followingId: traderId,
          autoCopyTrades: settings?.autoCopyTrades || false,
          maxCopyAmount: settings?.maxCopyAmount ? new Prisma.Decimal(settings.maxCopyAmount) : null,
          copyPercentage: settings?.copyPercentage ? new Prisma.Decimal(settings.copyPercentage) : null,
          totalCopiedTrades: 0,
          totalCopiedValue: new Prisma.Decimal(0),
          totalCopiedPnl: new Prisma.Decimal(0),
        },
      });

      const followResponse: TraderFollowResponse = {
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
      };

      logger.info('Trader follow created', { 
        followerId, 
        traderId, 
        followId: follow.id 
      });

      return followResponse;
    } catch (error) {
      logger.error('Failed to follow trader', {
        followerId,
        traderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async unfollowTrader(followerId: string, traderId: string): Promise<void> {
    try {
      const follow = await prisma.traderFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId: traderId,
          },
        },
      });

      if (!follow) {
        throw new Error('Follow relationship not found');
      }

      await prisma.traderFollow.delete({
        where: { id: follow.id },
      });

      logger.info('Trader unfollowed', { 
        followerId, 
        traderId, 
        followId: follow.id 
      });
    } catch (error) {
      logger.error('Failed to unfollow trader', {
        followerId,
        traderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateFollowSettings(
    followId: string,
    followerId: string,
    settings: CopyTradingSettings
  ): Promise<TraderFollowResponse> {
    try {
      const follow = await prisma.traderFollow.findUnique({
        where: { id: followId },
      });

      if (!follow) {
        throw new Error('Follow relationship not found');
      }

      if (follow.followerId !== followerId) {
        throw new Error('Unauthorized to update this follow relationship');
      }

      const updatedFollow = await prisma.traderFollow.update({
        where: { id: followId },
        data: {
          autoCopyTrades: settings.autoCopyTrades,
          maxCopyAmount: settings.maxCopyAmount ? new Prisma.Decimal(settings.maxCopyAmount) : null,
          copyPercentage: settings.copyPercentage ? new Prisma.Decimal(settings.copyPercentage) : null,
          updatedAt: new Date(),
        },
      });

      const followResponse: TraderFollowResponse = {
        id: updatedFollow.id,
        followerId: updatedFollow.followerId,
        followingId: updatedFollow.followingId,
        autoCopyTrades: updatedFollow.autoCopyTrades,
        maxCopyAmount: updatedFollow.maxCopyAmount ? parseFloat(updatedFollow.maxCopyAmount.toString()) : undefined,
        copyPercentage: updatedFollow.copyPercentage ? parseFloat(updatedFollow.copyPercentage.toString()) : undefined,
        totalCopiedTrades: updatedFollow.totalCopiedTrades,
        totalCopiedValue: parseFloat(updatedFollow.totalCopiedValue.toString()),
        totalCopiedPnl: parseFloat(updatedFollow.totalCopiedPnl.toString()),
        createdAt: updatedFollow.createdAt.toISOString(),
        updatedAt: updatedFollow.updatedAt.toISOString(),
      };

      logger.info('Follow settings updated', { 
        followId, 
        followerId, 
        settings 
      });

      return followResponse;
    } catch (error) {
      logger.error('Failed to update follow settings', {
        followId,
        followerId,
        settings,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getMyFollows(
    followerId: string,
    page: number,
    limit: number
  ): Promise<{ follows: TraderFollowResponse[]; total: number }> {
    try {
      const [follows, total] = await Promise.all([
        prisma.traderFollow.findMany({
          where: { followerId },
          include: {
            following: {
              select: {
                id: true,
                username: true,
                displayName: true,
                profileImageUrl: true,
                totalPnl: true,
                totalVolume: true,
                winRate: true,
                currentRank: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.traderFollow.count({
          where: { followerId },
        }),
      ]);

      const followResponses: TraderFollowResponse[] = follows.map(follow => ({
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
        // Add trader info for convenience
        trader: {
          id: follow.following.id,
          username: follow.following.username,
          displayName: follow.following.displayName,
          profileImageUrl: follow.following.profileImageUrl,
          totalPnl: parseFloat(follow.following.totalPnl.toString()),
          totalVolume: parseFloat(follow.following.totalVolume.toString()),
          winRate: follow.following.winRate ? parseFloat(follow.following.winRate.toString()) : undefined,
          currentRank: follow.following.currentRank || undefined,
        },
      }));

      logger.debug('User follows retrieved', { 
        followerId, 
        count: followResponses.length, 
        total 
      });

      return { follows: followResponses, total };
    } catch (error) {
      logger.error('Failed to get user follows', {
        followerId,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getCopyTradingStats(followerId: string): Promise<any> {
    try {
      const [followStats, tradeStats] = await Promise.all([
        prisma.traderFollow.aggregate({
          where: { followerId },
          _sum: {
            totalCopiedTrades: true,
            totalCopiedValue: true,
            totalCopiedPnl: true,
          },
          _count: {
            id: true,
          },
        }),
        prisma.trade.aggregate({
          where: {
            copiedByTraderId: followerId,
            isCopyTrade: true,
          },
          _sum: {
            totalValue: true,
            realizedPnl: true,
          },
          _count: {
            id: true,
          },
        }),
      ]);

      const stats = {
        totalFollows: followStats._count.id,
        totalCopiedTrades: followStats._sum.totalCopiedTrades || 0,
        totalCopiedValue: followStats._sum.totalCopiedValue ? parseFloat(followStats._sum.totalCopiedValue.toString()) : 0,
        totalCopiedPnl: followStats._sum.totalCopiedPnl ? parseFloat(followStats._sum.totalCopiedPnl.toString()) : 0,
        totalTradeValue: tradeStats._sum.totalValue ? parseFloat(tradeStats._sum.totalValue.toString()) : 0,
        totalRealizedPnl: tradeStats._sum.realizedPnl ? parseFloat(tradeStats._sum.realizedPnl.toString()) : 0,
        totalTradeCount: tradeStats._count.id,
      };

      logger.debug('Copy trading stats retrieved', { followerId, stats });

      return stats;
    } catch (error) {
      logger.error('Failed to get copy trading stats', {
        followerId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const copyTradingService = new CopyTradingService();
