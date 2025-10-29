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
      const response = await axios.get(`${this.config.restEndpoint}/events`, {
        params: {
          limit: 100,
          offset: 0,
          active: true,
        },
        timeout: 30000,
      });

      const markets: MarketData[] = [];
      
      // Polymarket /events endpoint returns events with nested markets
      for (const eventData of response.data) {
        try {
          // Each event can have multiple markets
          const eventMarkets = eventData.markets || [];
          
          for (const marketData of eventMarkets) {
            try {
              // Add event-level data to market data
              const enrichedMarketData = {
                ...marketData,
                event_title: eventData.title,
                event_description: eventData.description,
                event_slug: eventData.slug,
              };
              
              // Fetch token information from CLOB API
              try {
                const clobResponse = await axios.get('https://clob.polymarket.com/markets', {
                  params: { condition_id: marketData.condition_id },
                  timeout: 10000,
                });
                
                if (clobResponse.data?.data && clobResponse.data.data.length > 0) {
                  const clobMarket = clobResponse.data.data[0];
                  if (clobMarket.tokens && clobMarket.tokens.length > 0) {
                    // Add token information to market data
                    enrichedMarketData.tokens = clobMarket.tokens;
                    enrichedMarketData.token_id = clobMarket.tokens[0].token_id; // Store first token_id
                  }
                }
              } catch (clobError) {
                this.logger.debug('Failed to fetch CLOB token data', {
                  conditionId: marketData.condition_id,
                  error: clobError instanceof Error ? clobError.message : String(clobError),
                });
              }
              
              const normalized = await this.normalizer.normalizeMarket(
                enrichedMarketData,
                this.name,
                marketData.condition_id || marketData.id
              );
              markets.push(normalized.marketData);
            } catch (error) {
              this.logger.debug('Failed to normalize market', {
                marketId: marketData.condition_id || marketData.id,
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
