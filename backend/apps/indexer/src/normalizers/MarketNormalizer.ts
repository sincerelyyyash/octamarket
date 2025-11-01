import { MarketSource, MarketStatus } from '@repo/database';
import { logger } from '../utils/logger.js';
import { NormalizedMarket, NormalizedOutcome } from './types.js';
import { PolymarketMarket, KalshiMarket } from '../collectors/types.js';

/**
 * Normalize market data from different sources
 */
export class MarketNormalizer {
  /**
   * Normalize Polymarket market data
   */
  static normalizePolymarketMarket(market: PolymarketMarket): NormalizedMarket | null {
    try {
      // Parse outcomes
      const outcomes: NormalizedOutcome[] = [];
      const outcomesList = Array.isArray(market.outcomes) ? market.outcomes : [];
      const pricesList = Array.isArray(market.outcomePrices) 
        ? market.outcomePrices.map(p => parseFloat(p)) 
        : [];

      outcomesList.forEach((outcome, index) => {
        outcomes.push({
          title: outcome,
          index,
          currentPrice: pricesList[index] || undefined,
          currentVolume: undefined, // Not provided per outcome
          currentLiquidity: undefined,
        });
      });

      // Determine market status
      let status: MarketStatus = MarketStatus.ACTIVE;
      if (market.closed) {
        status = MarketStatus.RESOLVED;
      } else if (!market.active) {
        status = MarketStatus.PAUSED;
      } else if (market.archived) {
        status = MarketStatus.CANCELLED;
      }

      // Calculate volume tier for polling priority
      const volumeTier = this.calculateVolumeTier(market.volumeNum || 0);

      // Parse CLOB token IDs
      let clobTokenIds: string[] | undefined;
      if (market.clobTokenIds) {
        try {
          clobTokenIds = JSON.parse(market.clobTokenIds);
        } catch {
          // If parsing fails, treat as single token ID
          clobTokenIds = [market.clobTokenIds];
        }
      }

      return {
        title: market.question,
        description: market.description,
        category: market.tags?.[0] || undefined,
        tags: market.tags,
        endDate: market.endDate ? new Date(market.endDate) : undefined,
        status,
        totalVolume: market.volumeNum || parseFloat(market.volume || '0'),
        totalLiquidity: market.liquidityNum || parseFloat(market.liquidity || '0'),
        
        source: MarketSource.POLYMARKET,
        sourceMarketId: market.conditionId,
        tokenId: market.id,
        clobTokenIds,
        volumeTier,
        sourceData: market,
        
        outcomes,
      };
    } catch (error) {
      logger.error('Error normalizing Polymarket market', { market: market.id, error });
      return null;
    }
  }

  /**
   * Normalize Kalshi market data
   */
  static normalizeKalshiMarket(market: KalshiMarket): NormalizedMarket | null {
    try {
      // Kalshi markets are binary (Yes/No)
      const outcomes: NormalizedOutcome[] = [
        {
          title: 'Yes',
          index: 0,
          currentPrice: market.yes_ask ? market.yes_ask / 100 : undefined,
        },
        {
          title: 'No',
          index: 1,
          currentPrice: market.no_ask ? market.no_ask / 100 : undefined,
        },
      ];

      // Determine market status
      let status: MarketStatus = MarketStatus.ACTIVE;
      if (market.status === 'closed' || market.status === 'settled') {
        status = MarketStatus.RESOLVED;
      } else if (market.status === 'paused') {
        status = MarketStatus.PAUSED;
      } else if (market.status === 'cancelled') {
        status = MarketStatus.CANCELLED;
      }

      // Calculate volume tier
      const volumeTier = this.calculateVolumeTier(market.volume || 0);

      return {
        title: market.title,
        description: market.subtitle,
        category: market.event_ticker,
        tags: market.event_ticker ? [market.event_ticker] : undefined,
        endDate: market.close_time ? new Date(market.close_time) : undefined,
        status,
        totalVolume: market.volume,
        totalLiquidity: market.open_interest,
        
        source: MarketSource.KALSHI,
        sourceMarketId: market.ticker,
        tokenId: market.ticker,
        volumeTier,
        sourceData: market,
        
        outcomes,
      };
    } catch (error) {
      logger.error('Error normalizing Kalshi market', { market: market.ticker, error });
      return null;
    }
  }

  /**
   * Calculate volume tier for polling priority
   * HIGH: > $100k
   * MEDIUM: $10k - $100k
   * LOW: < $10k
   */
  private static calculateVolumeTier(volume: number): string {
    if (volume > 100000) return 'HIGH';
    if (volume > 10000) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Normalize market from any source
   */
  static normalize(source: MarketSource, market: any): NormalizedMarket | null {
    switch (source) {
      case MarketSource.POLYMARKET:
        return this.normalizePolymarketMarket(market as PolymarketMarket);
      case MarketSource.KALSHI:
        return this.normalizeKalshiMarket(market as KalshiMarket);
      default:
        logger.warn('Unsupported market source', { source });
        return null;
    }
  }
}

