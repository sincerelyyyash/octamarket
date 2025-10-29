import axios from 'axios';
import { MarketSource } from '@repo/database';
import { TradeSide, TradeStatus } from '../types/index.js';
import type { LeaderboardDataSource, LeaderboardData, TradeData, SourceConfig, TraderData, NormalizedTrader, NormalizedTrade } from '../types/index.js';
import { LeaderboardError } from '../types/index.js';
import { createSourceLogger } from '../utils/logger.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { DatabaseManager } from '../core/databaseManager.js';

export class PolymarketLeaderboardSource implements LeaderboardDataSource {
  readonly name = MarketSource.POLYMARKET;
  readonly isActive: boolean;
  
  private pollInterval?: NodeJS.Timeout;
  private readonly logger = createSourceLogger('polymarketLeaderboard');
  private updateCallback?: (trade: TradeData) => void;
  private lastSyncTime = 0;
  private databaseManager: DatabaseManager;
  private readonly leaderboardEndpoint = 'https://data-api.polymarket.com'; // Separate endpoint for leaderboard data

  constructor(private config: SourceConfig) {
    this.isActive = config.enabled;
    this.databaseManager = new DatabaseManager();
  }

  async initialize(): Promise<void> {
    if (!this.isActive) {
      this.logger.info('Polymarket leaderboard source is disabled');
      return;
    }

    this.logger.info('Initializing Polymarket leaderboard source', {
      leaderboardEndpoint: this.leaderboardEndpoint,
    });

    // Test REST API connection (more lenient for mock data)
    try {
      await this.testConnection();
      this.logger.info('Polymarket REST API connection successful');
    } catch (error) {
      // For mock data, we can continue even if the test fails
      this.logger.warn('Polymarket REST API test failed, continuing with mock data', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async startPolling(): Promise<void> {
    if (!this.isActive) return;

    this.logger.info('Starting Polymarket leaderboard polling', {
      interval: this.config.pollInterval,
    });

    // Initial fetch
    await this.pollLeaderboard();

    // Set up recurring polling
    if (this.config.pollInterval) {
      this.pollInterval = setInterval(async () => {
        try {
          await this.pollLeaderboard();
        } catch (error) {
          this.logger.error('Error during leaderboard polling', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }, this.config.pollInterval);
    }
  }

  async stopPolling(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    this.logger.info('Stopped Polymarket leaderboard polling');
  }

  async getLeaderboard(): Promise<LeaderboardData> {
    if (!this.isActive) {
      return {
        source: this.name,
        traders: [],
        totalTraders: 0,
        totalVolume: 0,
        totalTrades: 0,
        avgPnl: 0,
        snapshotDate: new Date(),
      };
    }

    try {
      // Fetch leaderboard data from Polymarket API
      const response = await axios.get(`${this.leaderboardEndpoint}/v1/leaderboard`, {
        params: {
          timePeriod: 'all',
          orderBy: 'VOL',
          limit: 100,
          offset: 0,
          category: 'overall'
        },
        timeout: 10000,
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const leaderboardData = response.data;
      
      // If no traders available, return empty leaderboard
      if (leaderboardData.length === 0) {
        this.logger.info('No leaderboard data available from Polymarket');
        return {
          source: this.name,
          traders: [],
          totalTraders: 0,
          totalVolume: 0,
          totalTrades: 0,
          avgPnl: 0,
          snapshotDate: new Date(),
        };
      }

      // Convert leaderboard data to trader profiles
      const traders = await this.buildTraderProfilesFromLeaderboard(leaderboardData);
      
      // Store traders in database
      for (const trader of traders) {
        try {
          const normalizedTrader: NormalizedTrader = {
            sourceTraderId: trader.sourceTraderId,
            source: this.name,
            traderData: trader,
            confidence: 1.0,
          };
          await this.databaseManager.storeTrader(normalizedTrader);
        } catch (error) {
          this.logger.warn('Failed to store trader', {
            traderId: trader.sourceTraderId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Calculate totals
      const totalVolume = traders.reduce((sum, trader) => sum + trader.totalVolume, 0);
      const totalTrades = traders.reduce((sum, trader) => sum + trader.totalTrades, 0);
      const avgPnl = traders.length > 0 ? traders.reduce((sum, trader) => sum + trader.totalPnl, 0) / traders.length : 0;

      const leaderboard: LeaderboardData = {
        source: this.name,
        traders: traders.slice(0, 100), // Return top 100 traders
        totalTraders: traders.length,
        totalVolume,
        totalTrades,
        avgPnl,
        snapshotDate: new Date(),
      };

      // Store leaderboard snapshot
      try {
        await this.databaseManager.storeLeaderboardSnapshot(leaderboard);
      } catch (error) {
        this.logger.warn('Failed to store leaderboard snapshot', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      this.logger.info('Fetched Polymarket leaderboard', {
        traderCount: traders.length,
        totalVolume,
        totalTrades,
        avgPnl,
      });

      return leaderboard;
    } catch (error) {
      this.logger.error('Failed to fetch Polymarket leaderboard', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new LeaderboardError(
        'Failed to fetch leaderboard from Polymarket',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async getTraderTrades(traderId: string, since?: Date): Promise<TradeData[]> {
    if (!this.isActive) return [];

    try {
      // Fetch multiple data sources in parallel
      const [positionsResponse, closedPositions, recentActivity] = await Promise.allSettled([
        axios.get(`${this.leaderboardEndpoint}/positions`, {
          params: { user: traderId },
          timeout: 10000,
        }),
        this.getTraderClosedPositions(traderId, 25),
        this.getTraderRecentActivity(traderId, 25)
      ]);

      const trades: TradeData[] = [];

      // Process current positions
      if (positionsResponse.status === 'fulfilled' && positionsResponse.value.status === 200) {
        const positions = positionsResponse.value.data;
        for (const position of positions) {
          try {
            const trade = this.normalizePositionToTrade(position, traderId);
            trades.push(trade);
          } catch (error) {
            this.logger.warn('Failed to normalize position to trade', {
              positionId: position.asset,
              traderId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Process closed positions (historical trades)
      if (closedPositions.status === 'fulfilled') {
        for (const closedPosition of closedPositions.value) {
          try {
            const trade = this.normalizeClosedPositionToTrade(closedPosition, traderId);
            trades.push(trade);
          } catch (error) {
            this.logger.warn('Failed to normalize closed position to trade', {
              positionId: closedPosition.asset,
              traderId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Process recent activity (real-time trades)
      if (recentActivity.status === 'fulfilled') {
        for (const activity of recentActivity.value) {
          try {
            const trade = this.normalizeActivityToTrade(activity, traderId);
            trades.push(trade);
          } catch (error) {
            this.logger.warn('Failed to normalize activity to trade', {
              activityId: activity.transactionHash,
              traderId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Store trades in database
      for (const trade of trades) {
        try {
          const normalizedTrade: NormalizedTrade = {
            sourceTradeId: trade.sourceTradeId,
            source: this.name,
            tradeData: trade,
            confidence: 1.0,
          };
          await this.databaseManager.storeTrade(normalizedTrade);
        } catch (error) {
          this.logger.warn('Failed to store trade', {
            tradeId: trade.sourceTradeId,
            traderId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('Fetched comprehensive trader data from Polymarket', {
        traderId,
        positionCount: positionsResponse.status === 'fulfilled' ? positionsResponse.value.data.length : 0,
        closedPositionCount: closedPositions.status === 'fulfilled' ? closedPositions.value.length : 0,
        activityCount: recentActivity.status === 'fulfilled' ? recentActivity.value.length : 0,
        totalTradeCount: trades.length,
      });

      return trades;
    } catch (error) {
      this.logger.error('Failed to fetch trader trades', {
        traderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get trader's total trade count
   */
  private async getTraderTradeCount(traderId: string): Promise<number> {
    try {
      const response = await axios.get(`${this.leaderboardEndpoint}/traded`, {
        params: { user: traderId },
        timeout: 5000,
      });

      if (response.status === 200 && response.data.traded) {
        return parseInt(response.data.traded) || 0;
      }
      return 0;
    } catch (error) {
      this.logger.warn('Failed to fetch trader trade count', {
        traderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get trader's recent activity
   */
  private async getTraderRecentActivity(traderId: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await axios.get(`${this.leaderboardEndpoint}/activity`, {
        params: {
          user: traderId,
          limit,
          offset: 0
        },
        timeout: 5000,
      });

      if (response.status === 200 && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      this.logger.warn('Failed to fetch trader activity', {
        traderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get trader's closed positions (historical trades)
   */
  private async getTraderClosedPositions(traderId: string, limit: number = 50): Promise<any[]> {
    try {
      const response = await axios.get(`${this.leaderboardEndpoint}/closed-positions`, {
        params: {
          user: traderId,
          sortBy: 'realizedpnl',
          sortDirection: 'DESC',
          limit,
          offset: 0
        },
        timeout: 10000,
      });

      if (response.status === 200 && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      this.logger.warn('Failed to fetch trader closed positions', {
        traderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get trader's PnL history
   */
  private async getTraderPnLHistory(traderId: string, interval: string = '1m', fidelity: string = '1d'): Promise<any[]> {
    try {
      const response = await axios.get(`https://user-pnl-api.polymarket.com/user-pnl`, {
        params: {
          user_address: traderId,
          interval,
          fidelity
        },
        timeout: 10000,
      });

      if (response.status === 200 && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      this.logger.warn('Failed to fetch trader PnL history', {
        traderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async subscribeToTradeUpdates(callback: (trade: TradeData) => void): Promise<void> {
    if (!this.isActive) return;

    this.updateCallback = callback;
    this.logger.info('Subscribed to Polymarket trade updates (no real data available)');
  }

  async unsubscribeFromTradeUpdates(): Promise<void> {
    this.updateCallback = undefined;
    this.logger.info('Unsubscribed from Polymarket trade updates');
  }

  private async testConnection(): Promise<void> {
    // Test with the leaderboard endpoint
    const response = await axios.get(`${this.leaderboardEndpoint}/v1/leaderboard`, {
      params: { 
        timePeriod: 'all',
        orderBy: 'VOL',
        limit: 1,
        offset: 0,
        category: 'overall'
      },
      timeout: 10000,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async getRecentTrades(): Promise<any[]> {
    try {
      // Fetch leaderboard data from Polymarket API
      const response = await axios.get(`${this.leaderboardEndpoint}/v1/leaderboard`, {
        params: {
          timePeriod: 'all',
          orderBy: 'VOL',
          limit: 100,
          offset: 0,
          category: 'overall'
        },
        timeout: 10000,
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const leaderboardData = response.data;
      this.logger.info('Fetched leaderboard data from Polymarket', {
        traderCount: leaderboardData.length,
      });

      // Convert leaderboard data to trader profiles
      const traders = await this.buildTraderProfilesFromLeaderboard(leaderboardData);
      
      // Store traders in database
      for (const trader of traders) {
        try {
          const normalizedTrader: NormalizedTrader = {
            sourceTraderId: trader.sourceTraderId,
            source: this.name,
            traderData: trader,
            confidence: 1.0,
          };
          await this.databaseManager.storeTrader(normalizedTrader);
        } catch (error) {
          this.logger.warn('Failed to store trader', {
            traderId: trader.sourceTraderId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return leaderboardData;
    } catch (error) {
      this.logger.error('Failed to fetch recent trades', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async buildTraderProfilesFromLeaderboard(leaderboardData: any[]): Promise<TraderData[]> {
    const traders: TraderData[] = [];

    for (const traderData of leaderboardData) {
      try {
        // Fetch additional trader data from multiple endpoints
        const [tradeCount, recentActivity] = await Promise.allSettled([
          this.getTraderTradeCount(traderData.proxyWallet),
          this.getTraderRecentActivity(traderData.proxyWallet, 1)
        ]);

        const totalTrades = tradeCount.status === 'fulfilled' ? tradeCount.value : 0;
        const lastActivity = recentActivity.status === 'fulfilled' && recentActivity.value.length > 0 
          ? new Date(recentActivity.value[0].timestamp * 1000) 
          : new Date();

        const trader: TraderData = {
          id: '', // Will be set by database
          source: this.name,
          sourceTraderId: traderData.proxyWallet,
          username: traderData.userName,
          displayName: traderData.userName,
          profileImageUrl: traderData.profileImage || undefined,
          totalTrades,
          totalVolume: parseFloat(traderData.vol || '0'),
          totalPnl: parseFloat(traderData.pnl || '0'),
          winRate: undefined, // Will be calculated from closed positions
          avgReturn: undefined, // Will be calculated from PnL data
          currentRank: parseInt(traderData.rank || '0'),
          bestRank: undefined, // Not available in leaderboard data
          rankChange: 0, // Not available in leaderboard data
          lastActiveAt: lastActivity,
          firstTradeAt: undefined, // Will be calculated from activity data
          lastTradeAt: lastActivity,
          isPublic: true,
          allowCopyTrading: false,
          maxFollowers: undefined,
          sourceData: traderData,
        };

        traders.push(trader);
      } catch (error) {
        this.logger.warn('Failed to process trader data', {
          traderData,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return traders;
  }

  private async buildTraderProfiles(trades: any[]): Promise<any[]> {
    const traderMap = new Map<string, any>();

    for (const trade of trades) {
      // Extract trader information from Polymarket event structure
      const traderId = trade.user_id || trade.user || trade.trader || trade.maker || trade.taker;
      if (!traderId) continue;

      if (!traderMap.has(traderId)) {
        traderMap.set(traderId, {
          id: traderId,
          source: this.name,
          sourceTraderId: traderId,
          username: trade.username || `trader_${traderId.slice(0, 8)}`,
          displayName: trade.display_name || trade.username,
          profileImageUrl: trade.profile_image_url,
          totalTrades: 0,
          totalVolume: 0,
          totalPnl: 0,
          winRate: 0,
          avgReturn: 0,
          currentRank: 0,
          bestRank: 0,
          rankChange: 0,
          lastActiveAt: new Date(),
          firstTradeAt: new Date(),
          lastTradeAt: new Date(),
          isPublic: true,
          allowCopyTrading: false,
          sourceData: {},
        });
      }

      const trader = traderMap.get(traderId)!;
      trader.totalTrades++;
      trader.totalVolume += parseFloat(trade.amount || '0');
      
      // Update activity timestamps
      const tradeTime = new Date(trade.timestamp || trade.created_at);
      if (tradeTime > trader.lastActiveAt!) {
        trader.lastActiveAt = tradeTime;
      }
      if (tradeTime < trader.firstTradeAt!) {
        trader.firstTradeAt = tradeTime;
      }
      if (tradeTime > trader.lastTradeAt!) {
        trader.lastTradeAt = tradeTime;
      }
    }

    // Calculate rankings based on volume
    const traders = Array.from(traderMap.values())
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .map((trader, index) => ({
        ...trader,
        currentRank: index + 1,
      }));

    return traders.slice(0, 100); // Return top 100 traders
  }

  private rankTraders(traders: any[]): any[] {
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

  private normalizePositionToTrade(position: any, traderId: string): TradeData {
    return {
      id: position.asset || `${traderId}_${Date.now()}`,
      traderId,
      source: this.name,
      sourceTradeId: position.asset || `${traderId}_${Date.now()}`,
      marketId: undefined, // Will be resolved later
      sourceMarketId: position.conditionId || position.eventId,
      side: position.outcome === 'Yes' ? TradeSide.BUY : TradeSide.SELL,
      outcomeIndex: position.outcomeIndex || 0,
      quantity: parseFloat(position.size || '0'),
      price: parseFloat(position.avgPrice || '0'),
      totalValue: parseFloat(position.initialValue || '0'),
      status: TradeStatus.EXECUTED,
      executedAt: new Date(), // Position data doesn't include execution time
      realizedPnl: position.realizedPnl ? parseFloat(position.realizedPnl) : undefined,
      unrealizedPnl: position.cashPnl ? parseFloat(position.cashPnl) : undefined,
      isCopyTrade: false,
      sourceData: position,
    };
  }

  private normalizeClosedPositionToTrade(closedPosition: any, traderId: string): TradeData {
    // Safely parse the execution date
    let executedAt: Date;
    if (closedPosition.endDate) {
      const parsedDate = new Date(closedPosition.endDate);
      executedAt = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    } else {
      executedAt = new Date();
    }

    return {
      id: closedPosition.asset || `${traderId}_${Date.now()}`,
      traderId,
      source: this.name,
      sourceTradeId: closedPosition.asset || `${traderId}_${Date.now()}`,
      marketId: undefined, // Will be resolved later
      sourceMarketId: closedPosition.conditionId,
      side: closedPosition.outcome === 'Yes' ? TradeSide.BUY : TradeSide.SELL,
      outcomeIndex: closedPosition.outcomeIndex || 0,
      quantity: parseFloat(closedPosition.totalBought || '0'),
      price: parseFloat(closedPosition.avgPrice || '0'),
      totalValue: parseFloat(closedPosition.totalBought || '0') * parseFloat(closedPosition.avgPrice || '0'),
      status: TradeStatus.EXECUTED,
      executedAt,
      realizedPnl: closedPosition.realizedPnl ? parseFloat(closedPosition.realizedPnl) : undefined,
      unrealizedPnl: undefined, // Closed positions have no unrealized PnL
      isCopyTrade: false,
      sourceData: closedPosition,
    };
  }

  private normalizeActivityToTrade(activity: any, traderId: string): TradeData {
    // Safely parse the execution date
    let executedAt: Date;
    if (activity.timestamp) {
      const parsedDate = new Date(activity.timestamp * 1000);
      executedAt = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    } else {
      executedAt = new Date();
    }

    return {
      id: activity.transactionHash || `${traderId}_${Date.now()}`,
      traderId,
      source: this.name,
      sourceTradeId: activity.transactionHash || `${traderId}_${Date.now()}`,
      marketId: undefined, // Will be resolved later
      sourceMarketId: activity.conditionId,
      side: activity.side === 'BUY' ? TradeSide.BUY : TradeSide.SELL,
      outcomeIndex: activity.outcomeIndex || 0,
      quantity: parseFloat(activity.size || '0'),
      price: parseFloat(activity.price || '0'),
      totalValue: parseFloat(activity.usdcSize || '0'),
      status: TradeStatus.EXECUTED,
      executedAt,
      realizedPnl: undefined, // Activity doesn't include PnL
      unrealizedPnl: undefined, // Activity doesn't include PnL
      isCopyTrade: false,
      sourceData: activity,
    };
  }

  private normalizeTrade(tradeData: any, traderId: string): TradeData {
    return {
      id: tradeData.id || `${traderId}_${Date.now()}`,
      traderId,
      source: this.name,
      sourceTradeId: tradeData.id || `${traderId}_${Date.now()}`,
      marketId: undefined, // Will be resolved later
      sourceMarketId: tradeData.market_id || tradeData.condition_id || tradeData.market,
      side: this.mapTradeSide(tradeData.side || tradeData.position || tradeData.direction),
      outcomeIndex: tradeData.outcome_index || tradeData.outcome,
      quantity: parseFloat(tradeData.amount || tradeData.size || tradeData.quantity || '0'),
      price: parseFloat(tradeData.price || tradeData.price_per_share || '0'),
      totalValue: parseFloat(tradeData.total_value || tradeData.amount || tradeData.value || '0'),
      status: TradeStatus.EXECUTED,
      executedAt: new Date(tradeData.timestamp || tradeData.created_at),
      realizedPnl: tradeData.realized_pnl ? parseFloat(tradeData.realized_pnl) : undefined,
      unrealizedPnl: tradeData.unrealized_pnl ? parseFloat(tradeData.unrealized_pnl) : undefined,
      isCopyTrade: false,
      sourceData: tradeData,
    };
  }

  private mapTradeSide(side: string): TradeSide {
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

  private async pollLeaderboard(): Promise<void> {
    try {
      const currentTime = Date.now();
      
      // Fetch leaderboard data
      const leaderboardData = await this.getLeaderboard();

      // Process leaderboard for real-time updates
      if (this.updateCallback && leaderboardData.traders.length > 0) {
        // For each trader, fetch their positions and process as trades
        for (const trader of leaderboardData.traders.slice(0, 10)) { // Limit to top 10 for performance
          try {
            const trades = await this.getTraderTrades(trader.sourceTraderId);
            for (const trade of trades) {
              this.updateCallback(trade);
            }
          } catch (error) {
            this.logger.warn('Failed to process trader trades during polling', {
              traderId: trader.sourceTraderId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      this.lastSyncTime = currentTime;
      
      this.logger.debug('Leaderboard polling completed', {
        tradersProcessed: leaderboardData.traders.length,
        totalVolume: leaderboardData.totalVolume,
        totalTrades: leaderboardData.totalTrades,
      });

    } catch (error) {
      this.logger.error('Leaderboard polling failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
