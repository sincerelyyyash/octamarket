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
    // Run tiered price tracking every 30 seconds for high volume
    // Medium and low volume markets are tracked at their respective intervals
    this.priceTrackingJob = cron.schedule('*/30 * * * * *', async () => {
      try {
        await this.trackPricesTiered();
      } catch (error) {
        this.logger.error('Price tracking failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.logger.info('Started tiered price tracking job');
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
      // Skip resolved markets - check before normalization (MUST be first check)
      const marketData = event.data.market || event.rawPayload;
      if (this.isResolvedMarket(marketData, event.source)) {
        this.logger.debug('Skipping resolved market update', {
          source: event.source,
          marketId: event.marketId,
          status: marketData.status || marketData.closed || marketData.resolved,
        });
        return;
      }

      // For Kalshi, also check if it's a PLAYER prop parlay market (MUST be second check)
      if (event.source === MarketSource.KALSHI && this.isPlayerPropParlayMarket(marketData)) {
        this.logger.debug('Skipping PLAYER prop parlay market', {
          source: event.source,
          marketId: event.marketId,
          title: marketData.title || marketData.event_title,
          ticker: marketData.ticker,
        });
        return;
      }

      // Normalize the market data
      const normalized = await this.normalizer.normalizeMarket(
        marketData,
        event.source,
        event.marketId
      );

      // Check for duplicates if deduplication is enabled
      let canonicalMarketId: string | undefined;
      if (config.deduplication.enabled) {
        const existingMarkets = await this.dbManager.getExistingMarkets();
        const duplicates = await this.deduplicator.findDuplicates(
          normalized.marketData,
          existingMarkets
        );

        if (duplicates.length > 0) {
          // Use the highest confidence duplicate as canonical market
          const bestMatch = duplicates[0];
          canonicalMarketId = bestMatch.canonicalMarketId;

          this.logger.info('Found potential duplicate markets, linking to canonical', {
            marketId: event.marketId,
            source: event.source,
            canonicalMarketId,
            duplicateCount: duplicates.length,
            confidence: bestMatch.confidence,
          });

          // Store deduplication mappings
          for (const duplicate of duplicates) {
            await this.dbManager.storeMarketMapping(duplicate);
          }
        }
      }

      // Store the market - link to canonical if found, otherwise create new
      const marketId = await this.dbManager.storeMarket(normalized, canonicalMarketId);

      // Queue price data for each outcome with a price
      // Use canonical marketId (not source marketId) for price data
      if (normalized.marketData.outcomes && normalized.marketData.outcomes.length > 0) {
        for (const outcome of normalized.marketData.outcomes) {
          if (outcome.currentPrice !== undefined && outcome.currentPrice !== null) {
            const priceData: PriceData = {
              marketId: marketId, // Use canonical market ID
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
      // For Kalshi binary markets, we need to handle Yes/No prices separately
      if (event.source === MarketSource.KALSHI && (event.data.yes_bid !== undefined || event.data.no_bid !== undefined || event.data.yes_ask !== undefined || event.data.no_ask !== undefined)) {
        // Store Yes outcome price (index 0)
        if (event.data.yes_bid !== undefined || event.data.yes_ask !== undefined) {
          const yesPrice = event.data.yes_bid !== undefined ? parseFloat(event.data.yes_bid) / 100 : parseFloat(event.data.yes_ask) / 100;
          const yesPriceData: PriceData = {
            marketId: event.marketId,
            source: event.source,
            price: yesPrice,
            volume: event.data.yes_volume ? parseFloat(event.data.yes_volume) : undefined,
            liquidity: event.data.liquidity,
            timestamp: event.timestamp,
            outcomeId: '0', // Yes outcome has index 0
          };
          this.queueManager.enqueuePriceData(yesPriceData);
        }

        // Store No outcome price (index 1)
        if (event.data.no_bid !== undefined || event.data.no_ask !== undefined) {
          const noPrice = event.data.no_bid !== undefined ? parseFloat(event.data.no_bid) / 100 : parseFloat(event.data.no_ask) / 100;
          const noPriceData: PriceData = {
            marketId: event.marketId,
            source: event.source,
            price: noPrice,
            volume: event.data.no_volume ? parseFloat(event.data.no_volume) : undefined,
            liquidity: event.data.liquidity,
            timestamp: event.timestamp,
            outcomeId: '1', // No outcome has index 1
          };
          this.queueManager.enqueuePriceData(noPriceData);
        }
      } else if (event.source === MarketSource.POLYMARKET && event.data.tokens && Array.isArray(event.data.tokens)) {
        // For Polymarket, tokens contain outcome-specific prices
        // Tokens array index matches outcome index
        event.data.tokens.forEach((token: any, tokenIndex: number) => {
          if (token.price !== undefined || token.bestBid !== undefined || token.bestAsk !== undefined) {
            const tokenPrice = token.price !== undefined 
              ? parseFloat(token.price)
              : token.bestBid !== undefined
              ? parseFloat(token.bestBid)
              : token.bestAsk !== undefined
              ? parseFloat(token.bestAsk)
              : undefined;
            
            if (tokenPrice !== undefined) {
              // Use array index as outcome index (tokens are ordered)
              // Fallback to token's own index field if available
              const outcomeIndex = token.index !== undefined 
                ? parseInt(token.index.toString())
                : token.outcome_index !== undefined
                ? parseInt(token.outcome_index.toString())
                : tokenIndex; // Use array position as default
              
              const tokenPriceData: PriceData = {
                marketId: event.marketId,
                source: event.source,
                price: tokenPrice,
                volume: token.volume ? parseFloat(token.volume) : undefined,
                liquidity: token.liquidity ? parseFloat(token.liquidity) : undefined,
                timestamp: event.timestamp,
                outcomeId: outcomeIndex.toString(),
              };
              this.queueManager.enqueuePriceData(tokenPriceData);
            }
          }
        });
      } else {
        // For other sources or if outcomeId is explicitly provided
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
      }

      this.logger.debug('Processed price update', {
        source: event.source,
        marketId: event.marketId,
        hasYesPrice: event.data.yes_bid !== undefined || event.data.yes_ask !== undefined,
        hasNoPrice: event.data.no_bid !== undefined || event.data.no_ask !== undefined,
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

  private lastPriceTrackingTime: Record<string, number> = {};

  /**
   * Tiered price tracking - tracks prices based on volume tier
   */
  private async trackPricesTiered(): Promise<void> {
    const now = Date.now();
    
    // Get all active source markets grouped by tier
    const sourceMarkets = await prisma.sourceMarket.findMany({
      where: {
        isActive: true,
        market: {
          status: 'ACTIVE',
        },
      },
      include: {
        market: {
          include: {
            outcomes: true,
          },
        },
      },
    });

    // Group by source and tier
    const marketsBySourceAndTier = new Map<MarketSource, Map<string, typeof sourceMarkets>>();
    
    for (const sm of sourceMarkets) {
      const tier = sm.volumeTier || 'LOW';
      
      if (!marketsBySourceAndTier.has(sm.source)) {
        marketsBySourceAndTier.set(sm.source, new Map());
      }
      
      const tierMap = marketsBySourceAndTier.get(sm.source)!;
      if (!tierMap.has(tier)) {
        tierMap.set(tier, []);
      }
      
      tierMap.get(tier)!.push(sm);
    }

    // Track prices for each source
    const trackingPromises: Promise<void>[] = [];

    // Polymarket price tracking
    const polymarketSource = this.sources.get(MarketSource.POLYMARKET) as PolymarketSource | undefined;
    if (polymarketSource && marketsBySourceAndTier.has(MarketSource.POLYMARKET)) {
      const tierMap = marketsBySourceAndTier.get(MarketSource.POLYMARKET)!;
      
      for (const [tier, markets] of tierMap.entries()) {
        const tierKey = `POLYMARKET_${tier}`;
        const interval = this.getTierInterval(tier);
        const lastTracking = this.lastPriceTrackingTime[tierKey] || 0;
        
        if (now - lastTracking >= interval) {
          trackingPromises.push(this.trackPolymarketPrices(polymarketSource, markets));
          this.lastPriceTrackingTime[tierKey] = now;
        }
      }
    }

    // Kalshi price tracking
    const kalshiSource = this.sources.get(MarketSource.KALSHI) as KalshiSource | undefined;
    if (kalshiSource && marketsBySourceAndTier.has(MarketSource.KALSHI)) {
      const tierMap = marketsBySourceAndTier.get(MarketSource.KALSHI)!;
      
      for (const [tier, markets] of tierMap.entries()) {
        const tierKey = `KALSHI_${tier}`;
        const interval = this.getTierInterval(tier);
        const lastTracking = this.lastPriceTrackingTime[tierKey] || 0;
        
        if (now - lastTracking >= interval) {
          trackingPromises.push(this.trackKalshiPrices(kalshiSource, markets));
          this.lastPriceTrackingTime[tierKey] = now;
        }
      }
    }

    await Promise.allSettled(trackingPromises);
  }

  /**
   * Get polling interval for a volume tier
   */
  private getTierInterval(tier: string): number {
    switch (tier) {
      case 'HIGH':
        return config.polling.tiered.highVolume.interval;
      case 'MEDIUM':
        return config.polling.tiered.mediumVolume.interval;
      case 'LOW':
      default:
        return config.polling.tiered.lowVolume.interval;
    }
  }

  /**
   * Track Polymarket prices using CLOB API
   */
  private async trackPolymarketPrices(source: PolymarketSource, markets: any[]): Promise<void> {
    try {
      // Collect all CLOB token IDs
      const tokenIds: string[] = [];
      const tokenToMarketMap = new Map<string, { marketId: string; outcomeId: string }>();

      for (const sm of markets) {
        if (sm.clobTokenIds && Array.isArray(sm.clobTokenIds)) {
          for (let i = 0; i < sm.clobTokenIds.length; i++) {
            const tokenId = sm.clobTokenIds[i];
            tokenIds.push(tokenId);
            
            // Map token ID to outcome
            const outcome = sm.market.outcomes[i];
            if (outcome) {
              tokenToMarketMap.set(tokenId, {
                marketId: sm.marketId,
                outcomeId: outcome.id,
              });
            }
          }
        }
      }

      if (tokenIds.length === 0) return;

      // Fetch prices in batches of 50
      const batchSize = 50;
      for (let i = 0; i < tokenIds.length; i += batchSize) {
        const batch = tokenIds.slice(i, i + batchSize);
        const prices = await source.fetchCLOBPrices(batch);

        // Store price data
        const priceDataBatch: PriceData[] = [];
        for (const [tokenId, priceInfo] of prices.entries()) {
          const mapping = tokenToMarketMap.get(tokenId);
          if (mapping) {
            priceDataBatch.push({
              marketId: mapping.marketId,
              outcomeId: mapping.outcomeId,
              source: MarketSource.POLYMARKET,
              price: priceInfo.price,
              volume: priceInfo.volume,
              liquidity: priceInfo.liquidity,
              timestamp: new Date(),
            });
          }
        }

        if (priceDataBatch.length > 0) {
          await this.dbManager.storePriceDataBatch(priceDataBatch);
        }
      }

      this.logger.debug('Tracked Polymarket prices', {
        marketCount: markets.length,
        tokenCount: tokenIds.length,
      });
    } catch (error) {
      this.logger.error('Failed to track Polymarket prices', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Track Kalshi prices using order books API
   */
  private async trackKalshiPrices(source: KalshiSource, markets: any[]): Promise<void> {
    try {
      // Collect all market tickers
      const tickers = markets.map(sm => sm.sourceMarketId);
      
      if (tickers.length === 0) return;

      // Fetch order books
      const orderBooks = await source.fetchOrderBooks(tickers);

      // Store price data
      const priceDataBatch: PriceData[] = [];
      for (const sm of markets) {
        const book = orderBooks.get(sm.sourceMarketId);
        if (book && sm.market.outcomes.length > 0) {
          // For Kalshi, typically first outcome is "Yes"
          const yesOutcome = sm.market.outcomes.find((o: any) => o.title.toLowerCase() === 'yes') || sm.market.outcomes[0];
          
          if (yesOutcome) {
            // Use mid-price between bid and ask
            const price = (book.yesBid + book.yesAsk) / 2;
            
            priceDataBatch.push({
              marketId: sm.marketId,
              outcomeId: yesOutcome.id,
              source: MarketSource.KALSHI,
              price,
              timestamp: new Date(),
            });
          }
        }
      }

      if (priceDataBatch.length > 0) {
        await this.dbManager.storePriceDataBatch(priceDataBatch);
      }

      this.logger.debug('Tracked Kalshi prices', {
        marketCount: markets.length,
      });
    } catch (error) {
      this.logger.error('Failed to track Kalshi prices', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

  /**
   * Check if a market is resolved - be very aggressive in filtering
   */
  private isResolvedMarket(marketData: any, source: MarketSource): boolean {
    // Check status field (various formats)
    if (marketData.status) {
      const status = marketData.status.toString().toLowerCase();
      if (status === 'closed' || status === 'settled' || status === 'resolved' || 
          status === 'archived' || status === 'canceled' || status === 'cancelled') {
        return true;
      }
    }

    // Check boolean flags
    if (marketData.closed === true || marketData.settled === true || 
        marketData.resolved === true || marketData.archived === true) {
      return true;
    }

    // Check Polymarket-specific fields
    if (source === MarketSource.POLYMARKET) {
      if (marketData.closed || marketData.resolved || marketData.archived) {
        return true;
      }
      // Check if resolutionDate exists and is in the past
      if (marketData.resolutionDate) {
        const resolutionDate = new Date(marketData.resolutionDate);
        if (!isNaN(resolutionDate.getTime()) && resolutionDate < new Date()) {
          return true;
        }
      }
    }

    // Check Omen-specific fields
    if (source === MarketSource.OMEN) {
      if (marketData.resolutionTimestamp || marketData.currentAnswer) {
        return true;
      }
      // Check if resolutionTimestamp is in the past
      if (marketData.resolutionTimestamp) {
        const resolutionTs = typeof marketData.resolutionTimestamp === 'number' 
          ? marketData.resolutionTimestamp 
          : parseInt(marketData.resolutionTimestamp);
        if (!isNaN(resolutionTs) && resolutionTs * 1000 < Date.now()) {
          return true;
        }
      }
    }

    // Check Kalshi-specific fields
    if (source === MarketSource.KALSHI) {
      const status = (marketData.status || '').toLowerCase();
      if (status === 'closed' || status === 'settled' || status === 'resolved') {
        return true;
      }
      if (marketData.closed === true || marketData.settled === true || marketData.resolved === true) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a Kalshi market is a PLAYER prop parlay market
   * ONLY filter parlay markets that are specifically player props
   * Regular markets (non-parlay) should NOT be filtered
   */
  private isPlayerPropParlayMarket(marketData: any): boolean {
    // MUST be a parlay market first (has mve_collection_ticker)
    // If it's not a parlay, it's definitely not a player prop parlay - return false
    if (!marketData.mve_collection_ticker) {
      return false; // Not a parlay = not filtered = allow it through
    }

    // Now we know it's a parlay market, check if it's a PLAYER prop parlay
    // Get all text fields to search
    const category = (marketData.category || marketData.event_category || '').toLowerCase();
    const title = (marketData.title || marketData.event_title || '').toLowerCase();
    const subtitle = (marketData.subtitle || marketData.event_subtitle || '').toLowerCase();
    const description = (marketData.description || marketData.event_description || '').toLowerCase();

    // Check category - if it has "player" it's likely a player prop
    // But be careful - some categories might just say "player props" 
    if (category.includes('player prop') || (category.includes('player') && category.includes('prop'))) {
      return true; // This is a player prop parlay - filter it out
    }

    // Check title for specific player prop patterns - must be clear player prop indicators
    // Pattern: "Yes/No PlayerName: Stat" format
    const playerPropPattern = /(yes|no)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s*:\s*(points|yards|receptions|touches|tds?|goals?|assists?|rebounds?|passing|rushing|receiving)/i;
    
    // Pattern: "PlayerName over/under X points/yards" format
    const playerStatPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s+(?:to\s+)?(over|under|above|below)\s+\d+\s+(points|yards|receptions|touches|tds?|goals?|assists?|rebounds?|passing|rushing|receiving)/i;
    
    if (playerPropPattern.test(title) || playerPropPattern.test(subtitle) || playerPropPattern.test(description)) {
      return true; // Player prop pattern found - filter it out
    }
    
    if (playerStatPattern.test(title) || playerStatPattern.test(subtitle)) {
      return true; // Player stat pattern found - filter it out
    }

    // Check custom_strike for associated events - look for clear player prop indicators
    if (marketData.custom_strike?.['Associated Events']) {
      const associatedEvents = marketData.custom_strike['Associated Events'];
      if (typeof associatedEvents === 'string') {
        const eventsLower = associatedEvents.toLowerCase();
        // Must have BOTH player AND prop indicators
        if ((eventsLower.includes('player') && eventsLower.includes('prop')) ||
            playerPropPattern.test(associatedEvents) || 
            playerStatPattern.test(associatedEvents)) {
          return true; // Associated events suggest player props - filter it out
        }
      }
    }

    // Default: if it's a parlay but doesn't match player prop patterns, allow it through
    return false; // Not a player prop parlay = allow it through
  }
}
