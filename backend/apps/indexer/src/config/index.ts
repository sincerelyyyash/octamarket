import { MarketSource } from '@repo/database';
import type { IndexerConfig } from '../types/index.js';
import dotenv from 'dotenv';

dotenv.config();

export const config: IndexerConfig = {
  sources: [
    {
      source: MarketSource.POLYMARKET,
      restEndpoint: 'https://gamma-api.polymarket.com', 
      wsEndpoint: 'wss://clob.polymarket.com/ws',
      pollInterval: 30000, // 30 seconds
      enabled: true,
    },
    {
      source: MarketSource.KALSHI,
      restEndpoint: 'https://api.elections.kalshi.com',
      wsEndpoint: 'wss://trading-api.kalshi.com/trade-api/ws/v2',
      apiKey: process.env.KALSHI_API_KEY,
      pollInterval: 60000, // 1 minute
      enabled: true, // Market data is public, trading requires API key
    },
    // Disabled sources - not currently working
    // {
    //   source: MarketSource.AUGUR,
    //   graphqlEndpoint: 'https://api.thegraph.com/subgraphs/name/augurproject/augur-v2',
    //   apiKey: process.env.THEGRAPH_API_KEY,
    //   pollInterval: 300000, // 5 minutes - reduced frequency for free tier
    //   enabled: false, // Disabled - subgraph appears to be deprecated
    // },
    // {
    //   source: MarketSource.THALES,
    //   restEndpoint: 'https://api.thalesmarket.io',
    //   rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    //   contractAddress: '0x278b5a44397c9d8e52743fedec263c4760dc1a2a', // Thales AMM
    //   pollInterval: 90000, // 1.5 minutes
    //   enabled: false, // Disabled - API not working
    // },
    // {
    //   source: MarketSource.OMEN,
    //   graphqlEndpoint: 'https://api.thegraph.com/subgraphs/name/protofire/omen',
    //   apiKey: process.env.THEGRAPH_API_KEY,
    //   pollInterval: 300000, // 5 minutes - reduced frequency for free tier
    //   enabled: false, // Disabled - subgraph appears to be deprecated
    // },
  ],
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/octamarkets',
  },
  polling: {
    defaultInterval: 60000, // 1 minute
    priceUpdateInterval: 30000, // 30 seconds
    leaderboardInterval: 300000, // 5 minutes
  },
  deduplication: {
    enabled: true,
    confidenceThreshold: 0.8,
  },
  leaderboard: {
    enabled: true, // Enabled now that we have real API integration
    syncInterval: 300000, // 5 minutes
    maxTradersPerSource: 1000,
    copyTradingEnabled: true, // Enabled now that we have real trading data
  },
  rateLimiting: {
    thegraph: {
      enabled: true,
      requestsPerMinute: 200, // Free tier limit - corrected from 20
      requestsPerHour: 1000, // Free tier limit
      burstLimit: 5, // Max concurrent requests
    },
    polymarket: {
      enabled: true,
      requestsPerMinute: 100, // Conservative limit
      requestsPerHour: 2000,
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE,
  },
  queue: {
    batchSize: parseInt(process.env.QUEUE_BATCH_SIZE || '100'),
    flushInterval: parseInt(process.env.QUEUE_FLUSH_INTERVAL || '12000'), // 12 seconds
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY || '1000'),
  },
};

export const getSourceConfig = (source: MarketSource) => {
  return config.sources.find(s => s.source === source);
};

export const getEnabledSources = () => {
  return config.sources.filter(s => s.enabled);
};
