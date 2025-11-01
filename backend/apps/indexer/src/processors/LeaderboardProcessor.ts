import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { NormalizedTrader } from '../normalizers/types.js';
import { MarketSource, Prisma } from '@repo/database';

/**
 * Process and store leaderboard data
 */
export class LeaderboardProcessor {
  /**
   * Process a single trader
   */
  async processTrader(trader: NormalizedTrader): Promise<string | null> {
    try {
      const existing = await db.trader.findUnique({
        where: {
          source_sourceTraderId: {
            source: trader.source,
            sourceTraderId: trader.sourceTraderId,
          },
        },
      });

      if (existing) {
        // Update existing trader
        const updated = await db.trader.update({
          where: { id: existing.id },
          data: {
            username: trader.username || existing.username,
            displayName: trader.displayName || existing.displayName,
            profileImageUrl: trader.profileImageUrl || existing.profileImageUrl,
            totalTrades: trader.totalTrades,
            totalVolume: trader.totalVolume.toString(),
            totalPnl: trader.totalPnl.toString(),
            winRate: trader.winRate?.toString(),
            avgReturn: trader.avgReturn?.toString(),
            currentRank: trader.currentRank,
            bestRank: trader.bestRank || existing.bestRank,
            rankChange: trader.rankChange,
            lastActiveAt: trader.lastActiveAt,
            firstTradeAt: trader.firstTradeAt || existing.firstTradeAt,
            lastTradeAt: trader.lastTradeAt,
            sourceData: trader.sourceData as Prisma.JsonValue,
            updatedAt: new Date(),
          },
        });

        logger.debug('Updated trader', { traderId: updated.id });
        return updated.id;
      } else {
        // Create new trader
        const newTrader = await db.trader.create({
          data: {
            source: trader.source,
            sourceTraderId: trader.sourceTraderId,
            username: trader.username,
            displayName: trader.displayName,
            profileImageUrl: trader.profileImageUrl,
            totalTrades: trader.totalTrades,
            totalVolume: trader.totalVolume.toString(),
            totalPnl: trader.totalPnl.toString(),
            winRate: trader.winRate?.toString(),
            avgReturn: trader.avgReturn?.toString(),
            currentRank: trader.currentRank,
            bestRank: trader.bestRank,
            rankChange: trader.rankChange,
            lastActiveAt: trader.lastActiveAt,
            firstTradeAt: trader.firstTradeAt,
            lastTradeAt: trader.lastTradeAt,
            sourceData: trader.sourceData as Prisma.JsonValue,
          },
        });

        logger.info('Created new trader', { traderId: newTrader.id, source: trader.source });
        return newTrader.id;
      }
    } catch (error) {
      logger.error('Error processing trader', { trader: trader.sourceTraderId, error });
      return null;
    }
  }

  /**
   * Process multiple traders in batch
   */
  async processTraders(traders: NormalizedTrader[]): Promise<number> {
    let successCount = 0;

    for (const trader of traders) {
      const result = await this.processTrader(trader);
      if (result) {
        successCount++;
      }
    }

    logger.info(`Processed ${successCount}/${traders.length} traders`);
    return successCount;
  }

  /**
   * Create leaderboard snapshot
   */
  async createLeaderboardSnapshot(source: MarketSource): Promise<string | null> {
    try {
      // Find top trader
      const topTrader = await db.trader.findFirst({
        where: {
          source,
          currentRank: 1,
        },
        orderBy: {
          totalPnl: 'desc',
        },
      });

      if (!topTrader) {
        logger.warn('No top trader found for snapshot', { source });
        return null;
      }

      // Get aggregate stats
      const stats = await db.trader.aggregate({
        where: { source },
        _count: { id: true },
        _sum: {
          totalVolume: true,
          totalTrades: true,
        },
        _avg: {
          totalPnl: true,
        },
      });

      const snapshot = await db.leaderboardSnapshot.create({
        data: {
          source,
          topTraderId: topTrader.id,
          topTraderPnl: topTrader.totalPnl,
          topTraderVolume: topTrader.totalVolume,
          totalTraders: stats._count.id,
          totalVolume: stats._sum.totalVolume?.toString() || '0',
          totalTrades: stats._sum.totalTrades || 0,
          avgPnl: stats._avg.totalPnl?.toString() || '0',
          snapshotDate: new Date(),
        },
      });

      logger.info('Created leaderboard snapshot', { source, snapshotId: snapshot.id });
      return snapshot.id;
    } catch (error) {
      logger.error('Error creating leaderboard snapshot', { source, error });
      return null;
    }
  }
}

