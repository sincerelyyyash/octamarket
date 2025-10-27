import { MarketSource, EventType } from '@repo/database';
import { TradeStatus } from '../types/index.js';
import type { 
  MarketEventData, 
  PriceData, 
  TradeData,
  TraderData,
  LeaderboardData,
  TraderFollowData
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

interface QueueItem<T> {
  id: string;
  data: T;
  timestamp: Date;
  retryCount: number;
}

interface QueueConfig {
  batchSize: number;
  flushInterval: number; // in milliseconds
  maxRetries: number;
  retryDelay: number; // in milliseconds
}

export class QueueManager {
  private readonly logger = logger.child({ component: 'queueManager' });
  
  // Separate queues for different data types
  private marketEventsQueue: QueueItem<MarketEventData>[] = [];
  private priceDataQueue: QueueItem<PriceData>[] = [];
  private tradeDataQueue: QueueItem<TradeData>[] = [];
  private traderDataQueue: QueueItem<TraderData>[] = [];
  private leaderboardQueue: QueueItem<LeaderboardData>[] = [];
  private traderFollowQueue: QueueItem<TraderFollowData>[] = [];
  
  private flushIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isProcessing = false;
  
  private readonly config: QueueConfig = {
    batchSize: config.queue.batchSize,
    flushInterval: config.queue.flushInterval,
    maxRetries: config.queue.maxRetries,
    retryDelay: config.queue.retryDelay,
  };

  constructor(private dbManager: any) {
    this.startFlushIntervals();
  }

  /**
   * Add market event to queue
   */
  enqueueMarketEvent(event: MarketEventData): void {
    const item: QueueItem<MarketEventData> = {
      id: `${event.source}_${event.marketId}_${event.eventType}_${Date.now()}`,
      data: event,
      timestamp: new Date(),
      retryCount: 0,
    };
    
    this.marketEventsQueue.push(item);
    this.logger.debug('Enqueued market event', {
      queueSize: this.marketEventsQueue.length,
      eventType: event.eventType,
      source: event.source,
    });
  }

  /**
   * Add price data to queue
   */
  enqueuePriceData(priceData: PriceData): void {
    const item: QueueItem<PriceData> = {
      id: `${priceData.source}_${priceData.marketId}_${priceData.outcomeId || 'default'}_${Date.now()}`,
      data: priceData,
      timestamp: new Date(),
      retryCount: 0,
    };
    
    this.priceDataQueue.push(item);
    this.logger.debug('Enqueued price data', {
      queueSize: this.priceDataQueue.length,
      source: priceData.source,
    });
  }

  /**
   * Add trade data to queue
   */
  enqueueTradeData(trade: TradeData): void {
    const item: QueueItem<TradeData> = {
      id: `${trade.source}_${trade.sourceTradeId}_${Date.now()}`,
      data: trade,
      timestamp: new Date(),
      retryCount: 0,
    };
    
    this.tradeDataQueue.push(item);
    this.logger.debug('Enqueued trade data', {
      queueSize: this.tradeDataQueue.length,
      source: trade.source,
    });
  }

  /**
   * Add trader data to queue
   */
  enqueueTraderData(trader: TraderData): void {
    const item: QueueItem<TraderData> = {
      id: `${trader.source}_${trader.sourceTraderId}_${Date.now()}`,
      data: trader,
      timestamp: new Date(),
      retryCount: 0,
    };
    
    this.traderDataQueue.push(item);
    this.logger.debug('Enqueued trader data', {
      queueSize: this.traderDataQueue.length,
      source: trader.source,
    });
  }

  /**
   * Add leaderboard data to queue
   */
  enqueueLeaderboardData(leaderboard: LeaderboardData): void {
    const item: QueueItem<LeaderboardData> = {
      id: `${leaderboard.source}_leaderboard_${Date.now()}`,
      data: leaderboard,
      timestamp: new Date(),
      retryCount: 0,
    };
    
    this.leaderboardQueue.push(item);
    this.logger.debug('Enqueued leaderboard data', {
      queueSize: this.leaderboardQueue.length,
      source: leaderboard.source,
    });
  }

  /**
   * Add trader follow data to queue
   */
  enqueueTraderFollowData(follow: TraderFollowData): void {
    const item: QueueItem<TraderFollowData> = {
      id: `${follow.followerId}_${follow.followingId}_${Date.now()}`,
      data: follow,
      timestamp: new Date(),
      retryCount: 0,
    };
    
    this.traderFollowQueue.push(item);
    this.logger.debug('Enqueued trader follow data', {
      queueSize: this.traderFollowQueue.length,
    });
  }

  /**
   * Start flush intervals for all queues
   */
  private startFlushIntervals(): void {
    const queues = [
      { name: 'marketEvents', queue: this.marketEventsQueue },
      { name: 'priceData', queue: this.priceDataQueue },
      { name: 'tradeData', queue: this.tradeDataQueue },
      { name: 'traderData', queue: this.traderDataQueue },
      { name: 'leaderboard', queue: this.leaderboardQueue },
      { name: 'traderFollow', queue: this.traderFollowQueue },
    ];

    queues.forEach(({ name, queue }) => {
      const interval = setInterval(async () => {
        await this.flushQueue(name, queue);
      }, this.config.flushInterval);
      
      this.flushIntervals.set(name, interval);
    });

    this.logger.info('Started queue flush intervals', {
      interval: this.config.flushInterval,
      batchSize: this.config.batchSize,
    });
  }

  /**
   * Flush a specific queue
   */
  private async flushQueue(queueName: string, queue: QueueItem<any>[]): Promise<void> {
    if (queue.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      // Process in batches
      const batches = this.createBatches(queue, this.config.batchSize);
      
      for (const batch of batches) {
        await this.processBatch(queueName, batch);
      }
      
      // Clear successfully processed items
      queue.splice(0, queue.length);
      
      this.logger.debug(`Flushed ${queueName} queue`, {
        itemsProcessed: batches.flat().length,
        batches: batches.length,
      });
      
    } catch (error) {
      this.logger.error(`Failed to flush ${queueName} queue`, {
        error: error instanceof Error ? error.message : String(error),
        queueSize: queue.length,
      });
      
      // Handle retries for failed items
      await this.handleFailedItems(queue);
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a batch of items
   */
  private async processBatch(queueName: string, batch: QueueItem<any>[]): Promise<void> {
    const items = batch.map(item => item.data);
    
    try {
      switch (queueName) {
        case 'marketEvents':
          await this.dbManager.storeMarketEventsBatch(items);
          break;
        case 'priceData':
          await this.dbManager.storePriceDataBatch(items);
          break;
        case 'tradeData':
          await this.dbManager.storeTradesBatch(items);
          break;
        case 'traderData':
          await this.dbManager.storeTradersBatch(items);
          break;
        case 'leaderboard':
          await this.dbManager.storeLeaderboardSnapshotBatch(items);
          break;
        case 'traderFollow':
          await this.dbManager.storeTraderFollowsBatch(items);
          break;
        default:
          throw new Error(`Unknown queue type: ${queueName}`);
      }
      
      this.logger.debug(`Processed ${queueName} batch`, {
        batchSize: batch.length,
      });
      
    } catch (error) {
      this.logger.error(`Failed to process ${queueName} batch`, {
        error: error instanceof Error ? error.message : String(error),
        batchSize: batch.length,
      });
      throw error;
    }
  }

  /**
   * Handle failed items with retry logic
   */
  private async handleFailedItems(queue: QueueItem<any>[]): Promise<void> {
    const failedItems: QueueItem<any>[] = [];
    
    for (const item of queue) {
      if (item.retryCount < this.config.maxRetries) {
        item.retryCount++;
        failedItems.push(item);
        
        // Add delay before retry
        setTimeout(() => {
          queue.push(item);
        }, this.config.retryDelay * item.retryCount);
        
      } else {
        this.logger.error('Item exceeded max retries, dropping', {
          itemId: item.id,
          retryCount: item.retryCount,
        });
      }
    }
    
    // Clear original queue and add failed items back
    queue.splice(0, queue.length);
    queue.push(...failedItems);
  }

  /**
   * Create batches from queue items
   */
  private createBatches<T>(items: QueueItem<T>[], batchSize: number): QueueItem<T>[][] {
    const batches: QueueItem<T>[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Force flush all queues (useful for shutdown)
   */
  async flushAll(): Promise<void> {
    this.logger.info('Force flushing all queues');
    
    const queues = [
      { name: 'marketEvents', queue: this.marketEventsQueue },
      { name: 'priceData', queue: this.priceDataQueue },
      { name: 'tradeData', queue: this.tradeDataQueue },
      { name: 'traderData', queue: this.traderDataQueue },
      { name: 'leaderboard', queue: this.leaderboardQueue },
      { name: 'traderFollow', queue: this.traderFollowQueue },
    ];

    for (const { name, queue } of queues) {
      if (queue.length > 0) {
        await this.flushQueue(name, queue);
      }
    }
    
    this.logger.info('All queues flushed');
  }

  /**
   * Get queue statistics
   */
  getStats(): Record<string, number> {
    return {
      marketEvents: this.marketEventsQueue.length,
      priceData: this.priceDataQueue.length,
      tradeData: this.tradeDataQueue.length,
      traderData: this.traderDataQueue.length,
      leaderboard: this.leaderboardQueue.length,
      traderFollow: this.traderFollowQueue.length,
    };
  }

  /**
   * Stop all flush intervals
   */
  stop(): void {
    this.flushIntervals.forEach((interval, name) => {
      clearInterval(interval);
      this.logger.debug(`Stopped ${name} flush interval`);
    });
    
    this.flushIntervals.clear();
    this.logger.info('Stopped all queue flush intervals');
  }
}
