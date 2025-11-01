import { MarketSource } from '@repo/database';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { checkDatabaseConnection, disconnectDatabase } from '../utils/database.js';
import { PolymarketCollector } from '../collectors/PolymarketCollector.js';
import { KalshiCollector } from '../collectors/KalshiCollector.js';
import { PolymarketCLOBWebSocket, PolymarketGammaWebSocket } from '../websocket/PolymarketWebSocket.js';
import { KalshiWebSocket } from '../websocket/KalshiWebSocket.js';
import { MarketProcessor } from '../processors/MarketProcessor.js';
import { PriceProcessor } from '../processors/PriceProcessor.js';
import { TradeProcessor } from '../processors/TradeProcessor.js';
import { LeaderboardProcessor } from '../processors/LeaderboardProcessor.js';
import { MarketNormalizer } from '../normalizers/MarketNormalizer.js';
import { LeaderboardNormalizer } from '../normalizers/LeaderboardNormalizer.js';
import { PollingScheduler } from '../scheduler/PollingScheduler.js';
import { IndexerStateManager } from './indexerStateManager.js';

/**
 * Main indexer service that coordinates all collectors and processors
 */
export class IndexerService {
  private isRunning = false;
  private scheduler = new PollingScheduler();
  private stateManager = new IndexerStateManager();

  // Collectors
  private polymarketCollector?: PolymarketCollector;
  private kalshiCollector?: KalshiCollector;

  // WebSockets
  private polymarketCLOBWS?: PolymarketCLOBWebSocket;
  private polymarketGammaWS?: PolymarketGammaWebSocket;
  private kalshiWS?: KalshiWebSocket;

  // Processors
  private marketProcessor = new MarketProcessor();
  private priceProcessor = new PriceProcessor();
  private tradeProcessor = new TradeProcessor();
  private leaderboardProcessor = new LeaderboardProcessor();

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Indexer is already running');
      return;
    }

    logger.info('Starting indexer service...', {
      sources: config.enabledSources,
    });

    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Initialize collectors
    this.initializeCollectors();

    // Initialize WebSockets
    await this.initializeWebSockets();

    // Schedule polling tasks
    this.scheduleTasks();

    this.isRunning = true;
    logger.info('Indexer service started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping indexer service...');
    this.isRunning = false;

    // Stop all scheduled tasks
    this.scheduler.unscheduleAll();

    // Disconnect WebSockets
    this.polymarketCLOBWS?.disconnect();
    this.polymarketGammaWS?.disconnect();
    this.kalshiWS?.disconnect();

    // Disconnect from database
    await disconnectDatabase();

    logger.info('Indexer service stopped');
  }

  private initializeCollectors(): void {
    if (config.enabledSources.includes(MarketSource.POLYMARKET)) {
      this.polymarketCollector = new PolymarketCollector();
      logger.info('Initialized Polymarket collector');
    }

    if (config.enabledSources.includes(MarketSource.KALSHI)) {
      try {
        this.kalshiCollector = new KalshiCollector();
        logger.info('Initialized Kalshi collector');
      } catch (error) {
        logger.error('Failed to initialize Kalshi collector', { error });
      }
    }
  }

  private async initializeWebSockets(): Promise<void> {
    if (config.enabledSources.includes(MarketSource.POLYMARKET)) {
      try {
        this.polymarketCLOBWS = new PolymarketCLOBWebSocket();
        this.polymarketGammaWS = new PolymarketGammaWebSocket();

        // Connect WebSockets
        await Promise.all([
          this.polymarketCLOBWS.connect(),
          this.polymarketGammaWS.connect(),
        ]);

        // Setup event handlers
        this.setupPolymarketWebSocketHandlers();

        logger.info('Polymarket WebSockets connected');
      } catch (error) {
        logger.error('Failed to connect Polymarket WebSockets', { error });
      }
    }

    if (config.enabledSources.includes(MarketSource.KALSHI) && this.kalshiCollector) {
      try {
        this.kalshiWS = new KalshiWebSocket();
        await this.kalshiWS.connect();

        this.setupKalshiWebSocketHandlers();

        logger.info('Kalshi WebSocket connected');
      } catch (error) {
        logger.error('Failed to connect Kalshi WebSocket', { error });
      }
    }
  }

  private setupPolymarketWebSocketHandlers(): void {
    if (!this.polymarketCLOBWS) return;

    this.polymarketCLOBWS.on('trade', async (data) => {
      logger.debug('Received Polymarket trade', { data });
      // Process real-time trade
    });

    this.polymarketCLOBWS.on('ticker', async (data) => {
      logger.debug('Received Polymarket ticker', { data });
      // Process real-time price update
    });
  }

  private setupKalshiWebSocketHandlers(): void {
    if (!this.kalshiWS) return;

    this.kalshiWS.on('trade', async (data) => {
      logger.debug('Received Kalshi trade', { data });
      // Process real-time trade
    });

    this.kalshiWS.on('ticker', async (data) => {
      logger.debug('Received Kalshi ticker', { data });
      // Process real-time price update
    });
  }

  private scheduleTasks(): void {
    const baseInterval = config.pollInterval;

    // Schedule Polymarket tasks
    if (this.polymarketCollector) {
      // Fetch markets
      this.scheduler.schedule({
        name: 'polymarket-markets',
        intervalMs: baseInterval,
        runImmediately: true,
        task: () => this.syncPolymarketMarkets(),
      });

      // Fetch leaderboard
      this.scheduler.schedule({
        name: 'polymarket-leaderboard',
        intervalMs: baseInterval * 5, // Less frequent
        runImmediately: true,
        task: () => this.syncPolymarketLeaderboard(),
      });
    }

    // Schedule Kalshi tasks
    if (this.kalshiCollector) {
      // Fetch markets
      this.scheduler.schedule({
        name: 'kalshi-markets',
        intervalMs: baseInterval,
        runImmediately: true,
        task: () => this.syncKalshiMarkets(),
      });
    }

    logger.info('Scheduled all polling tasks', {
      tasks: this.scheduler.getScheduledTasks(),
    });
  }

  private async syncPolymarketMarkets(): Promise<void> {
    if (!this.polymarketCollector) return;

    try {
      logger.info('Syncing Polymarket markets...');
      let totalProcessed = 0;

      // Fetch active markets
      for await (const markets of this.polymarketCollector.fetchAllMarkets({ active: true })) {
        const normalized = markets
          .map((m) => MarketNormalizer.normalizePolymarketMarket(m))
          .filter((m) => m !== null);

        const count = await this.marketProcessor.processMarkets(normalized);
        totalProcessed += count;
      }

      // Update state
      await this.stateManager.updateSyncState(MarketSource.POLYMARKET);

      logger.info(`Synced ${totalProcessed} Polymarket markets`);
    } catch (error) {
      logger.error('Error syncing Polymarket markets', { error });
    }
  }

  private async syncPolymarketLeaderboard(): Promise<void> {
    if (!this.polymarketCollector) return;

    try {
      logger.info('Syncing Polymarket leaderboard...');

      const leaderboard = await this.polymarketCollector.fetchLeaderboard();
      const normalized = leaderboard
        .map((entry) => LeaderboardNormalizer.normalizePolymarketTrader(entry))
        .filter((t) => t !== null);

      const count = await this.leaderboardProcessor.processTraders(normalized);

      // Create snapshot
      await this.leaderboardProcessor.createLeaderboardSnapshot(MarketSource.POLYMARKET);

      logger.info(`Synced ${count} Polymarket traders`);
    } catch (error) {
      logger.error('Error syncing Polymarket leaderboard', { error });
    }
  }

  private async syncKalshiMarkets(): Promise<void> {
    if (!this.kalshiCollector) return;

    try {
      logger.info('Syncing Kalshi markets...');
      let totalProcessed = 0;

      // Fetch active markets
      for await (const markets of this.kalshiCollector.fetchAllMarkets({ status: 'open' })) {
        const normalized = markets
          .map((m) => MarketNormalizer.normalizeKalshiMarket(m))
          .filter((m) => m !== null);

        const count = await this.marketProcessor.processMarkets(normalized);
        totalProcessed += count;
      }

      // Update state
      await this.stateManager.updateSyncState(MarketSource.KALSHI);

      logger.info(`Synced ${totalProcessed} Kalshi markets`);
    } catch (error) {
      logger.error('Error syncing Kalshi markets', { error });
    }
  }
}
