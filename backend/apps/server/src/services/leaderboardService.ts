import { prisma } from '@repo/database';
import { MarketSource } from '@repo/database';
import { logger } from '../utils/logger.js';
import type { 
  LeaderboardFilters, 
  LeaderboardResponse, 
  TraderResponse 
} from '../types/index.js';

export class LeaderboardService {
  async getLeaderboard(
    filters: LeaderboardFilters,
    page: number,
    limit: number
  ): Promise<{ leaderboard: LeaderboardResponse[]; total: number }> {
    try {
      const where: any = {
        isPublic: true,
      };

      if (filters.source) {
        where.source = filters.source;
      }

      // Apply timeframe filter
      if (filters.timeframe && filters.timeframe !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (filters.timeframe) {
          case 'day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0);
            break;
        }

        where.lastTradeAt = {
          gte: startDate,
        };
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

      // Calculate aggregated stats
      const stats = await this.calculateLeaderboardStats(where);

      const leaderboardResponse: LeaderboardResponse = {
        source: filters.source || MarketSource.POLYMARKET, // Default to POLYMARKET for aggregated
        traders: traderResponses,
        totalTraders: total,
        totalVolume: stats.totalVolume,
        totalTrades: stats.totalTrades,
        avgPnl: stats.avgPnl,
        snapshotDate: new Date().toISOString(),
      };

      logger.debug('Leaderboard retrieved', { 
        count: traderResponses.length, 
        total, 
        filters 
      });

      return { leaderboard: [leaderboardResponse], total: 1 };
    } catch (error) {
      logger.error('Failed to get leaderboard', {
        filters,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getLeaderboardBySource(
    source: MarketSource,
    filters: Omit<LeaderboardFilters, 'source'>,
    page: number,
    limit: number
  ): Promise<{ leaderboard: LeaderboardResponse; total: number }> {
    try {
      const where: any = {
        source,
        isPublic: true,
      };

      // Apply timeframe filter
      if (filters.timeframe && filters.timeframe !== 'all') {
        const now = new Date();
        let startDate: Date;

        switch (filters.timeframe) {
          case 'day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0);
            break;
        }

        where.lastTradeAt = {
          gte: startDate,
        };
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

      // Calculate stats for this source
      const stats = await this.calculateLeaderboardStats(where);

      const leaderboardResponse: LeaderboardResponse = {
        source,
        traders: traderResponses,
        totalTraders: total,
        totalVolume: stats.totalVolume,
        totalTrades: stats.totalTrades,
        avgPnl: stats.avgPnl,
        snapshotDate: new Date().toISOString(),
      };

      logger.debug('Source leaderboard retrieved', { 
        source,
        count: traderResponses.length, 
        total, 
        filters 
      });

      return { leaderboard: leaderboardResponse, total: 1 };
    } catch (error) {
      logger.error('Failed to get source leaderboard', {
        source,
        filters,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getLeaderboardSnapshots(
    source?: MarketSource,
    page: number = 1,
    limit: number = 20
  ): Promise<{ snapshots: any[]; total: number }> {
    try {
      const where: any = {};
      if (source) {
        where.source = source;
      }

      const [snapshots, total] = await Promise.all([
        prisma.leaderboardSnapshot.findMany({
          where,
          orderBy: { snapshotDate: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            topTrader: true,
          },
        }),
        prisma.leaderboardSnapshot.count({ where }),
      ]);

      const snapshotResponses = snapshots.map(snapshot => ({
        id: snapshot.id,
        source: snapshot.source,
        snapshotDate: snapshot.snapshotDate.toISOString(),
        topTrader: {
          id: snapshot.topTrader.id,
          username: snapshot.topTrader.username,
          displayName: snapshot.topTrader.displayName,
          totalPnl: parseFloat(snapshot.topTraderPnl.toString()),
          totalVolume: parseFloat(snapshot.topTraderVolume.toString()),
        },
        totalTraders: snapshot.totalTraders,
        totalVolume: parseFloat(snapshot.totalVolume.toString()),
        totalTrades: snapshot.totalTrades,
        avgPnl: parseFloat(snapshot.avgPnl.toString()),
      }));

      logger.debug('Leaderboard snapshots retrieved', { 
        count: snapshotResponses.length, 
        total,
        source 
      });

      return { snapshots: snapshotResponses, total };
    } catch (error) {
      logger.error('Failed to get leaderboard snapshots', {
        source,
        page,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async calculateLeaderboardStats(where: any): Promise<{
    totalVolume: number;
    totalTrades: number;
    avgPnl: number;
  }> {
    try {
      const stats = await prisma.trader.aggregate({
        where,
        _sum: {
          totalVolume: true,
          totalTrades: true,
          totalPnl: true,
        },
        _count: {
          id: true,
        },
      });

      const totalTraders = stats._count.id;
      const avgPnl = totalTraders > 0 && stats._sum.totalPnl 
        ? parseFloat(stats._sum.totalPnl.toString()) / totalTraders 
        : 0;

      return {
        totalVolume: stats._sum.totalVolume ? parseFloat(stats._sum.totalVolume.toString()) : 0,
        totalTrades: stats._sum.totalTrades || 0,
        avgPnl,
      };
    } catch (error) {
      logger.error('Failed to calculate leaderboard stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalVolume: 0,
        totalTrades: 0,
        avgPnl: 0,
      };
    }
  }
}

export const leaderboardService = new LeaderboardService();
