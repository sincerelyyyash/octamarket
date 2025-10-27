import { GraphQLClient } from 'graphql-request';
import { MarketSource, EventType } from '@repo/database';
import type { DataSource, MarketData, MarketEventData, SourceConfig } from '../types/index.js';
import { DataSourceError } from '../types/index.js';
import { MarketNormalizer } from '../core/normalizer.js';
import { createSourceLogger } from '../utils/logger.js';
import { rateLimiter } from '../utils/rateLimiter.js';

const MARKETS_QUERY = `
  query GetMarkets($first: Int!, $skip: Int!, $where: Market_filter) {
    markets(first: $first, skip: $skip, where: $where, orderBy: creationTimestamp, orderDirection: desc) {
      id
      description
      extraInfo
      category
      marketStatus
      endTime
      finalizationTime
      volume
      creationTimestamp
      outcomes {
        id
        description
        price
        volume
      }
    }
  }
`;

const MARKET_UPDATES_QUERY = `
  query GetMarketUpdates($timestamp: BigInt!) {
    markets(where: { updatedAt_gt: $timestamp }, orderBy: updatedAt, orderDirection: asc) {
      id
      description
      extraInfo
      category
      marketStatus
      endTime
      finalizationTime
      volume
      updatedAt
      outcomes {
        id
        description
        price
        volume
      }
    }
  }
`;

export class AugurSource implements DataSource {
  readonly name = MarketSource.AUGUR;
  readonly isActive: boolean;
  
  private client: GraphQLClient;
  private pollInterval?: NodeJS.Timeout;
  private readonly logger = createSourceLogger('augur');
  private readonly normalizer = new MarketNormalizer();
  private updateCallback?: (event: MarketEventData) => void;
  private lastSyncTimestamp = 0;

  constructor(private config: SourceConfig) {
    this.isActive = config.enabled && !!config.graphqlEndpoint;
    
    // Initialize GraphQL client with API key if provided
    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    
    // Use the endpoint without query parameter, add API key to headers instead
    const endpoint = config.graphqlEndpoint!.split('?')[0];
    
    this.client = new GraphQLClient(endpoint, {
      headers,
    });
  }

  async initialize(): Promise<void> {
    if (!this.isActive) {
      this.logger.info('Augur source is disabled or missing GraphQL endpoint');
      return;
    }

    this.logger.info('Initializing Augur source', {
      graphqlEndpoint: this.config.graphqlEndpoint,
    });

    // Test GraphQL connection
    try {
      await this.testConnection();
      this.logger.info('Augur GraphQL connection successful');
    } catch (error) {
      throw new DataSourceError(
        'Failed to connect to Augur GraphQL endpoint',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async startPolling(): Promise<void> {
    if (!this.isActive) return;

    this.logger.info('Starting Augur polling', {
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
    this.logger.info('Stopped Augur polling');
  }

  async getMarkets(): Promise<MarketData[]> {
    if (!this.isActive) return [];

    try {
      await rateLimiter.waitForSlot('augur');
      const response = await this.client.request(MARKETS_QUERY, {
        first: 50, // Reduced from 100 to manage rate limits
        skip: 0,
        where: {
          marketStatus: 'TRADING',
        },
      });

      const markets: MarketData[] = [];
      
      for (const marketData of response.markets || []) {
        try {
          const normalized = await this.normalizer.normalizeMarket(
            marketData,
            this.name,
            marketData.id
          );
          markets.push(normalized.marketData);
        } catch (error) {
          this.logger.warn('Failed to normalize market', {
            marketId: marketData.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('Fetched markets from Augur', {
        count: markets.length,
      });

      return markets;
    } catch (error) {
      this.logger.error('Failed to fetch markets', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DataSourceError(
        'Failed to fetch markets from Augur',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async subscribeToUpdates(callback: (event: MarketEventData) => void): Promise<void> {
    if (!this.isActive) return;

    this.updateCallback = callback;
    this.logger.info('Subscribed to Augur updates via polling');
  }

  async unsubscribeFromUpdates(): Promise<void> {
    this.updateCallback = undefined;
    this.logger.info('Unsubscribed from Augur updates');
  }

  private async testConnection(): Promise<void> {
    await rateLimiter.waitForSlot('augur');
    const response = await this.client.request(MARKETS_QUERY, {
      first: 1,
      skip: 0,
    });

    if (!response.markets) {
      throw new Error('Invalid GraphQL response');
    }
  }

  private async pollMarkets(): Promise<void> {
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      await rateLimiter.waitForSlot('augur');
      
      // Fetch markets updated since last sync
      let response;
      if (this.lastSyncTimestamp > 0) {
        response = await this.client.request(MARKET_UPDATES_QUERY, {
          timestamp: this.lastSyncTimestamp.toString()
        });
      } else {
        response = await this.client.request(MARKETS_QUERY, {
          first: 50, // Reduced from 100 to manage rate limits
          skip: 0,
          where: { marketStatus: 'TRADING' }
        });
      }

      for (const marketData of response.markets || []) {
        if (this.updateCallback) {
          const event: MarketEventData = {
            marketId: marketData.id,
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

      this.lastSyncTimestamp = currentTimestamp;
      
      this.logger.debug('Polling completed', {
        marketsProcessed: response.markets?.length || 0,
      });

    } catch (error) {
      this.logger.error('Polling failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
