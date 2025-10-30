import { prisma } from '@repo/database';
import { MarketSource, MarketStatus } from '@repo/database';
import { logger } from '../utils/logger';
import type { 
  PlatformStatsResponse, 
  MarketStatsResponse, 
  SourceStatsResponse 
} from '../types/index.js';

export class StatsService {
  async getPlatformStats(): Promise<PlatformStatsResponse> {
    try {
      const [
        marketStats,
        traderStats,
        tradeStats,
        volumeStats,
      ] = await Promise.all([
        prisma.market.aggregate({
          _count: { id: true },
        }),
        prisma.trader.aggregate({
          _count: { id: true },
          _sum: { totalPnl: true },
        }),
        prisma.trade.aggregate({
          _count: { id: true },
        }),
        prisma.trade.aggregate({
          _sum: { totalValue: true },
        }),
      ]);

      const activeMarkets = await prisma.market.count({
        where: { status: MarketStatus.ACTIVE },
      });

      const avgPnl = traderStats._count.id > 0 && traderStats._sum.totalPnl
        ? parseFloat(traderStats._sum.totalPnl.toString()) / traderStats._count.id
        : 0;

      const stats: PlatformStatsResponse = {
        totalMarkets: marketStats._count.id,
        activeMarkets,
        totalTraders: traderStats._count.id,
        totalVolume: volumeStats._sum.totalValue ? parseFloat(volumeStats._sum.totalValue.toString()) : 0,
        totalTrades: tradeStats._count.id,
        avgPnl,
      };

      logger.debug('Platform stats retrieved', stats);

      return stats;
    } catch (error) {
      logger.error('Failed to get platform stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getMarketStats(): Promise<MarketStatsResponse> {
    try {
      const [
        categoryStats,
        sourceStats,
        statusStats,
        topPerformingMarkets,
      ] = await Promise.all([
        this.getMarketStatsByCategory(),
        this.getMarketStatsBySource(),
        this.getMarketStatsByStatus(),
        this.getTopPerformingMarkets(),
      ]);

      const stats: MarketStatsResponse = {
        byCategory: categoryStats,
        bySource: sourceStats,
        byStatus: statusStats,
        topPerforming: topPerformingMarkets,
      };

      logger.debug('Market stats retrieved', stats);

      return stats;
    } catch (error) {
      logger.error('Failed to get market stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getSourceStats(source?: MarketSource): Promise<SourceStatsResponse[]> {
    try {
      const sources = source ? [source] : Object.values(MarketSource);
      const statsPromises = sources.map(async (src) => {
        const [
          marketStats,
          traderStats,
          tradeStats,
          volumeStats,
        ] = await Promise.all([
          prisma.market.count({
            where: {
              sourceMarkets: {
                some: { source: src },
              },
            },
          }),
          prisma.trader.count({
            where: { source: src },
          }),
          prisma.trade.count({
            where: { source: src },
          }),
          prisma.trade.aggregate({
            where: { source: src },
            _sum: { totalValue: true },
          }),
        ]);

        const pnlStats = await prisma.trader.aggregate({
          where: { source: src },
          _sum: { totalPnl: true },
        });

        const avgPnl = traderStats > 0 && pnlStats._sum.totalPnl
          ? parseFloat(pnlStats._sum.totalPnl.toString()) / traderStats
          : 0;

        return {
          source: src,
          totalMarkets: marketStats,
          totalTraders: traderStats,
          totalVolume: volumeStats._sum.totalValue ? parseFloat(volumeStats._sum.totalValue.toString()) : 0,
          totalTrades: tradeStats,
          avgPnl,
        };
      });

      const stats = await Promise.all(statsPromises);

      logger.debug('Source stats retrieved', { count: stats.length, source });

      return stats;
    } catch (error) {
      logger.error('Failed to get source stats', {
        source,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async getMarketStatsByCategory(): Promise<Record<string, number>> {
    try {
      const markets = await prisma.market.findMany({
        select: { category: true },
        where: {
          category: { not: null },
        },
      });

      const categoryCounts: Record<string, number> = {};
      markets.forEach(market => {
        if (market.category) {
          categoryCounts[market.category] = (categoryCounts[market.category] || 0) + 1;
        }
      });

      return categoryCounts;
    } catch (error) {
      logger.error('Failed to get market stats by category', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  private async getMarketStatsBySource(): Promise<Record<MarketSource, number>> {
    try {
      const sourceMarkets = await prisma.sourceMarket.groupBy({
        by: ['source'],
        _count: { id: true },
      });

      const sourceCounts: Record<MarketSource, number> = {} as Record<MarketSource, number>;
      sourceMarkets.forEach(item => {
        sourceCounts[item.source] = item._count.id;
      });

      return sourceCounts;
    } catch (error) {
      logger.error('Failed to get market stats by source', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {} as Record<MarketSource, number>;
    }
  }

  private async getMarketStatsByStatus(): Promise<Record<MarketStatus, number>> {
    try {
      const statusCounts = await prisma.market.groupBy({
        by: ['status'],
        _count: { id: true },
      });

      const stats: Record<MarketStatus, number> = {} as Record<MarketStatus, number>;
      statusCounts.forEach(item => {
        stats[item.status] = item._count.id;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get market stats by status', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {} as Record<MarketStatus, number>;
    }
  }

  private async getTopPerformingMarkets(): Promise<any[]> {
    try {
      const markets = await prisma.market.findMany({
        where: {
          status: MarketStatus.ACTIVE,
          OR: [
            { totalVolume: { gt: 0 } },
            { participantCount: { gt: 0 } },
          ],
        },
        orderBy: [
          { totalVolume: 'desc' },
          { participantCount: 'desc' },
        ],
        take: 10,
        include: {
          outcomes: {
            orderBy: { index: 'asc' },
            take: 1,
          },
          sourceMarkets: {
            take: 1,
          },
        },
      });

      return markets.map(market => ({
        id: market.id,
        title: market.title,
        category: market.category,
        status: market.status,
        totalVolume: market.totalVolume ? parseFloat(market.totalVolume.toString()) : 0,
        participantCount: market.participantCount || 0,
        endDate: market.endDate?.toISOString(),
        currentPrice: market.outcomes[0]?.currentPrice ? parseFloat(market.outcomes[0].currentPrice.toString()) : undefined,
        source: market.sourceMarkets[0]?.source,
      }));
    } catch (error) {
      logger.error('Failed to get top performing markets', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

export const statsService = new StatsService();
