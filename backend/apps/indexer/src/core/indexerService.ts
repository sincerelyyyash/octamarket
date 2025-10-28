import cron from 'node-cron';
import { MarketSource, EventType, prisma } from '@repo/database';
import { TradeStatus } from '../types/index.js';
import type { DataSource, MarketEventData, PriceData, LeaderboardDataSource, TradeData } from '../types/index.js';
import { IndexerError } from '../types/index.js';
import { MarketNormalizer } from './normalizer.js';
import { LeaderboardNormalizer } from './leaderboardNormalizer.js';
import { MarketDeduplicator } from './deduplicator.js';
import { DatabaseManager } from './databaseManager.js';
import { QueueManager } from './queueManager.js';
import { PolymarketSource } from '../sources/polymarket.js';
import { KalshiSource } from '../sources/kalshi.js';
import { AugurSource } from '../sources/augur.js';
import { ThalesSource } from '../sources/thales.js';
import { OmenSource } from '../sources/omen.js';
import { PolymarketLeaderboardSource } from '../sources/polymarketLeaderboard.js';
import { config, getEnabledSources } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class IndexerService {
  private readonly logger = logger.child({ component: 'indexerService' });
  private readonly normalizer = new MarketNormalizer();
  private readonly leaderboardNormalizer = new LeaderboardNormalizer();
  private readonly deduplicator = new MarketDeduplicator();
  private readonly dbManager = new DatabaseManager();
  private readonly queueManager = new QueueManager(this.dbManager);
  private readonly sources = new Map<MarketSource, DataSource>();
  private readonly leaderboardSources = new Map<MarketSource, LeaderboardDataSource>();
  
  private isRunning = false;
  private priceTrackingJob?: cron.ScheduledTask;
  private leaderboardSyncJob?: cron.ScheduledTask;

  constructor() {
    this.initializeSources();
    this.initializeLeaderboardSources();
  }

  /**
   * Start the indexer service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Indexer service is already running');
      return;
    }

    this.logger.info('Starting indexer service');

    try {
      // Initialize all sources
      await this.initializeAllSources();

      // Start polling for each source
      await this.startAllPolling();

      // Start leaderboard polling if enabled
      if (config.leaderboard.enabled) {
        await this.startAllLeaderboardPolling();
      }

      // Subscribe to real-time updates
      await this.subscribeToAllUpdates();

      // Subscribe to leaderboard updates if enabled
      if (config.leaderboard.enabled) {
        await this.subscribeToAllLeaderboardUpdates();
      }

      // Start price tracking job
      this.startPriceTracking();

      // Start leaderboard sync job if enabled
      if (config.leaderboard.enabled) {
        this.startLeaderboardSync();
      }

      this.isRunning = true;
      this.logger.info('Indexer service started successfully');
    } catch (error) {
      this.logger.error('Failed to start indexer service', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop the indexer service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Indexer service is not running');
      return;
    }

    this.logger.info('Stopping indexer service');

    try {
      // Stop price tracking
      if (this.priceTrackingJob) {
        this.priceTrackingJob.stop();
        this.priceTrackingJob = undefined;
      }

      // Stop leaderboard sync
      if (this.leaderboardSyncJob) {
        this.leaderboardSyncJob.stop();
        this.leaderboardSyncJob = undefined;
      }

      // Flush all queues before stopping
      await this.queueManager.flushAll();

      // Stop queue manager
      this.queueManager.stop();

      // Unsubscribe from updates
      await this.unsubscribeFromAllUpdates();
      await this.unsubscribeFromAllLeaderboardUpdates();

      // Stop polling
      await this.stopAllPolling();

      this.isRunning = false;
      this.logger.info('Indexer service stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping indexer service', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get service status
   */
  getStatus(): { 
    isRunning: boolean; 
    sources: { name: string; isActive: boolean }[];
    leaderboardSources: { name: string; isActive: boolean }[];
    queueStats: Record<string, number>;
  } {
    return {
      isRunning: this.isRunning,
      sources: Array.from(this.sources.entries()).map(([name, source]) => ({
        name,
        isActive: source.isActive,
      })),
      leaderboardSources: Array.from(this.leaderboardSources.entries()).map(([name, source]) => ({
        name,
        isActive: source.isActive,
      })),
      queueStats: this.queueManager.getStats(),
    };
  }

  private initializeSources(): void {
    const enabledSources = getEnabledSources();

    for (const sourceConfig of enabledSources) {
      let source: DataSource;

      switch (sourceConfig.source) {
        case MarketSource.POLYMARKET:
          source = new PolymarketSource(sourceConfig);
          break;
        case MarketSource.KALSHI:
          source = new KalshiSource(sourceConfig);
          break;
        case MarketSource.AUGUR:
          source = new AugurSource(sourceConfig);
          break;
        case MarketSource.THALES:
          source = new ThalesSource(sourceConfig);
          break;
        case MarketSource.OMEN:
          source = new OmenSource(sourceConfig);
          break;
        default:
          this.logger.warn('Unknown source type', { source: sourceConfig.source });
          continue;
      }

      this.sources.set(sourceConfig.source, source);
      this.logger.info('Initialized source', {
        source: sourceConfig.source,
        isActive: source.isActive,
      });
    }
  }

  private initializeLeaderboardSources(): void {
    if (!config.leaderboard.enabled) return;

    const enabledSources = getEnabledSources();

    for (const sourceConfig of enabledSources) {
      let leaderboardSource: LeaderboardDataSource;

      switch (sourceConfig.source) {
        case MarketSource.POLYMARKET:
          leaderboardSource = new PolymarketLeaderboardSource(sourceConfig);
          break;
        default:
          this.logger.debug('No leaderboard source available', { source: sourceConfig.source });
          continue;
      }

      this.leaderboardSources.set(sourceConfig.source, leaderboardSource);
      this.logger.info('Initialized leaderboard source', {
        source: sourceConfig.source,
        isActive: leaderboardSource.isActive,
      });
    }
  }

  private async initializeAllSources(): Promise<void> {
    const initPromises = Array.from(this.sources.entries()).map(async ([name, source]) => {
      try {
        await source.initialize();
        this.logger.info('Source initialized', { source: name });
      } catch (error) {
        this.logger.error('Failed to initialize source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Update indexer state with error
        await this.dbManager.updateIndexerState(
          name,
          undefined,
          undefined,
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
    });

    await Promise.allSettled(initPromises);

    // Initialize leaderboard sources
    if (config.leaderboard.enabled) {
      await this.initializeAllLeaderboardSources();
    }
  }

  private async initializeAllLeaderboardSources(): Promise<void> {
    const initPromises = Array.from(this.leaderboardSources.entries()).map(async ([name, source]) => {
      try {
        await source.initialize();
        this.logger.info('Leaderboard source initialized', { source: name });
      } catch (error) {
        this.logger.error('Failed to initialize leaderboard source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Update indexer state with error
        await this.dbManager.updateIndexerState(
          name,
          undefined,
          undefined,
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
    });

    await Promise.allSettled(initPromises);
  }

  private async startAllPolling(): Promise<void> {
    const pollingPromises = Array.from(this.sources.entries()).map(async ([name, source]) => {
      try {
        await source.startPolling();
        this.logger.info('Started polling for source', { source: name });
      } catch (error) {
        this.logger.error('Failed to start polling for source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(pollingPromises);
  }

  private async stopAllPolling(): Promise<void> {
    const stopPromises = Array.from(this.sources.entries()).map(async ([name, source]) => {
      try {
        await source.stopPolling();
        this.logger.info('Stopped polling for source', { source: name });
      } catch (error) {
        this.logger.error('Failed to stop polling for source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(stopPromises);

    // Stop leaderboard polling
    if (config.leaderboard.enabled) {
      await this.stopAllLeaderboardPolling();
    }
  }

  private async startAllLeaderboardPolling(): Promise<void> {
    const pollingPromises = Array.from(this.leaderboardSources.entries()).map(async ([name, source]) => {
      try {
        await source.startPolling();
        this.logger.info('Started leaderboard polling for source', { source: name });
      } catch (error) {
        this.logger.error('Failed to start leaderboard polling for source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(pollingPromises);
  }

  private async stopAllLeaderboardPolling(): Promise<void> {
    const stopPromises = Array.from(this.leaderboardSources.entries()).map(async ([name, source]) => {
      try {
        await source.stopPolling();
        this.logger.info('Stopped leaderboard polling for source', { source: name });
      } catch (error) {
        this.logger.error('Failed to stop leaderboard polling for source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(stopPromises);
  }

  private async subscribeToAllUpdates(): Promise<void> {
    const subscribePromises = Array.from(this.sources.entries()).map(async ([name, source]) => {
      try {
        await source.subscribeToUpdates((event) => this.handleMarketEvent(event));
        this.logger.info('Subscribed to updates for source', { source: name });
      } catch (error) {
        this.logger.error('Failed to subscribe to updates for source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(subscribePromises);
  }

  private async unsubscribeFromAllUpdates(): Promise<void> {
    const unsubscribePromises = Array.from(this.sources.entries()).map(async ([name, source]) => {
      try {
        await source.unsubscribeFromUpdates();
        this.logger.info('Unsubscribed from updates for source', { source: name });
      } catch (error) {
        this.logger.error('Failed to unsubscribe from updates for source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(unsubscribePromises);

    // Unsubscribe from leaderboard updates
    if (config.leaderboard.enabled) {
      await this.unsubscribeFromAllLeaderboardUpdates();
    }
  }

  private async subscribeToAllLeaderboardUpdates(): Promise<void> {
    const subscribePromises = Array.from(this.leaderboardSources.entries()).map(async ([name, source]) => {
      try {
        await source.subscribeToTradeUpdates((trade) => this.handleTradeUpdate(trade));
        this.logger.info('Subscribed to leaderboard updates for source', { source: name });
      } catch (error) {
        this.logger.error('Failed to subscribe to leaderboard updates for source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(subscribePromises);
  }

  private async unsubscribeFromAllLeaderboardUpdates(): Promise<void> {
    const unsubscribePromises = Array.from(this.leaderboardSources.entries()).map(async ([name, source]) => {
      try {
        await source.unsubscribeFromTradeUpdates();
        this.logger.info('Unsubscribed from leaderboard updates for source', { source: name });
      } catch (error) {
        this.logger.error('Failed to unsubscribe from leaderboard updates for source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(unsubscribePromises);
  }

  private startPriceTracking(): void {
    // Run price tracking every 30 seconds
    this.priceTrackingJob = cron.schedule('*/30 * * * * *', async () => {
      try {
        await this.trackPrices();
      } catch (error) {
        this.logger.error('Price tracking failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.logger.info('Started price tracking job');
  }

  private startLeaderboardSync(): void {
    // Run leaderboard sync every 5 minutes
    this.leaderboardSyncJob = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.syncLeaderboards();
      } catch (error) {
        this.logger.error('Leaderboard sync failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.logger.info('Started leaderboard sync job');
  }

  private async handleTradeUpdate(trade: TradeData): Promise<void> {
    try {
      this.logger.debug('Processing trade update', {
        source: trade.source,
        traderId: trade.traderId,
        tradeId: trade.sourceTradeId,
      });

      // Normalize the trade
      const normalized = await this.leaderboardNormalizer.normalizeTrade(
        trade.sourceData || trade,
        trade.source,
        trade.sourceTradeId,
        trade.traderId
      );

      // Queue the trade for batch processing
      this.queueManager.enqueueTradeData(normalized.tradeData);

      // Handle copy trading if enabled
      if (config.leaderboard.copyTradingEnabled) {
        await this.handleCopyTrading(trade);
      }

      // Update indexer state
      await this.dbManager.updateIndexerTradeSync(trade.source, new Date());

    } catch (error) {
      this.logger.error('Failed to handle trade update', {
        source: trade.source,
        traderId: trade.traderId,
        tradeId: trade.sourceTradeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleMarketEvent(event: MarketEventData): Promise<void> {
    try {
      this.logger.debug('Processing market event', {
        source: event.source,
        marketId: event.marketId,
        eventType: event.eventType,
      });

      // Queue the raw event for batch processing
      this.queueManager.enqueueMarketEvent(event);

      // Process based on event type
      switch (event.eventType) {
        case EventType.MARKET_CREATED:
        case EventType.MARKET_UPDATED:
          await this.processMarketUpdate(event);
          break;
        case EventType.PRICE_UPDATE:
          await this.processPriceUpdate(event);
          break;
        case EventType.VOLUME_UPDATE:
        case EventType.LIQUIDITY_UPDATE:
          await this.processVolumeOrLiquidityUpdate(event);
          break;
        default:
          this.logger.debug('Unhandled event type', { eventType: event.eventType });
      }

      // Update indexer state
      await this.dbManager.updateIndexerState(event.source, new Date());

    } catch (error) {
      this.logger.error('Failed to handle market event', {
        source: event.source,
        marketId: event.marketId,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });

      // Update indexer state with error
      await this.dbManager.updateIndexerState(
        event.source,
        new Date(),
        undefined,
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async processMarketUpdate(event: MarketEventData): Promise<void> {
    try {
      // Normalize the market data
      const normalized = await this.normalizer.normalizeMarket(
        event.data.market || event.rawPayload,
        event.source,
        event.marketId
      );

      // Check for duplicates if deduplication is enabled
      if (config.deduplication.enabled) {
        const existingMarkets = await this.dbManager.getExistingMarkets();
        const duplicates = await this.deduplicator.findDuplicates(
          normalized.marketData,
          existingMarkets
        );

        if (duplicates.length > 0) {
          this.logger.info('Found potential duplicate markets', {
            marketId: event.marketId,
            source: event.source,
            duplicateCount: duplicates.length,
          });

          // Store deduplication mappings
          for (const duplicate of duplicates) {
            await this.dbManager.storeMarketMapping(duplicate);
          }
        }
      }

      // Store the market (still immediate for deduplication)
      const marketId = await this.dbManager.storeMarket(normalized);

      // Queue price data for each outcome with a price
      if (normalized.marketData.outcomes && normalized.marketData.outcomes.length > 0) {
        for (const outcome of normalized.marketData.outcomes) {
          if (outcome.currentPrice !== undefined && outcome.currentPrice !== null) {
            const priceData: PriceData = {
              marketId: event.marketId,
              source: event.source,
              price: outcome.currentPrice,
              volume: outcome.currentVolume,
              liquidity: outcome.currentLiquidity,
              timestamp: event.timestamp,
              outcomeId: outcome.index.toString(),
            };
            
            this.queueManager.enqueuePriceData(priceData);
          }
        }
      }

      this.logger.debug('Processed market update', {
        source: event.source,
        sourceMarketId: event.marketId,
        marketId,
      });

    } catch (error) {
      this.logger.error('Failed to process market update', {
        source: event.source,
        marketId: event.marketId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processPriceUpdate(event: MarketEventData): Promise<void> {
    try {
      const priceData: PriceData = {
        marketId: event.marketId,
        source: event.source,
        price: event.data.price || event.data.yes_bid || event.data.homeOdds,
        volume: event.data.volume,
        liquidity: event.data.liquidity,
        timestamp: event.timestamp,
        outcomeId: event.data.outcomeId || event.data.outcome_index?.toString(),
      };

      this.queueManager.enqueuePriceData(priceData);

      this.logger.debug('Processed price update', {
        source: event.source,
        marketId: event.marketId,
        price: priceData.price,
      });

    } catch (error) {
      this.logger.error('Failed to process price update', {
        source: event.source,
        marketId: event.marketId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processVolumeOrLiquidityUpdate(event: MarketEventData): Promise<void> {
    try {
      // Similar to price update but focused on volume/liquidity
      const priceData: PriceData = {
        marketId: event.marketId,
        source: event.source,
        price: event.data.price || 0, // Price might not be in volume/liquidity updates
        volume: event.data.volume,
        liquidity: event.data.liquidity,
        timestamp: event.timestamp,
        outcomeId: event.data.outcomeId?.toString(),
      };

      this.queueManager.enqueuePriceData(priceData);

      this.logger.debug('Processed volume/liquidity update', {
        source: event.source,
        marketId: event.marketId,
        volume: priceData.volume,
        liquidity: priceData.liquidity,
      });

    } catch (error) {
      this.logger.error('Failed to process volume/liquidity update', {
        source: event.source,
        marketId: event.marketId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async trackPrices(): Promise<void> {
    // This method would implement continuous price tracking
    // For now, it's a placeholder that could fetch current prices
    // from all sources and store them
    this.logger.debug('Running price tracking cycle');

    const trackingPromises = Array.from(this.sources.entries()).map(async ([name, source]) => {
      try {
        if (!source.isActive) return;

        // This is a simplified implementation
        // In a real scenario, you might want to track specific markets
        // or implement more sophisticated price tracking logic
        
        this.logger.debug('Price tracking completed for source', { source: name });
      } catch (error) {
        this.logger.error('Price tracking failed for source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(trackingPromises);
  }

  private async syncLeaderboards(): Promise<void> {
    this.logger.debug('Running leaderboard sync cycle');

    const syncPromises = Array.from(this.leaderboardSources.entries()).map(async ([name, source]) => {
      try {
        if (!source.isActive) return;

        // Fetch leaderboard data
        const leaderboard = await source.getLeaderboard();
        
        // Queue traders for batch processing
        for (const traderData of leaderboard.traders) {
          try {
            const normalized = await this.leaderboardNormalizer.normalizeTrader(
              traderData.sourceData || traderData,
              traderData.source,
              traderData.sourceTraderId
            );
            
            this.queueManager.enqueueTraderData(normalized.traderData);
          } catch (error) {
            this.logger.warn('Failed to normalize trader', {
              traderId: traderData.sourceTraderId,
              source: traderData.source,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Queue leaderboard snapshot for batch processing
        this.queueManager.enqueueLeaderboardData(leaderboard);

        // Update indexer state
        await this.dbManager.updateIndexerTradeSync(name, new Date());
        
        this.logger.debug('Leaderboard sync completed for source', { 
          source: name,
          tradersProcessed: leaderboard.traders.length,
        });
      } catch (error) {
        this.logger.error('Leaderboard sync failed for source', {
          source: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(syncPromises);
  }

  private async handleCopyTrading(originalTrade: TradeData): Promise<void> {
    try {
      // Only support KALSHI and POLYMARKET for copy-trading intents
      if (!(originalTrade.source === 'KALSHI' || originalTrade.source === 'POLYMARKET')) {
        this.logger.debug('Skipping copy trading for unsupported source', {
          source: originalTrade.source,
          tradeId: originalTrade.sourceTradeId,
        });
        return;
      }

      // Get followers of the trader
      const followers = await this.dbManager.getTraderFollowers(originalTrade.traderId);
      
      if (followers.length === 0) return;

      this.logger.debug('Processing copy trading', {
        originalTraderId: originalTrade.traderId,
        followerCount: followers.length,
        tradeId: originalTrade.sourceTradeId,
      });

      // Create copy trades for each follower
      for (const follow of followers) {
        try {
          // Calculate copy trade amount
          let copyAmount = originalTrade.totalValue;
          
          if (follow.copyPercentage) {
            copyAmount = originalTrade.totalValue * follow.copyPercentage;
          }
          
          if (follow.maxCopyAmount && copyAmount > follow.maxCopyAmount) {
            copyAmount = follow.maxCopyAmount;
          }

          // Create copy trade
          const copyTrade: TradeData = {
            id: `${follow.followerId}_copy_${originalTrade.sourceTradeId}`,
            traderId: follow.followerId,
            source: originalTrade.source,
            sourceTradeId: `${follow.followerId}_copy_${originalTrade.sourceTradeId}`,
            marketId: originalTrade.marketId,
            sourceMarketId: originalTrade.sourceMarketId,
            side: originalTrade.side,
            outcomeIndex: originalTrade.outcomeIndex,
            quantity: originalTrade.quantity * (copyAmount / originalTrade.totalValue),
            price: originalTrade.price,
            totalValue: copyAmount,
            status: TradeStatus.PENDING, // Will be executed by the platform
            executedAt: new Date(),
            isCopyTrade: true,
            originalTradeId: originalTrade.id,
            copiedByTraderId: follow.followerId,
            sourceData: {
              ...originalTrade.sourceData,
              copyTrade: true,
              originalTradeId: originalTrade.id,
            },
          };

          // Normalize and queue copy trade (DB persistence)
          const normalized = await this.leaderboardNormalizer.normalizeTrade(
            copyTrade.sourceData || copyTrade,
            copyTrade.source,
            copyTrade.sourceTradeId,
            copyTrade.traderId
          );

          this.queueManager.enqueueTradeData(normalized.tradeData);

          // Also publish trade intent to execution engine with idempotency
          try {
            const { tradeIntents } = await import('../utils/redis.js');
            const idKey = `${originalTrade.sourceTradeId}:${follow.followerId}`;
            const ok = await tradeIntents.idempotent(idKey, 300);
            if (ok) {
              const intentId = `${follow.followerId}_${Date.now()}_${originalTrade.sourceTradeId}`;
              // Ensure marketId is present: resolve via source/sourceMarketId if missing
              let resolvedMarketId = originalTrade.marketId;
              if (!resolvedMarketId) {
                try {
                  const sourceMarket = await (prisma as any).sourceMarket.findFirst({
                    where: {
                      source: originalTrade.source,
                      sourceMarketId: originalTrade.sourceMarketId,
                    },
                  });
                  resolvedMarketId = sourceMarket?.marketId || undefined;
                } catch (resolveErr) {
                  this.logger.warn('Failed to resolve marketId for copy-trade intent', {
                    source: originalTrade.source,
                    sourceMarketId: originalTrade.sourceMarketId,
                    error: resolveErr instanceof Error ? resolveErr.message : String(resolveErr),
                  });
                }
              }

              if (!resolvedMarketId) {
                this.logger.warn('Skipping copy trade intent enqueue due to missing marketId', {
                  followerId: follow.followerId,
                  originalTradeId: originalTrade.sourceTradeId,
                });
              } else {
              await tradeIntents.enqueue({
                intentId,
                idempotencyKey: intentId,
                userId: follow.followerId,
                  marketId: resolvedMarketId,
                followerId: follow.followerId,
                followingId: follow.followingId,
                source: originalTrade.source,
                sourceMarketId: originalTrade.sourceMarketId,
                side: originalTrade.side,
                outcomeIndex: originalTrade.outcomeIndex ?? undefined,
                quantity: copyTrade.quantity,
                limitPrice: copyTrade.price,
                copied: 1,
                originalTradeId: originalTrade.sourceTradeId,
              });
              this.logger.info('Published copy trade intent', { intentId, followerId: follow.followerId });
              }
            }
          } catch (err) {
            this.logger.error('Failed to publish copy trade intent', {
              followerId: follow.followerId,
              originalTradeId: originalTrade.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }

          this.logger.info('Created copy trade', {
            followerId: follow.followerId,
            originalTradeId: originalTrade.id,
            copyAmount,
            originalAmount: originalTrade.totalValue,
          });

        } catch (error) {
          this.logger.error('Failed to create copy trade', {
            followerId: follow.followerId,
            originalTradeId: originalTrade.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

    } catch (error) {
      this.logger.error('Failed to handle copy trading', {
        originalTradeId: originalTrade.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
