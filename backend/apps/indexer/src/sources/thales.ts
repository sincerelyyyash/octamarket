import axios from 'axios';
import { ethers } from 'ethers';
import { MarketSource, EventType } from '@repo/database';
import type { DataSource, MarketData, MarketEventData, SourceConfig } from '../types/index.js';
import { DataSourceError } from '../types/index.js';
import { MarketNormalizer } from '../core/normalizer.js';
import { createSourceLogger } from '../utils/logger.js';

// Simplified Thales AMM ABI for market data
const THALES_AMM_ABI = [
  'function availableOptions() external view returns (address[])',
  'function getMarketOptions(address market) external view returns (address, address)',
  'function buyFromAMM(address market, uint position, uint amount) external',
  'function sellToAMM(address market, uint position, uint amount) external',
  'function buyPriceImpact(address market, uint position, uint amount) external view returns (uint)',
  'function sellPriceImpact(address market, uint position, uint amount) external view returns (uint)',
];

const POSITIONAL_MARKET_ABI = [
  'function phase() external view returns (uint)',
  'function times(uint) external view returns (uint)',
  'function oracleDetails() external view returns (bytes32, uint)',
  'function result() external view returns (uint)',
  'function resolved() external view returns (bool)',
];

export class ThalesSource implements DataSource {
  readonly name = MarketSource.THALES;
  readonly isActive: boolean;
  
  private provider?: ethers.JsonRpcProvider;
  private ammContract?: ethers.Contract;
  private pollInterval?: NodeJS.Timeout;
  private readonly logger = createSourceLogger('thales');
  private readonly normalizer = new MarketNormalizer();
  private updateCallback?: (event: MarketEventData) => void;
  private lastSyncTime = 0;

  constructor(private config: SourceConfig) {
    this.isActive = config.enabled && !!(config.restEndpoint || config.rpcUrl);
  }

  async initialize(): Promise<void> {
    if (!this.isActive) {
      this.logger.info('Thales source is disabled or missing configuration');
      return;
    }

    this.logger.info('Initializing Thales source', {
      restEndpoint: this.config.restEndpoint,
      rpcUrl: this.config.rpcUrl,
      contractAddress: this.config.contractAddress,
    });

    // Initialize RPC provider if available
    if (this.config.rpcUrl) {
      try {
        this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
        
        if (this.config.contractAddress) {
          this.ammContract = new ethers.Contract(
            this.config.contractAddress,
            THALES_AMM_ABI,
            this.provider
          );
        }
        
        this.logger.info('Thales RPC connection successful');
      } catch (error) {
        this.logger.warn('Failed to initialize RPC connection', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Test REST API connection if available
    if (this.config.restEndpoint) {
      try {
        await this.testConnection();
        this.logger.info('Thales REST API connection successful');
      } catch (error) {
        throw new DataSourceError(
          'Failed to connect to Thales REST API',
          this.name,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  async startPolling(): Promise<void> {
    if (!this.isActive) return;

    this.logger.info('Starting Thales polling', {
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
    this.logger.info('Stopped Thales polling');
  }

  async getMarkets(): Promise<MarketData[]> {
    if (!this.isActive) return [];

    const markets: MarketData[] = [];

    // Try REST API first
    if (this.config.restEndpoint) {
      try {
        const restMarkets = await this.getMarketsFromAPI();
        markets.push(...restMarkets);
      } catch (error) {
        this.logger.warn('Failed to fetch from REST API', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fallback to on-chain data
    if (markets.length === 0 && this.ammContract) {
      try {
        const onChainMarkets = await this.getMarketsFromContract();
        markets.push(...onChainMarkets);
      } catch (error) {
        this.logger.warn('Failed to fetch from contract', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info('Fetched markets from Thales', {
      count: markets.length,
    });

    return markets;
  }

  async subscribeToUpdates(callback: (event: MarketEventData) => void): Promise<void> {
    if (!this.isActive) return;

    this.updateCallback = callback;
    this.logger.info('Subscribed to Thales updates via polling');
  }

  async unsubscribeFromUpdates(): Promise<void> {
    this.updateCallback = undefined;
    this.logger.info('Unsubscribed from Thales updates');
  }

  private async testConnection(): Promise<void> {
    if (!this.config.restEndpoint) return;

    const response = await axios.get(`${this.config.restEndpoint}/markets`, {
      params: { limit: 1 },
      timeout: 10000,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private async getMarketsFromAPI(): Promise<MarketData[]> {
    if (!this.config.restEndpoint) return [];

    try {
      const response = await axios.get(`${this.config.restEndpoint}/markets`, {
        params: {
          limit: 100,
          status: 'active',
        },
        timeout: 30000,
      });

      const markets: MarketData[] = [];
      
      for (const marketData of response.data.markets || response.data || []) {
        try {
          const normalized = await this.normalizer.normalizeMarket(
            marketData,
            this.name,
            marketData.address || marketData.id
          );
          markets.push(normalized.marketData);
        } catch (error) {
          this.logger.warn('Failed to normalize market', {
            marketId: marketData.address || marketData.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return markets;
    } catch (error) {
      throw new DataSourceError(
        'Failed to fetch markets from Thales API',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async getMarketsFromContract(): Promise<MarketData[]> {
    if (!this.ammContract || !this.provider) return [];

    try {
      // Get available market options from AMM
      const availableOptions = await (this.ammContract as any).availableOptions();
      const markets: MarketData[] = [];

      for (const optionAddress of availableOptions.slice(0, 50)) { // Limit to avoid RPC limits
        try {
          const marketContract = new ethers.Contract(
            optionAddress,
            POSITIONAL_MARKET_ABI,
            this.provider!
          );

          const [phase, resolved, oracleDetails] = await Promise.all([
            (marketContract as any).phase(),
            (marketContract as any).resolved(),
            (marketContract as any).oracleDetails(),
          ]);

          // Create market data from on-chain information
          const marketData = {
            address: optionAddress,
            phase: phase.toString(),
            resolved,
            oracleKey: oracleDetails[0],
            strikePrice: oracleDetails[1].toString(),
            // Additional data would need to be fetched from events or external sources
          };

          const normalized = await this.normalizer.normalizeMarket(
            marketData,
            this.name,
            optionAddress
          );
          markets.push(normalized.marketData);
        } catch (error) {
          this.logger.warn('Failed to process market contract', {
            address: optionAddress,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return markets;
    } catch (error) {
      throw new DataSourceError(
        'Failed to fetch markets from Thales contract',
        this.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async pollMarkets(): Promise<void> {
    try {
      const currentTime = Date.now();
      
      // Get updated markets
      const markets = await this.getMarkets();

      for (const market of markets) {
        if (this.updateCallback) {
          const event: MarketEventData = {
            marketId: market.id,
            source: this.name,
            eventType: EventType.MARKET_UPDATED,
            timestamp: new Date(),
            data: {
              market,
            },
            rawPayload: market,
          };

          this.updateCallback(event);
        }
      }

      this.lastSyncTime = currentTime;
      
      this.logger.debug('Polling completed', {
        marketsProcessed: markets.length,
      });

    } catch (error) {
      this.logger.error('Polling failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
