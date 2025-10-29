import { MarketSource } from '@repo/database';
import { TradeSide, TradeStatus } from '../types/index.js';
import type { 
  TraderData, 
  TradeData, 
  NormalizedTrader, 
  NormalizedTrade, 
  NormalizationError 
} from '../types/index.js';
import { NormalizationError as NormalizationErrorClass } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class LeaderboardNormalizer {
  private readonly logger = logger.child({ component: 'leaderboardNormalizer' });

  /**
   * Normalize trader data from different sources into canonical format
   */
  async normalizeTrader(
    sourceData: any,
    source: MarketSource,
    sourceTraderId: string
  ): Promise<NormalizedTrader> {
    try {
      let traderData: TraderData;
      let confidence = 1.0;

      switch (source) {
        case MarketSource.POLYMARKET:
          traderData = this.normalizePolymarketTrader(sourceData);
          break;
        case MarketSource.KALSHI:
          traderData = this.normalizeKalshiTrader(sourceData);
          break;
        default:
          throw new NormalizationErrorClass(`Unsupported source for trader normalization: ${source}`, source);
      }

      return {
        sourceTraderId,
        source,
        traderData,
        confidence,
      };
    } catch (error) {
      this.logger.error('Failed to normalize trader', {
        source,
        sourceTraderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new NormalizationErrorClass(
        `Failed to normalize trader from ${source}`,
        source,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Normalize trade data from different sources into canonical format
   */
  async normalizeTrade(
    sourceData: any,
    source: MarketSource,
    sourceTradeId: string,
    traderId: string
  ): Promise<NormalizedTrade> {
    try {
      let tradeData: TradeData;
      let confidence = 1.0;

      switch (source) {
        case MarketSource.POLYMARKET:
          tradeData = this.normalizePolymarketTrade(sourceData, traderId);
          break;
        case MarketSource.KALSHI:
          tradeData = this.normalizeKalshiTrade(sourceData, traderId);
          break;
        default:
          throw new NormalizationErrorClass(`Unsupported source for trade normalization: ${source}`, source);
      }

      return {
        sourceTradeId,
        source,
        tradeData,
        confidence,
      };
    } catch (error) {
      this.logger.error('Failed to normalize trade', {
        source,
        sourceTradeId,
        traderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new NormalizationErrorClass(
        `Failed to normalize trade from ${source}`,
        source,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private normalizePolymarketTrader(data: any): TraderData {
    return {
      id: data.id || data.user_id,
      source: MarketSource.POLYMARKET,
      sourceTraderId: data.id || data.user_id,
      username: data.username || data.handle,
      displayName: data.display_name || data.name || data.username,
      profileImageUrl: data.profile_image_url || data.avatar_url,
      
      // Performance metrics
      totalTrades: parseInt(data.total_trades || '0'),
      totalVolume: parseFloat(data.total_volume || '0'),
      totalPnl: parseFloat(data.total_pnl || '0'),
      winRate: data.win_rate ? parseFloat(data.win_rate) : undefined,
      avgReturn: data.avg_return ? parseFloat(data.avg_return) : undefined,
      
      // Rankings
      currentRank: data.current_rank ? parseInt(data.current_rank) : undefined,
      bestRank: data.best_rank ? parseInt(data.best_rank) : undefined,
      rankChange: data.rank_change ? parseInt(data.rank_change) : undefined,
      
      // Activity tracking
      lastActiveAt: data.last_active_at ? new Date(data.last_active_at) : undefined,
      firstTradeAt: data.first_trade_at ? new Date(data.first_trade_at) : undefined,
      lastTradeAt: data.last_trade_at ? new Date(data.last_trade_at) : undefined,
      
      // Copy trading settings
      isPublic: data.is_public !== false, // Default to true
      allowCopyTrading: data.allow_copy_trading === true,
      maxFollowers: data.max_followers ? parseInt(data.max_followers) : undefined,
      
      // Metadata
      sourceData: data,
    };
  }

  private normalizeKalshiTrader(data: any): TraderData {
    return {
      id: data.user_id || data.id,
      source: MarketSource.KALSHI,
      sourceTraderId: data.user_id || data.id,
      username: data.username || data.handle,
      displayName: data.display_name || data.name || data.username,
      profileImageUrl: data.profile_image_url || data.avatar_url,
      
      // Performance metrics
      totalTrades: parseInt(data.total_trades || '0'),
      totalVolume: parseFloat(data.total_volume || '0'),
      totalPnl: parseFloat(data.total_pnl || '0'),
      winRate: data.win_rate ? parseFloat(data.win_rate) : undefined,
      avgReturn: data.avg_return ? parseFloat(data.avg_return) : undefined,
      
      // Rankings
      currentRank: data.current_rank ? parseInt(data.current_rank) : undefined,
      bestRank: data.best_rank ? parseInt(data.best_rank) : undefined,
      rankChange: data.rank_change ? parseInt(data.rank_change) : undefined,
      
      // Activity tracking
      lastActiveAt: data.last_active_at ? new Date(data.last_active_at) : undefined,
      firstTradeAt: data.first_trade_at ? new Date(data.first_trade_at) : undefined,
      lastTradeAt: data.last_trade_at ? new Date(data.last_trade_at) : undefined,
      
      // Copy trading settings
      isPublic: data.is_public !== false, // Default to true
      allowCopyTrading: data.allow_copy_trading === true,
      maxFollowers: data.max_followers ? parseInt(data.max_followers) : undefined,
      
      // Metadata
      sourceData: data,
    };
  }

  private normalizePolymarketTrade(data: any, traderId: string): TradeData {
    return {
      id: data.id || `${traderId}_${Date.now()}`,
      traderId,
      source: MarketSource.POLYMARKET,
      sourceTradeId: data.id || `${traderId}_${Date.now()}`,
      
      // Market information
      marketId: undefined, // Will be resolved later
      sourceMarketId: data.market_id || data.condition_id,
      
      // Trade details
      side: this.mapPolymarketTradeSide(data.side || data.position),
      outcomeIndex: data.outcome_index,
      quantity: parseFloat(data.amount || '0'),
      price: parseFloat(data.price || '0'),
      totalValue: parseFloat(data.total_value || data.amount || '0'),
      
      // Trade status
      status: this.mapPolymarketTradeStatus(data.status),
      executedAt: new Date(data.timestamp || data.created_at),
      
      // PnL tracking
      realizedPnl: data.realized_pnl ? parseFloat(data.realized_pnl) : undefined,
      unrealizedPnl: data.unrealized_pnl ? parseFloat(data.unrealized_pnl) : undefined,
      
      // Copy trading metadata
      isCopyTrade: data.is_copy_trade === true,
      originalTradeId: data.original_trade_id,
      copiedByTraderId: data.copied_by_trader_id,
      
      // Metadata
      sourceData: data,
    };
  }

  private normalizeKalshiTrade(data: any, traderId: string): TradeData {
    return {
      id: data.trade_id || `${traderId}_${Date.now()}`,
      traderId,
      source: MarketSource.KALSHI,
      sourceTradeId: data.trade_id || `${traderId}_${Date.now()}`,
      
      // Market information
      marketId: undefined, // Will be resolved later
      sourceMarketId: data.market_ticker || data.market_id,
      
      // Trade details
      side: this.mapKalshiTradeSide(data.side || data.position),
      outcomeIndex: data.outcome_index,
      quantity: parseFloat(data.amount || '0'),
      price: parseFloat(data.price || '0'),
      totalValue: parseFloat(data.total_value || data.amount || '0'),
      
      // Trade status
      status: this.mapKalshiTradeStatus(data.status),
      executedAt: new Date(data.timestamp || data.created_at),
      
      // PnL tracking
      realizedPnl: data.realized_pnl ? parseFloat(data.realized_pnl) : undefined,
      unrealizedPnl: data.unrealized_pnl ? parseFloat(data.unrealized_pnl) : undefined,
      
      // Copy trading metadata
      isCopyTrade: data.is_copy_trade === true,
      originalTradeId: data.original_trade_id,
      copiedByTraderId: data.copied_by_trader_id,
      
      // Metadata
      sourceData: data,
    };
  }

  private mapPolymarketTradeSide(side: string): TradeSide {
    switch (side?.toLowerCase()) {
      case 'yes':
      case 'buy':
      case 'long':
        return TradeSide.BUY;
      case 'no':
      case 'sell':
      case 'short':
        return TradeSide.SELL;
      default:
        return TradeSide.BUY; // Default to buy
    }
  }

  private mapKalshiTradeSide(side: string): TradeSide {
    switch (side?.toLowerCase()) {
      case 'yes':
      case 'buy':
      case 'long':
        return TradeSide.BUY;
      case 'no':
      case 'sell':
      case 'short':
        return TradeSide.SELL;
      default:
        return TradeSide.BUY; // Default to buy
    }
  }

  private mapPolymarketTradeStatus(status: string): TradeStatus {
    switch (status?.toLowerCase()) {
      case 'executed':
      case 'filled':
      case 'completed':
        return TradeStatus.EXECUTED;
      case 'pending':
      case 'open':
        return TradeStatus.PENDING;
      case 'cancelled':
      case 'canceled':
        return TradeStatus.CANCELLED;
      case 'failed':
      case 'error':
        return TradeStatus.FAILED;
      default:
        return TradeStatus.EXECUTED; // Default to executed
    }
  }

  private mapKalshiTradeStatus(status: string): TradeStatus {
    switch (status?.toLowerCase()) {
      case 'executed':
      case 'filled':
      case 'completed':
        return TradeStatus.EXECUTED;
      case 'pending':
      case 'open':
        return TradeStatus.PENDING;
      case 'cancelled':
      case 'canceled':
        return TradeStatus.CANCELLED;
      case 'failed':
      case 'error':
        return TradeStatus.FAILED;
      default:
        return TradeStatus.EXECUTED; // Default to executed
    }
  }

  /**
   * Calculate trader performance metrics from trade history
   */
  calculateTraderMetrics(trades: TradeData[]): {
    totalTrades: number;
    totalVolume: number;
    totalPnl: number;
    winRate: number;
    avgReturn: number;
  } {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        totalVolume: 0,
        totalPnl: 0,
        winRate: 0,
        avgReturn: 0,
      };
    }

    const totalTrades = trades.length;
    const totalVolume = trades.reduce((sum, trade) => sum + trade.totalValue, 0);
    const totalPnl = trades.reduce((sum, trade) => sum + (trade.realizedPnl || 0), 0);
    
    // Calculate win rate based on profitable trades
    const profitableTrades = trades.filter(trade => (trade.realizedPnl || 0) > 0).length;
    const winRate = totalTrades > 0 ? profitableTrades / totalTrades : 0;
    
    // Calculate average return
    const avgReturn = totalVolume > 0 ? totalPnl / totalVolume : 0;

    return {
      totalTrades,
      totalVolume,
      totalPnl,
      winRate,
      avgReturn,
    };
  }

  /**
   * Rank traders based on performance metrics
   */
  rankTraders(traders: TraderData[]): TraderData[] {
    return traders
      .sort((a, b) => {
        // Primary sort by total PnL
        if (b.totalPnl !== a.totalPnl) {
          return b.totalPnl - a.totalPnl;
        }
        // Secondary sort by total volume
        if (b.totalVolume !== a.totalVolume) {
          return b.totalVolume - a.totalVolume;
        }
        // Tertiary sort by win rate
        if (b.winRate !== a.winRate) {
          return (b.winRate || 0) - (a.winRate || 0);
        }
        return 0;
      })
      .map((trader, index) => ({
        ...trader,
        currentRank: index + 1,
      }));
  }
}
