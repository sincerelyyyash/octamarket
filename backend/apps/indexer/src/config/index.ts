import { MarketSource } from '@repo/database';

/**
 * Configuration for the indexer application
 */
export interface IndexerConfig {
  databaseUrl: string;
  pollInterval: number;
  enabledSources: MarketSource[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  kalshi?: {
    apiKey: string;
    privateKey: string;
  };
  polymarket?: {
    apiKey?: string;
  };
}

/**
 * Parse enabled sources from environment variable
 */
const parseEnabledSources = (sourcesStr?: string): MarketSource[] => {
  if (!sourcesStr) {
    return [MarketSource.POLYMARKET, MarketSource.KALSHI];
  }

  const sources: MarketSource[] = [];
  const parts = sourcesStr.split(',').map(s => s.trim().toUpperCase());

  for (const part of parts) {
    if (part === 'POLYMARKET') sources.push(MarketSource.POLYMARKET);
    if (part === 'KALSHI') sources.push(MarketSource.KALSHI);
  }

  return sources;
};

/**
 * Load configuration from environment variables
 */
export const config: IndexerConfig = {
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/octamarkets',
  pollInterval: parseInt(process.env.INDEXER_POLL_INTERVAL || '60000', 10),
  enabledSources: parseEnabledSources(process.env.INDEXER_ENABLED_SOURCES),
  logLevel: (process.env.LOG_LEVEL as any) || 'info',
  kalshi: process.env.KALSHI_API_KEY ? {
    apiKey: process.env.KALSHI_API_KEY,
    privateKey: process.env.KALSHI_PRIVATE_KEY || '',
  } : undefined,
  polymarket: {
    apiKey: process.env.POLYMARKET_API_KEY,
  },
};

