import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';
import { polymarketRateLimiter } from '../utils/rateLimiter.js';
import { retry } from '../utils/retry.js';
import {
  PolymarketMarket,
  PolymarketLeaderboardEntry,
  PaginationResponse,
  CollectorOptions,
} from './types.js';

/**
 * Collector for Polymarket API endpoints
 */
export class PolymarketCollector {
  private gammaClient: AxiosInstance;
  private clobClient: AxiosInstance;
  private dataApiClient: AxiosInstance;
  private options: Required<CollectorOptions>;

  constructor(options: CollectorOptions = {}) {
    this.options = {
      batchSize: 100,
      maxRetries: 3,
      ...options,
    };

    // Initialize API clients
    this.gammaClient = axios.create({
      baseURL: 'https://gamma-api.polymarket.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.clobClient = axios.create({
      baseURL: 'https://clob.polymarket.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.dataApiClient = axios.create({
      baseURL: 'https://data-api.polymarket.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch markets with pagination
   */
  async fetchMarkets(params: {
    limit?: number;
    offset?: number;
    active?: boolean;
    closed?: boolean;
    archived?: boolean;
    tag_slug?: string;
    order?: string;
    ascending?: boolean;
  } = {}): Promise<PaginationResponse<PolymarketMarket>> {
    await polymarketRateLimiter.acquire('gamma');

    return retry(
      async () => {
        const response = await this.gammaClient.get('/events/pagination', {
          params: {
            limit: params.limit || this.options.batchSize,
            offset: params.offset || 0,
            active: params.active,
            closed: params.closed,
            archived: params.archived,
            tag_slug: params.tag_slug,
            order: params.order || 'volume',
            ascending: params.ascending || false,
          },
        });

        logger.debug('Fetched markets from Polymarket', {
          count: response.data?.data?.length || 0,
        });

        return {
          data: response.data?.data || [],
          hasMore: response.data?.hasMore || false,
          nextCursor: response.data?.next_cursor,
        };
      },
      { maxAttempts: this.options.maxRetries },
      'Polymarket fetchMarkets'
    );
  }

  /**
   * Fetch all markets with automatic pagination
   */
  async *fetchAllMarkets(params: {
    active?: boolean;
    closed?: boolean;
    archived?: boolean;
  } = {}): AsyncGenerator<PolymarketMarket[]> {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.fetchMarkets({
        ...params,
        limit: this.options.batchSize,
        offset,
      });

      if (result.data.length > 0) {
        yield result.data;
      }

      hasMore = result.hasMore;
      offset += this.options.batchSize;

      // Safety check to prevent infinite loops
      if (offset > 10000) {
        logger.warn('Reached maximum offset for market pagination');
        break;
      }
    }
  }

  /**
   * Fetch CLOB markets
   */
  async fetchCLOBMarkets(params: {
    condition_id?: string;
    next_cursor?: string;
  } = {}): Promise<any> {
    await polymarketRateLimiter.acquire('clob');

    return retry(
      async () => {
        const response = await this.clobClient.get('/markets', {
          params,
        });

        logger.debug('Fetched CLOB markets', {
          count: response.data?.length || response.data?.markets?.length || 0,
        });

        return response.data;
      },
      { maxAttempts: this.options.maxRetries },
      'Polymarket fetchCLOBMarkets'
    );
  }

  /**
   * Fetch order book for specific token IDs
   */
  async fetchOrderBook(tokenIds: string[]): Promise<any> {
    await polymarketRateLimiter.acquire('clob');

    return retry(
      async () => {
        const response = await this.clobClient.post('/books', {
          token_ids: tokenIds,
        });

        logger.debug('Fetched order book', {
          tokenCount: tokenIds.length,
        });

        return response.data;
      },
      { maxAttempts: this.options.maxRetries },
      'Polymarket fetchOrderBook'
    );
  }

  /**
   * Fetch last trade prices for token IDs
   */
  async fetchLastTradePrices(tokenIds: string[]): Promise<any> {
    await polymarketRateLimiter.acquire('clob');

    return retry(
      async () => {
        const response = await this.clobClient.post('/last-trades-prices', {
          token_ids: tokenIds,
        });

        logger.debug('Fetched last trade prices', {
          tokenCount: tokenIds.length,
        });

        return response.data;
      },
      { maxAttempts: this.options.maxRetries },
      'Polymarket fetchLastTradePrices'
    );
  }

  /**
   * Fetch leaderboard
   */
  async fetchLeaderboard(): Promise<PolymarketLeaderboardEntry[]> {
    await polymarketRateLimiter.acquire('data-api');

    return retry(
      async () => {
        const response = await this.dataApiClient.get('/v1/leaderboard');

        logger.debug('Fetched leaderboard', {
          count: response.data?.length || 0,
        });

        return response.data || [];
      },
      { maxAttempts: this.options.maxRetries },
      'Polymarket fetchLeaderboard'
    );
  }

  /**
   * Fetch positions for a user
   */
  async fetchPositions(user: string): Promise<any> {
    await polymarketRateLimiter.acquire('data-api');

    return retry(
      async () => {
        const response = await this.dataApiClient.get('/positions', {
          params: { user },
        });

        logger.debug('Fetched positions', {
          user,
          count: response.data?.length || 0,
        });

        return response.data || [];
      },
      { maxAttempts: this.options.maxRetries },
      'Polymarket fetchPositions'
    );
  }

  /**
   * Fetch traded data for a user
   */
  async fetchTraded(user: string): Promise<any> {
    await polymarketRateLimiter.acquire('data-api');

    return retry(
      async () => {
        const response = await this.dataApiClient.get('/traded', {
          params: { user },
        });

        logger.debug('Fetched traded data', {
          user,
        });

        return response.data || [];
      },
      { maxAttempts: this.options.maxRetries },
      'Polymarket fetchTraded'
    );
  }

  /**
   * Fetch activity for a user
   */
  async fetchActivity(user: string): Promise<any> {
    await polymarketRateLimiter.acquire('data-api');

    return retry(
      async () => {
        const response = await this.dataApiClient.get('/activity', {
          params: { user },
        });

        logger.debug('Fetched activity', {
          user,
        });

        return response.data || [];
      },
      { maxAttempts: this.options.maxRetries },
      'Polymarket fetchActivity'
    );
  }

  /**
   * Fetch market by condition ID
   */
  async fetchMarketByConditionId(conditionId: string): Promise<PolymarketMarket | null> {
    try {
      const markets = await this.fetchMarkets({ limit: 1 });
      // Note: The gamma API doesn't directly support filtering by condition ID
      // We would need to iterate or use CLOB markets endpoint
      const clobMarkets = await this.fetchCLOBMarkets({ condition_id: conditionId });
      
      if (Array.isArray(clobMarkets) && clobMarkets.length > 0) {
        return clobMarkets[0];
      }
      
      return null;
    } catch (error) {
      logger.error('Error fetching market by condition ID', { conditionId, error });
      return null;
    }
  }
}

