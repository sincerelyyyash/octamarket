import { prisma } from '@repo/database';
import { MarketSource } from '@repo/database';
import { logger } from '../utils/logger';
import type { 
  TraderFilters, 
  TraderResponse, 
  TradeResponse 
} from '../types/index.js';

export class TraderService {
  async getTraders(
    filters: TraderFilters,
    page: number,
    limit: number
  ): Promise<{ traders: TraderResponse[]; total: number }> {
    try {
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
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.trader.count({ where }),
      ]);

      const traderResponses: TraderResponse[] = traders.map(trader => ({
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
      }));

      logger.debug('Traders retrieved', { count: traderResponses.length, total, filters });

      return { traders: traderResponses, total };
    } catch (error) {
      logger.error('Failed to get traders', {
        filters,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getTraderById(id: string): Promise<TraderResponse | null> {
    try {
      const trader = await prisma.trader.findUnique({
        where: { id },
      });

      if (!trader) {
        return null;
      }

      const traderResponse: TraderResponse = {
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
      };

      logger.debug('Trader retrieved', { id });

      return traderResponse;
    } catch (error) {
      logger.error('Failed to get trader by ID', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getTraderStats(id: string): Promise<any> {
    try {
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
        return null;
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

      logger.debug('Trader stats retrieved', { id });

      return stats;
    } catch (error) {
      logger.error('Failed to get trader stats', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getTraderTrades(
    id: string,
    filters: {
      marketId?: string;
      source?: MarketSource;
      side?: 'BUY' | 'SELL';
      status?: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED';
      isCopyTrade?: boolean;
      startDate?: Date;
      endDate?: Date;
    },
    page: number,
    limit: number
  ): Promise<{ trades: TradeResponse[]; total: number }> {
    try {
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
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.trade.count({ where }),
      ]);

      const tradeResponses: TradeResponse[] = trades.map(trade => ({
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
      }));

      logger.debug('Trader trades retrieved', { 
        traderId: id, 
        count: tradeResponses.length, 
        total, 
        filters 
      });

      return { trades: tradeResponses, total };
    } catch (error) {
      logger.error('Failed to get trader trades', {
        traderId: id,
        filters,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getTraderFollowers(id: string, page: number, limit: number): Promise<{ followers: any[]; total: number }> {
    try {
      const [follows, total] = await Promise.all([
        prisma.traderFollow.findMany({
          where: { followingId: id },
          include: {
            follower: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.traderFollow.count({
          where: { followingId: id },
        }),
      ]);

      const followers = follows.map(follow => ({
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

      logger.debug('Trader followers retrieved', { traderId: id, count: followers.length, total });

      return { followers, total };
    } catch (error) {
      logger.error('Failed to get trader followers', {
        traderId: id,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getTraderFollowing(id: string, page: number, limit: number): Promise<{ following: any[]; total: number }> {
    try {
      const [follows, total] = await Promise.all([
        prisma.traderFollow.findMany({
          where: { followerId: id },
          include: {
            following: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.traderFollow.count({
          where: { followerId: id },
        }),
      ]);

      const following = follows.map(follow => ({
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

      logger.debug('Trader following retrieved', { traderId: id, count: following.length, total });

      return { following, total };
    } catch (error) {
      logger.error('Failed to get trader following', {
        traderId: id,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getTradersForCopyTrading(
    source?: MarketSource,
    page: number = 1,
    limit: number = 20
  ): Promise<{ traders: TraderResponse[]; total: number }> {
    try {
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
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.trader.count({ where }),
      ]);

      const traderResponses: TraderResponse[] = traders.map(trader => ({
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
      }));

      logger.debug('Copy trading traders retrieved', { 
        count: traderResponses.length, 
        total, 
        source 
      });

      return { traders: traderResponses, total };
    } catch (error) {
      logger.error('Failed to get traders for copy trading', {
        source,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const traderService = new TraderService();
