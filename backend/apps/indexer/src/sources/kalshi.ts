import WebSocket from 'ws';
import axios from 'axios';
import { MarketSource, EventType } from '@repo/database';
import type { DataSource, MarketData, MarketEventData, SourceConfig } from '../types/index.js';
import { DataSourceError } from '../types/index.js';
import { MarketNormalizer } from '../core/normalizer.js';
import { createSourceLogger } from '../utils/logger.js';

export class KalshiSource implements DataSource {
  readonly name = MarketSource.KALSHI;
  readonly isActive: boolean;
  
  private ws?: WebSocket;
  private pollInterval?: NodeJS.Timeout;
  private readonly logger = createSourceLogger('kalshi');
  private readonly normalizer = new MarketNormalizer();
  private updateCallback?: (event: MarketEventData) => void;
  private authToken?: string;
  private lastSyncTime = 0;

  constructor(private config: SourceConfig) {
    this.isActive = config.enabled; // Market data is public, API key only needed for trading
  }

  async initialize(): Promise<void> {
    if (!this.isActive) {
      this.logger.info('Kalshi source is disabled');
      return;
    }

    this.logger.info('Initializing Kalshi source', {
      restEndpoint: this.config.restEndpoint,
      wsEndpoint: this.config.wsEndpoint,
    });

    // Authenticate if API key is provided (optional for public market data)
    if (this.config.apiKey) {
      try {
        await this.authenticate();
        this.logger.info('Kalshi authentication successful');
      } catch (error) {
        this.logger.warn('Kalshi authentication failed, continuing with public data only', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw error - continue without authentication for public data
      }
    } else {
      this.logger.info('No API key provided, using public market data only');
    }

    // Test connection
    try {
      await this.testConnection();
      this.logger.info('Kalshi API connection successful');
    } catch (error) {
      throw new DataSourceError(
        'Failed to connect to Kalshi API',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async startPolling(): Promise<void> {
    if (!this.isActive) return;

    this.logger.info('Starting Kalshi polling', {
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
    this.logger.info('Stopped Kalshi polling');
  }

  async getMarkets(): Promise<MarketData[]> {
    if (!this.isActive) return [];

    try {
      const response = await this.makeAuthenticatedRequest('/trade-api/v2/markets', {
        limit: 100,
        status: 'open',
      });

      const markets: MarketData[] = [];
      
      for (const marketData of response.data.markets || []) {
        try {
          const normalized = await this.normalizer.normalizeMarket(
            marketData,
            this.name,
            marketData.ticker || marketData.id
          );
          markets.push(normalized.marketData);
        } catch (error) {
          this.logger.warn('Failed to normalize market', {
            marketId: marketData.ticker || marketData.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('Fetched markets from Kalshi', {
        count: markets.length,
      });

      return markets;
    } catch (error) {
      this.logger.error('Failed to fetch markets', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DataSourceError(
        'Failed to fetch markets from Kalshi',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async subscribeToUpdates(callback: (event: MarketEventData) => void): Promise<void> {
    if (!this.isActive || !this.config.wsEndpoint) return;

    this.updateCallback = callback;

    // Note: Kalshi WebSocket requires authentication
    // For now, we'll rely on REST polling which works without auth
    this.logger.info('WebSocket subscription skipped - using REST polling instead');
    return;

    /* WebSocket implementation disabled - needs proper authentication
    try {
      this.ws = new WebSocket(this.config.wsEndpoint, {
        headers: this.authToken ? {
          'Authorization': `Bearer ${this.authToken}`,
        } : undefined,
      });

      this.ws.on('open', () => {
        this.logger.info('WebSocket connection established');
        
        // Subscribe to market updates
        this.ws?.send(JSON.stringify({
          id: Date.now(),
          cmd: 'subscribe',
          params: {
            channels: ['orderbook_delta', 'ticker'],
          },
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

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error', { error: error.message });
      });

      this.ws.on('close', (code, reason) => {
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

  private async authenticate(): Promise<void> {
    if (!this.config.apiKey) return;

    try {
      const response = await axios.post(`${this.config.restEndpoint}/login`, {
        email: this.config.apiKey, // Assuming API key is email for demo
        password: process.env.KALSHI_PASSWORD, // Would need password too
      }, {
        timeout: 10000,
      });

      this.authToken = response.data.token;
    } catch (error) {
      throw new Error('Authentication failed');
    }
  }

  private async testConnection(): Promise<void> {
    const response = await this.makeAuthenticatedRequest('/trade-api/v2/markets', { limit: 1 });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async makeAuthenticatedRequest(endpoint: string, params?: any): Promise<any> {
    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      return await axios.get(`${this.config.restEndpoint}${endpoint}`, {
        params,
        headers,
        timeout: 30000,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error('Kalshi API request failed', {
          endpoint,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
      }
      throw error;
    }
  }

  private async pollMarkets(): Promise<void> {
    try {
      const currentTime = Date.now();
      
      // Fetch recent market updates
      const response = await this.makeAuthenticatedRequest('/trade-api/v2/markets', {
        limit: 100,
        status: 'open',
      });

      for (const marketData of response.data.markets || []) {
        if (this.updateCallback) {
          const event: MarketEventData = {
            marketId: marketData.ticker || marketData.id,
            source: this.name,
            eventType: EventType.MARKET_UPDATED,
            timestamp: new Date(),
            data: {
              market: marketData,
            },
            rawPayload: marketData,
          };

          this.updateCallback(event);
        }
      }

      this.lastSyncTime = currentTime;
      
      this.logger.debug('Polling completed', {
        marketsProcessed: response.data.markets?.length || 0,
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
        case 'orderbook_delta':
          eventType = EventType.PRICE_UPDATE;
          marketData = message.msg;
          break;
        case 'ticker':
          eventType = EventType.MARKET_UPDATED;
          marketData = message.msg;
          break;
        default:
          this.logger.debug('Unknown message type', { type: message.type });
          return;
      }

      const event: MarketEventData = {
        marketId: marketData.ticker || marketData.market_ticker || marketData.id,
        source: this.name,
        eventType,
        timestamp: new Date(message.ts || Date.now()),
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
