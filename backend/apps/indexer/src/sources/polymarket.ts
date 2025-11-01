import WebSocket from 'ws';
import axios from 'axios';
import { MarketSource, EventType } from '@repo/database';
import type { DataSource, MarketData, MarketEventData, SourceConfig } from '../types/index.js';
import { DataSourceError } from '../types/index.js';
import { MarketNormalizer } from '../core/normalizer.js';
import { createSourceLogger } from '../utils/logger.js';

export class PolymarketSource implements DataSource {
  readonly name = MarketSource.POLYMARKET;
  readonly isActive: boolean;
  
  private ws?: WebSocket;
  private pollInterval?: NodeJS.Timeout;
  private readonly logger = createSourceLogger('polymarket');
  private readonly normalizer = new MarketNormalizer();
  private updateCallback?: (event: MarketEventData) => void;
  private lastSyncTime = 0;

  constructor(private config: SourceConfig) {
    this.isActive = config.enabled;
  }

  async initialize(): Promise<void> {
    if (!this.isActive) {
      this.logger.info('Polymarket source is disabled');
      return;
    }

    this.logger.info('Initializing Polymarket source', {
      restEndpoint: this.config.restEndpoint,
      wsEndpoint: this.config.wsEndpoint,
    });

    // Test REST API connection
    try {
      await this.testConnection();
      this.logger.info('Polymarket REST API connection successful');
    } catch (error) {
      throw new DataSourceError(
        'Failed to connect to Polymarket REST API',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async startPolling(): Promise<void> {
    if (!this.isActive) return;

    this.logger.info('Starting Polymarket polling', {
      interval: this.config.pollInterval,
    });

    // Initial fetch
    await this.pollMarkets();

    // Set up recurring polling
    if (this.config.pollInterval) {
      this.pollInterval = setInterval(async () => {
        try {
          await this.pollMarkets();
        } catch (error) {
          this.logger.error('Error during polling', {
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
    this.logger.info('Stopped Polymarket polling');
  }

  async getMarkets(): Promise<MarketData[]> {
    if (!this.isActive) return [];

    try {
      // Use /events/pagination endpoint with proper filters
      const response = await axios.get(`${this.config.restEndpoint}/events/pagination`, {
        params: {
          limit: 100,
          active: true,
          archived: false,
          closed: false,
          order: 'volume',
          ascending: false,
        },
        timeout: 30000,
      });

      const markets: MarketData[] = [];
      const events = response.data?.data || response.data || [];
      
      // Polymarket /events/pagination returns events with nested markets
      for (const eventData of events) {
        try {
          // Each event can have multiple markets
          const eventMarkets = eventData.markets || [];
          
          for (const marketData of eventMarkets) {
            try {
              // Skip closed, archived, or resolved markets - be more aggressive
              const status = (marketData.status || '').toLowerCase();
              if (marketData.closed || marketData.archived || marketData.resolved ||
                  status === 'closed' || status === 'settled' || status === 'resolved' ||
                  status === 'archived' || status === 'canceled' || status === 'cancelled') {
                this.logger.debug('Skipping resolved/closed market from Polymarket', {
                  conditionId: marketData.conditionId || marketData.condition_id || marketData.id,
                  closed: marketData.closed,
                  archived: marketData.archived,
                  resolved: marketData.resolved,
                  status: marketData.status,
                });
                continue;
              }

              // Add event-level data to market data
              const enrichedMarketData = {
                ...marketData,
                event_title: eventData.title,
                event_description: eventData.description,
                event_slug: eventData.slug,
                event_category: eventData.category,
                event_tags: eventData.tags,
              };
              
              // Extract CLOB token IDs from market data
              if (marketData.clobTokenIds && Array.isArray(marketData.clobTokenIds)) {
                enrichedMarketData.clobTokenIds = marketData.clobTokenIds;
              }
              
              const normalized = await this.normalizer.normalizeMarket(
                enrichedMarketData,
                this.name,
                marketData.conditionId || marketData.condition_id || marketData.id
              );
              markets.push(normalized.marketData);
            } catch (error) {
              this.logger.debug('Failed to normalize market', {
                marketId: marketData.conditionId || marketData.condition_id || marketData.id,
                error: error instanceof Error ? error.message : String(error),
                marketData: JSON.stringify(marketData).substring(0, 200),
              });
            }
          }
        } catch (error) {
          this.logger.warn('Failed to process event', {
            eventId: eventData.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('Fetched markets from Polymarket', {
        count: markets.length,
      });

      return markets;
    } catch (error) {
      this.logger.error('Failed to fetch markets', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DataSourceError(
        'Failed to fetch markets from Polymarket',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Fetch current prices from CLOB API for given token IDs
   */
  async fetchCLOBPrices(tokenIds: string[]): Promise<Map<string, { price: number; volume?: number; liquidity?: number }>> {
    if (!this.config.clobEndpoint || tokenIds.length === 0) {
      return new Map();
    }

    try {
      // Batch request for last trade prices
      const response = await axios.post(
        `${this.config.clobEndpoint}/last-trades-prices`,
        { token_ids: tokenIds },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      const priceMap = new Map<string, { price: number; volume?: number; liquidity?: number }>();
      
      if (response.data && typeof response.data === 'object') {
        for (const [tokenId, priceData] of Object.entries(response.data)) {
          if (typeof priceData === 'object' && priceData !== null) {
            const data = priceData as any;
            priceMap.set(tokenId, {
              price: parseFloat(data.price || data.last_price || '0'),
              volume: data.volume ? parseFloat(data.volume) : undefined,
              liquidity: data.liquidity ? parseFloat(data.liquidity) : undefined,
            });
          }
        }
      }

      this.logger.debug('Fetched CLOB prices', {
        tokenCount: tokenIds.length,
        pricesFound: priceMap.size,
      });

      return priceMap;
    } catch (error) {
      this.logger.error('Failed to fetch CLOB prices', {
        tokenCount: tokenIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return new Map();
    }
  }

  /**
   * Fetch order books from CLOB API for given token IDs
   */
  async fetchCLOBOrderBooks(tokenIds: string[]): Promise<Map<string, { bestBid: number; bestAsk: number }>> {
    if (!this.config.clobEndpoint || tokenIds.length === 0) {
      return new Map();
    }

    try {
      // Batch request for order books
      const response = await axios.post(
        `${this.config.clobEndpoint}/books`,
        { token_ids: tokenIds },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      const orderBookMap = new Map<string, { bestBid: number; bestAsk: number }>();
      
      if (Array.isArray(response.data)) {
        for (const book of response.data) {
          if (book.token_id && (book.bids || book.asks)) {
            const bestBid = book.bids && book.bids.length > 0 ? parseFloat(book.bids[0].price) : 0;
            const bestAsk = book.asks && book.asks.length > 0 ? parseFloat(book.asks[0].price) : 0;
            
            orderBookMap.set(book.token_id, { bestBid, bestAsk });
          }
        }
      }

      this.logger.debug('Fetched CLOB order books', {
        tokenCount: tokenIds.length,
        booksFound: orderBookMap.size,
      });

      return orderBookMap;
    } catch (error) {
      this.logger.error('Failed to fetch CLOB order books', {
        tokenCount: tokenIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return new Map();
    }
  }

  async subscribeToUpdates(callback: (event: MarketEventData) => void): Promise<void> {
    if (!this.isActive || !this.config.wsEndpoint) return;

    this.updateCallback = callback;

    // Note: Polymarket WebSocket requires special authentication
    // For now, we'll rely on REST polling which is more reliable
    this.logger.info('WebSocket subscription skipped - using REST polling instead');
    return;

    /* WebSocket implementation disabled - needs proper authentication
    try {
      this.ws = new WebSocket(this.config.wsEndpoint);

      this.ws.on('open', () => {
        this.logger.info('WebSocket connection established');
        
        // Subscribe to market updates
        this.ws?.send(JSON.stringify({
          type: 'subscribe',
          channel: 'market_updates',
        }));
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          this.logger.error('Failed to parse WebSocket message', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      this.ws.on('error', (error: Error) => {
        this.logger.error('WebSocket error', { error: error.message });
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.logger.warn('WebSocket connection closed', {
          code,
          reason: reason.toString(),
        });
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (this.updateCallback) {
            this.subscribeToUpdates(this.updateCallback);
          }
        }, 5000);
      });

    } catch (error) {
      throw new DataSourceError(
        'Failed to establish WebSocket connection',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
    */
  }

  async unsubscribeFromUpdates(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.updateCallback = undefined;
    this.logger.info('Unsubscribed from WebSocket updates');
  }

  private async testConnection(): Promise<void> {
    const response = await axios.get(`${this.config.restEndpoint}/events`, {
      params: { limit: 1 },
      timeout: 10000,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async pollMarkets(): Promise<void> {
    try {
      const currentTime = Date.now();
      
      // Fetch recent market updates
      const response = await axios.get(`${this.config.restEndpoint}/events`, {
        params: {
          limit: 100,
          offset: 0,
          active: true,
          // Only fetch markets updated since last sync
          updated_after: this.lastSyncTime > 0 ? new Date(this.lastSyncTime).toISOString() : undefined,
        },
        timeout: 30000,
      });

      // Polymarket /events endpoint returns events with nested markets
      for (const eventData of response.data) {
        if (this.updateCallback) {
          // Each event can have multiple markets
          const eventMarkets = eventData.markets || [];
          
          for (const marketData of eventMarkets) {
            // Skip closed, archived, or resolved markets
            if (marketData.closed || marketData.archived || marketData.resolved) {
              this.logger.debug('Skipping resolved/closed market during polling', {
                conditionId: marketData.condition_id || marketData.id,
                closed: marketData.closed,
                archived: marketData.archived,
                resolved: marketData.resolved,
              });
              continue;
            }

            // Add event-level data to market data
            const enrichedMarketData = {
              ...marketData,
              event_title: eventData.title,
              event_description: eventData.description,
              event_slug: eventData.slug,
            };
            
            const event: MarketEventData = {
              marketId: marketData.condition_id || marketData.id,
              source: this.name,
              eventType: EventType.MARKET_UPDATED,
              timestamp: new Date(),
              data: {
                market: enrichedMarketData,
              },
              rawPayload: enrichedMarketData,
            };

            this.updateCallback(event);
          }
        }
      }

      this.lastSyncTime = currentTime;
      
      this.logger.debug('Polling completed', {
        marketsProcessed: response.data.length,
      });

    } catch (error) {
      this.logger.error('Polling failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleWebSocketMessage(message: any): Promise<void> {
    if (!this.updateCallback) return;

    try {
      let eventType: EventType;
      let marketData: any;

      switch (message.type) {
        case 'market_update':
          eventType = EventType.MARKET_UPDATED;
          marketData = message.data;
          break;
        case 'price_update':
          eventType = EventType.PRICE_UPDATE;
          marketData = message.data;
          break;
        case 'volume_update':
          eventType = EventType.VOLUME_UPDATE;
          marketData = message.data;
          break;
        default:
          this.logger.debug('Unknown message type', { type: message.type });
          return;
      }

      const event: MarketEventData = {
        marketId: marketData.condition_id || marketData.market_id || marketData.id,
        source: this.name,
        eventType,
        timestamp: new Date(message.timestamp || Date.now()),
        data: marketData,
        rawPayload: message,
      };

      this.updateCallback(event);

    } catch (error) {
      this.logger.error('Failed to handle WebSocket message', {
        message,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
