import { MarketSource } from '@repo/database';
import { logger } from '../utils/logger.js';
import { NormalizedTrader } from './types.js';
import { PolymarketLeaderboardEntry } from '../collectors/types.js';

/**
 * Normalize leaderboard/trader data from different sources
 */
export class LeaderboardNormalizer {
  /**
   * Normalize Polymarket leaderboard entry
   */
  static normalizePolymarketTrader(entry: PolymarketLeaderboardEntry): NormalizedTrader | null {
    try {
      const rank = typeof entry.rank === 'string' ? parseInt(entry.rank) : entry.rank;

      return {
        source: MarketSource.POLYMARKET,
        sourceTraderId: entry.proxyWallet,
        username: entry.userName,
        displayName: entry.userName,
        profileImageUrl: entry.profileImage,
        totalTrades: 0, // Not provided in leaderboard
        totalVolume: entry.vol,
        totalPnl: entry.pnl,
        winRate: undefined,
        avgReturn: undefined,
        currentRank: rank,
        bestRank: undefined,
        rankChange: 0,
        lastActiveAt: new Date(), // Assume current if on leaderboard
        sourceData: entry,
      };
    } catch (error) {
      logger.error('Error normalizing Polymarket trader', { error });
      return null;
    }
  }

  /**
   * Normalize Kalshi trader data
   * Note: Kalshi doesn't have a public leaderboard API yet
   */
  static normalizeKalshiTrader(trader: any): NormalizedTrader | null {
    try {
      return {
        source: MarketSource.KALSHI,
        sourceTraderId: trader.member_id || trader.id,
        username: trader.username,
        displayName: trader.display_name,
        profileImageUrl: trader.avatar_url,
        totalTrades: trader.total_trades || 0,
        totalVolume: trader.total_volume || 0,
        totalPnl: trader.total_pnl || 0,
        winRate: trader.win_rate,
        avgReturn: trader.avg_return,
        currentRank: trader.rank,
        bestRank: trader.best_rank,
        rankChange: trader.rank_change || 0,
        lastActiveAt: trader.last_active_at ? new Date(trader.last_active_at) : undefined,
        sourceData: trader,
      };
    } catch (error) {
      logger.error('Error normalizing Kalshi trader', { error });
      return null;
    }
  }

  /**
   * Normalize trader from any source
   */
  static normalize(source: MarketSource, trader: any): NormalizedTrader | null {
    switch (source) {
      case MarketSource.POLYMARKET:
        return this.normalizePolymarketTrader(trader as PolymarketLeaderboardEntry);
      case MarketSource.KALSHI:
        return this.normalizeKalshiTrader(trader);
      default:
        logger.warn('Unsupported trader source', { source });
        return null;
    }
  }
}

