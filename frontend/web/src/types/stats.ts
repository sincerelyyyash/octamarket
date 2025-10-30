import { MarketSource, MarketStatus } from './market';
import { Market, MarketOutcome } from './market';

export interface PlatformStats {
  overview: {
    totalMarkets: number;
    activeMarkets: number;
    resolvedMarkets: number;
    totalTraders: number;
    totalVolume: number;
    totalTrades: number;
    avgMarketVolume: number;
    avgTraderPnl: number;
    recentActivity: number;
  };
  timeframe: string;
  generatedAt: string;
}

export interface MarketsByCategory {
  category: string;
  count: number;
}

export interface MarketsBySource {
  source: MarketSource;
  count: number;
}

export interface MarketsByStatus {
  status: MarketStatus;
  count: number;
}

export interface TopMarket {
  id: string;
  title: string;
  category?: string;
  status: MarketStatus;
  totalVolume: number;
  participantCount: number;
  outcomes: MarketOutcome[];
}

export interface MarketStats {
  overview: {
    totalMarkets: number;
    marketsByCategory: MarketsByCategory[];
    marketsBySource: MarketsBySource[];
    marketsByStatus: MarketsByStatus[];
  };
  topMarkets: {
    byVolume: TopMarket[];
    byParticipants: TopMarket[];
  };
  generatedAt: string;
}

export interface SourceStats {
  source: MarketSource;
  markets: number;
  traders: number;
  trades: number;
  volume: number;
  avgTradeValue: number;
}

export interface SourceStatsResponse {
  sources: SourceStats[];
  timeframe: string;
  generatedAt: string;
}

