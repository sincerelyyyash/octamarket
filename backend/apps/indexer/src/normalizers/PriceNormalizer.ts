import { MarketSource } from '@repo/database';
import { logger } from '../utils/logger.js';
import { NormalizedPrice } from './types.js';

/**
 * Normalize price data from different sources
 */
export class PriceNormalizer {
  /**
   * Normalize Polymarket price data
   */
  static normalizePolymarketPrice(data: {
    marketId: string;
    outcomeIndex?: number;
    price: number;
    volume?: number;
    liquidity?: number;
    timestamp?: Date;
  }): NormalizedPrice | null {
    try {
      return {
        marketId: data.marketId,
        source: MarketSource.POLYMARKET,
        outcomeIndex: data.outcomeIndex,
        price: data.price,
        volume: data.volume,
        liquidity: data.liquidity,
        timestamp: data.timestamp || new Date(),
      };
    } catch (error) {
      logger.error('Error normalizing Polymarket price', { error });
      return null;
    }
  }

  /**
   * Normalize Kalshi price data
   */
  static normalizeKalshiPrice(data: {
    ticker: string;
    outcomeIndex?: number;
    price: number; // Already in 0-1 range (cents to dollars conversion done)
    volume?: number;
    timestamp?: Date;
  }): NormalizedPrice | null {
    try {
      return {
        marketId: data.ticker,
        source: MarketSource.KALSHI,
        outcomeIndex: data.outcomeIndex,
        price: data.price,
        volume: data.volume,
        timestamp: data.timestamp || new Date(),
      };
    } catch (error) {
      logger.error('Error normalizing Kalshi price', { error });
      return null;
    }
  }

  /**
   * Normalize price from any source
   */
  static normalize(source: MarketSource, data: any): NormalizedPrice | null {
    switch (source) {
      case MarketSource.POLYMARKET:
        return this.normalizePolymarketPrice(data);
      case MarketSource.KALSHI:
        return this.normalizeKalshiPrice(data);
      default:
        logger.warn('Unsupported price source', { source });
        return null;
    }
  }
}

