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
  private eventCache: Map<string, any> = new Map(); // Cache event data by mve_collection_ticker

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
      // First, get trending series (events) to prioritize high-volume markets
      const seriesResponse = await this.makeAuthenticatedRequest('/v1/search/series', {
        order_by: 'trending',
        page_size: 50,
        status: 'open',
      });

      const markets: MarketData[] = [];
      const series = seriesResponse.data?.series || [];
      
      // For each series, fetch associated markets
      for (const seriesData of series) {
        try {
          // Get markets for this series
          const marketsResponse = await this.makeAuthenticatedRequest('/trade-api/v2/markets', {
            series_ticker: seriesData.ticker,
            status: 'open',
            limit: 20,
          });

          const seriesMarkets = marketsResponse.data?.markets || [];
          
          // For parlay markets, enrich with event title if available
          for (const marketData of seriesMarkets) {
        try {
          // Skip PLAYER prop parlay markets
          if (this.isPlayerPropParlay(marketData)) {
            this.logger.debug('Skipping PLAYER prop parlay market', {
              ticker: marketData.ticker || marketData.id,
              title: marketData.title,
              category: marketData.category,
            });
            continue;
          }

          // Skip resolved markets - check multiple status fields
          const status = (marketData.status || '').toLowerCase();
          if (status === 'closed' || status === 'settled' || status === 'resolved' || 
              marketData.closed === true || marketData.settled === true || marketData.resolved === true) {
            this.logger.debug('Skipping resolved market', {
              ticker: marketData.ticker || marketData.id,
              status: marketData.status,
            });
            continue;
          }

          // If this is a parlay market (has mve_collection_ticker), try to get event title
          if (marketData.mve_collection_ticker) {
            const eventData = await this.getEventData(marketData.mve_collection_ticker);
            if (eventData && eventData.title) {
              // Add event title to market data for normalizer to use
              marketData.event_title = eventData.title;
              marketData.event_subtitle = eventData.sub_title;
              marketData.event_category = eventData.category;
            } else {
              // If collection ticker lookup fails, try to get category from associated events
              // Check custom_strike for associated event tickers
              if (marketData.custom_strike?.['Associated Events']) {
                const associatedEventTickers = marketData.custom_strike['Associated Events']
                  .split(',')
                  .map((t: string) => t.trim())
                  .filter((t: string) => t);
                
                // Try to get category from the first associated event
                if (associatedEventTickers.length > 0) {
                  // Extract base event ticker (e.g., "KXNFLANYTD-25NOV02ATLNE" from "KXNFLANYTD-25NOV02ATLNE-ATLBROBINSON7")
                  const baseEventTickers = new Set(
                    associatedEventTickers.map((t: string) => t.split('-')[0] + '-' + t.split('-')[1])
                  );
                  
                  // Try to find event data for one of the base event tickers
                  for (const baseTicker of Array.from(baseEventTickers).slice(0, 2)) { // Check first 2 unique events
                    const eventInfo = await this.getEventData(baseTicker);
                    if (eventInfo && eventInfo.category) {
                      marketData.event_category = eventInfo.category;
                      // If we find category info, use it even without title
                      break;
                    }
                  }
                }
              }
            }
          }
          
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
        } catch (error) {
          this.logger.warn('Failed to fetch markets for series', {
            seriesTicker: seriesData.ticker,
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

  /**
   * Fetch order books for given market tickers
   */
  async fetchOrderBooks(tickers: string[]): Promise<Map<string, { yesBid: number; yesAsk: number; noBid: number; noAsk: number }>> {
    if (tickers.length === 0) {
      return new Map();
    }

    try {
      // Batch request for order books (max 20 tickers per request)
      const batchSize = 20;
      const orderBookMap = new Map<string, { yesBid: number; yesAsk: number; noBid: number; noAsk: number }>();

      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize);
        const tickersParam = batch.join(',');

        try {
          const response = await this.makeAuthenticatedRequest('/v1/markets/order_books', {
            market_tickers: tickersParam,
          });

          if (response.data?.order_books && Array.isArray(response.data.order_books)) {
            for (const book of response.data.order_books) {
              if (book.ticker) {
                // Extract best prices from order book
                const yesBid = book.yes_bids && book.yes_bids.length > 0 ? book.yes_bids[0][0] / 100 : 0;
                const yesAsk = book.yes_asks && book.yes_asks.length > 0 ? book.yes_asks[0][0] / 100 : 0;
                const noBid = book.no_bids && book.no_bids.length > 0 ? book.no_bids[0][0] / 100 : 0;
                const noAsk = book.no_asks && book.no_asks.length > 0 ? book.no_asks[0][0] / 100 : 0;

                orderBookMap.set(book.ticker, { yesBid, yesAsk, noBid, noAsk });
              }
            }
          }
        } catch (error) {
          this.logger.error('Failed to fetch order books batch', {
            batchSize: batch.length,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.debug('Fetched Kalshi order books', {
        tickerCount: tickers.length,
        booksFound: orderBookMap.size,
      });

      return orderBookMap;
    } catch (error) {
      this.logger.error('Failed to fetch order books', {
        tickerCount: tickers.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return new Map();
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
          // Skip PLAYER prop parlay markets
          if (this.isPlayerPropParlay(marketData)) {
            this.logger.debug('Skipping PLAYER prop parlay market during polling', {
              ticker: marketData.ticker || marketData.id,
              title: marketData.title,
              category: marketData.category,
            });
            continue;
          }

          // Skip resolved markets - check multiple status fields
          const status = (marketData.status || '').toLowerCase();
          if (status === 'closed' || status === 'settled' || status === 'resolved' || 
              marketData.closed === true || marketData.settled === true || marketData.resolved === true) {
            this.logger.debug('Skipping resolved market during polling', {
              ticker: marketData.ticker || marketData.id,
              status: marketData.status,
            });
            continue;
          }

          // If this is a parlay market (has mve_collection_ticker), try to get event title
          if (marketData.mve_collection_ticker) {
            try {
              const eventData = await this.getEventData(marketData.mve_collection_ticker);
              if (eventData && eventData.title) {
                // Add event title to market data for normalizer to use
                marketData.event_title = eventData.title;
                marketData.event_subtitle = eventData.sub_title;
                marketData.event_category = eventData.category;
              } else {
                // If collection ticker lookup fails, try to get category from associated events
                if (marketData.custom_strike?.['Associated Events']) {
                  const associatedEventTickers = marketData.custom_strike['Associated Events']
                    .split(',')
                    .map((t: string) => t.trim())
                    .filter((t: string) => t);
                  
                  if (associatedEventTickers.length > 0) {
                    const baseEventTickers = new Set(
                      associatedEventTickers.map((t: string) => {
                        const parts = t.split('-');
                        return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : t;
                      })
                    );
                    
                    // Try to find event data for one of the base event tickers
                    for (const baseTicker of Array.from(baseEventTickers).slice(0, 2)) {
                      const eventInfo = await this.getEventData(baseTicker);
                      if (eventInfo && eventInfo.category) {
                        marketData.event_category = eventInfo.category;
                        break;
                      }
                    }
                  }
                }
              }
            } catch (error) {
              // Continue even if event fetch fails
              this.logger.debug('Failed to fetch event data during polling', {
                eventTicker: marketData.mve_collection_ticker,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
          
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

  private async getEventData(eventTicker: string): Promise<any | null> {
    // Check cache first
    if (this.eventCache.has(eventTicker)) {
      return this.eventCache.get(eventTicker);
    }

    try {
      // Try to find event by searching all events and matching event_ticker or series_ticker
      // Note: Kalshi API doesn't have a direct event lookup endpoint, so we search
      const response = await this.makeAuthenticatedRequest('/trade-api/v2/events', {
        limit: 500, // Get more events to find matches
      });

      // Search for matching event
      const events = response.data?.events || [];
      let foundEvent = events.find((event: any) => 
        event.event_ticker === eventTicker || 
        event.series_ticker === eventTicker
      );

      // If not found, try searching events with the pattern (for multivariate events)
      // Some events might use series_ticker or have variations
      if (!foundEvent) {
        // Try without the specific identifier (e.g., "KXMVENFLMULTIGAMEEXTENDED-W9" -> "KXMVENFLMULTIGAMEEXTENDED")
        const baseTicker = eventTicker.split('-')[0];
        foundEvent = events.find((event: any) => 
          event.event_ticker?.startsWith(baseTicker) ||
          event.series_ticker?.startsWith(baseTicker)
        );
      }

      // Cache the result (even if null, to avoid repeated failed lookups)
      this.eventCache.set(eventTicker, foundEvent || null);
      
      // Limit cache size to prevent memory issues
      if (this.eventCache.size > 1000) {
        // Clear oldest entries (simple FIFO)
        const firstKey = this.eventCache.keys().next().value;
        if (firstKey) {
          this.eventCache.delete(firstKey);
        }
      }

      return foundEvent || null;
    } catch (error) {
      this.logger.debug('Failed to fetch event data', {
        eventTicker,
        error: error instanceof Error ? error.message : String(error),
      });
      // Cache null result to avoid repeated failed API calls
      this.eventCache.set(eventTicker, null);
      return null;
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

  /**
   * Check if a market is a PLAYER prop parlay market
   * ONLY filter parlay markets that are specifically player props
   * Regular markets (non-parlay) should NOT be filtered
   */
  private isPlayerPropParlay(marketData: any): boolean {
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
