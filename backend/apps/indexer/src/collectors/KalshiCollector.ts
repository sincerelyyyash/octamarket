import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { kalshiRateLimiter } from '../utils/rateLimiter.js';
import { retry } from '../utils/retry.js';
import { KalshiMarket, PaginationResponse, CollectorOptions } from './types.js';
import { config } from '../config/index.js';

/**
 * Collector for Kalshi API endpoints
 */
export class KalshiCollector {
  private client: AxiosInstance;
  private options: Required<CollectorOptions>;
  private apiKey: string;
  private privateKey: string;

  constructor(options: CollectorOptions = {}) {
    this.options = {
      batchSize: 100,
      maxRetries: 3,
      ...options,
    };

    if (!config.kalshi?.apiKey || !config.kalshi?.privateKey) {
      throw new Error('Kalshi API credentials not configured');
    }

    this.apiKey = config.kalshi.apiKey;
    this.privateKey = config.kalshi.privateKey;

    // Initialize API client - Note: Kalshi moved to elections API
    this.client = axios.create({
      baseURL: 'https://api.elections.kalshi.com',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create signature for Kalshi API authentication
   */
  private createSignature(method: string, path: string, timestamp: string, body?: any): string {
    // Kalshi uses HMAC-SHA256 for signing
    const bodyStr = body ? JSON.stringify(body) : '';
    const message = `${method}${path}${timestamp}${bodyStr}`;
    
    const hmac = crypto.createHmac('sha256', this.privateKey);
    hmac.update(message);
    return hmac.digest('hex');
  }

  /**
   * Create authenticated headers for Kalshi API
   */
  private createAuthHeaders(method: string, path: string, body?: any): Record<string, string> {
    const timestamp = Date.now().toString();
    const signature = this.createSignature(method, path, timestamp, body);

    return {
      'KALSHI-ACCESS-KEY': this.apiKey,
      'KALSHI-ACCESS-SIGNATURE': signature,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
    };
  }

  /**
   * Make authenticated request to Kalshi API
   */
  private async authenticatedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: any,
    params?: any
  ): Promise<T> {
    await kalshiRateLimiter.acquire();

    return retry(
      async () => {
        const headers = this.createAuthHeaders(method, path, body);
        
        const config: any = {
          headers,
          params,
        };

        let response;
        if (method === 'GET') {
          response = await this.client.get(path, config);
        } else if (method === 'POST') {
          response = await this.client.post(path, body, config);
        } else if (method === 'DELETE') {
          response = await this.client.delete(path, config);
        }

        return response?.data;
      },
      { maxAttempts: this.options.maxRetries },
      `Kalshi ${method} ${path}`
    );
  }

  /**
   * Fetch markets with pagination
   */
  async fetchMarkets(params: {
    limit?: number;
    cursor?: string;
    status?: string;
    series_ticker?: string;
    tickers?: string;
  } = {}): Promise<PaginationResponse<KalshiMarket>> {
    const data = await this.authenticatedRequest<any>(
      'GET',
      '/trade-api/v2/markets',
      undefined,
      {
        limit: params.limit || this.options.batchSize,
        cursor: params.cursor,
        status: params.status,
        series_ticker: params.series_ticker,
        tickers: params.tickers,
      }
    );

    logger.debug('Fetched markets from Kalshi', {
      count: data?.markets?.length || 0,
    });

    return {
      data: data?.markets || [],
      hasMore: !!data?.cursor,
      nextCursor: data?.cursor,
    };
  }

  /**
   * Fetch all markets with automatic pagination
   */
  async *fetchAllMarkets(params: {
    status?: string;
  } = {}): AsyncGenerator<KalshiMarket[]> {
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await this.fetchMarkets({
        ...params,
        limit: this.options.batchSize,
        cursor,
      });

      if (result.data.length > 0) {
        yield result.data;
      }

      hasMore = result.hasMore;
      cursor = result.nextCursor;

      // Safety check
      if (!cursor) {
        break;
      }
    }
  }

  /**
   * Fetch market by ticker
   */
  async fetchMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
    try {
      const data = await this.authenticatedRequest<any>(
        'GET',
        `/trade-api/v2/markets/${ticker}`
      );

      logger.debug('Fetched market by ticker', { ticker });

      return data?.market || null;
    } catch (error) {
      logger.error('Error fetching market by ticker', { ticker, error });
      return null;
    }
  }

  /**
   * Fetch orderbook for a market
   */
  async fetchOrderbook(ticker: string, depth?: number): Promise<any> {
    const data = await this.authenticatedRequest<any>(
      'GET',
      `/trade-api/v2/markets/${ticker}/orderbook`,
      undefined,
      { depth }
    );

    logger.debug('Fetched orderbook', { ticker });

    return data?.orderbook || null;
  }

  /**
   * Fetch trades for a market
   */
  async fetchTrades(params: {
    ticker?: string;
    limit?: number;
    cursor?: string;
    min_ts?: number;
    max_ts?: number;
  } = {}): Promise<PaginationResponse<any>> {
    const data = await this.authenticatedRequest<any>(
      'GET',
      '/trade-api/v2/markets/trades',
      undefined,
      {
        ticker: params.ticker,
        limit: params.limit || this.options.batchSize,
        cursor: params.cursor,
        min_ts: params.min_ts,
        max_ts: params.max_ts,
      }
    );

    logger.debug('Fetched trades', {
      ticker: params.ticker,
      count: data?.trades?.length || 0,
    });

    return {
      data: data?.trades || [],
      hasMore: !!data?.cursor,
      nextCursor: data?.cursor,
    };
  }

  /**
   * Fetch portfolio (requires authentication)
   */
  async fetchPortfolio(): Promise<any> {
    const data = await this.authenticatedRequest<any>(
      'GET',
      '/trade-api/v2/portfolio/balance'
    );

    logger.debug('Fetched portfolio');

    return data;
  }

  /**
   * Fetch portfolio positions
   */
  async fetchPositions(params: {
    ticker?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<PaginationResponse<any>> {
    const data = await this.authenticatedRequest<any>(
      'GET',
      '/trade-api/v2/portfolio/positions',
      undefined,
      {
        ticker: params.ticker,
        limit: params.limit || this.options.batchSize,
        cursor: params.cursor,
      }
    );

    logger.debug('Fetched positions', {
      count: data?.positions?.length || 0,
    });

    return {
      data: data?.positions || [],
      hasMore: !!data?.cursor,
      nextCursor: data?.cursor,
    };
  }

  /**
   * Fetch user's orders
   */
  async fetchOrders(params: {
    ticker?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<PaginationResponse<any>> {
    const data = await this.authenticatedRequest<any>(
      'GET',
      '/trade-api/v2/portfolio/orders',
      undefined,
      {
        ticker: params.ticker,
        status: params.status,
        limit: params.limit || this.options.batchSize,
        cursor: params.cursor,
      }
    );

    logger.debug('Fetched orders', {
      count: data?.orders?.length || 0,
    });

    return {
      data: data?.orders || [],
      hasMore: !!data?.cursor,
      nextCursor: data?.cursor,
    };
  }

  /**
   * Fetch market series
   */
  async fetchSeries(params: {
    limit?: number;
    cursor?: string;
  } = {}): Promise<PaginationResponse<any>> {
    const data = await this.authenticatedRequest<any>(
      'GET',
      '/trade-api/v2/series',
      undefined,
      {
        limit: params.limit || this.options.batchSize,
        cursor: params.cursor,
      }
    );

    logger.debug('Fetched series', {
      count: data?.series?.length || 0,
    });

    return {
      data: data?.series || [],
      hasMore: !!data?.cursor,
      nextCursor: data?.cursor,
    };
  }

  /**
   * Fetch events
   */
  async fetchEvents(params: {
    limit?: number;
    cursor?: string;
    series_ticker?: string;
    status?: string;
  } = {}): Promise<PaginationResponse<any>> {
    const data = await this.authenticatedRequest<any>(
      'GET',
      '/trade-api/v2/events',
      undefined,
      {
        limit: params.limit || this.options.batchSize,
        cursor: params.cursor,
        series_ticker: params.series_ticker,
        status: params.status,
      }
    );

    logger.debug('Fetched events', {
      count: data?.events?.length || 0,
    });

    return {
      data: data?.events || [],
      hasMore: !!data?.cursor,
      nextCursor: data?.cursor,
    };
  }
}

