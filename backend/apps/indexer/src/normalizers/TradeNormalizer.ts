import { MarketSource, TradeSide } from '@repo/database';
import { logger } from '../utils/logger.js';
import { NormalizedTrade } from './types.js';

/**
 * Normalize trade data from different sources
 */
export class TradeNormalizer {
  /**
   * Normalize Polymarket trade data
   */
  static normalizePolymarketTrade(trade: any): NormalizedTrade | null {
    try {
      // Polymarket trade format varies by endpoint
      return {
        source: MarketSource.POLYMARKET,
        sourceTradeId: trade.id || trade.trade_id || `${trade.timestamp}-${trade.market}`,
        sourceMarketId: trade.market || trade.condition_id,
        traderWallet: trade.maker || trade.trader,
        side: trade.side === 'BUY' || trade.side === 0 ? TradeSide.BUY : TradeSide.SELL,
        outcomeIndex: trade.outcome_index,
        quantity: parseFloat(trade.size || trade.amount || '0'),
        price: parseFloat(trade.price || '0'),
        totalValue: parseFloat(trade.size || '0') * parseFloat(trade.price || '0'),
        executedAt: trade.timestamp ? new Date(trade.timestamp) : new Date(),
        sourceData: trade,
      };
    } catch (error) {
      logger.error('Error normalizing Polymarket trade', { error });
      return null;
    }
  }

  /**
   * Normalize Kalshi trade data
   */
  static normalizeKalshiTrade(trade: any): NormalizedTrade | null {
    try {
      return {
        source: MarketSource.KALSHI,
        sourceTradeId: trade.trade_id || trade.id,
        sourceMarketId: trade.ticker,
        traderId: trade.taker_member_id || trade.maker_member_id,
        side: trade.taker_side === 'yes' || trade.side === 'yes' ? TradeSide.BUY : TradeSide.SELL,
        outcomeIndex: trade.taker_side === 'yes' ? 0 : 1,
        quantity: trade.count || trade.quantity || 0,
        price: (trade.yes_price || trade.price || 0) / 100, // Convert cents to dollars
        totalValue: (trade.count || 0) * ((trade.yes_price || trade.price || 0) / 100),
        executedAt: trade.created_time ? new Date(trade.created_time) : new Date(),
        sourceData: trade,
      };
    } catch (error) {
      logger.error('Error normalizing Kalshi trade', { error });
      return null;
    }
  }

  /**
   * Normalize trade from any source
   */
  static normalize(source: MarketSource, trade: any): NormalizedTrade | null {
    switch (source) {
      case MarketSource.POLYMARKET:
        return this.normalizePolymarketTrade(trade);
      case MarketSource.KALSHI:
        return this.normalizeKalshiTrade(trade);
      default:
        logger.warn('Unsupported trade source', { source });
        return null;
    }
  }
}

