import { MarketSource } from './market';

export interface Trader {
  id: string;
  source: MarketSource;
  sourceTraderId: string;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
  totalTrades: number;
  totalVolume: number;
  totalPnl: number;
  winRate?: number;
  avgReturn?: number;
  currentRank?: number;
  bestRank?: number;
  rankChange?: number;
  lastActiveAt?: string;
  firstTradeAt?: string;
  lastTradeAt?: string;
  isPublic: boolean;
  allowCopyTrading: boolean;
  maxFollowers?: number;
}

export interface TraderStats {
  trader: {
    id: string;
    totalTrades: number;
    totalVolume: number;
    totalPnl: number;
    winRate?: number;
    avgReturn?: number;
    currentRank?: number;
    bestRank?: number;
    rankChange?: number;
    lastActiveAt?: string;
    firstTradeAt?: string;
    lastTradeAt?: string;
  };
  additionalStats: {
    totalTradeValue: number;
    totalRealizedPnl: number;
    totalTradeCount: number;
    followerCount: number;
    followingCount: number;
  };
}

export interface TraderFollower {
  id: string;
  follower: {
    id: string;
    username?: string;
    displayName?: string;
    profileImageUrl?: string;
    totalPnl?: number;
    totalVolume?: number;
  };
  autoCopyTrades: boolean;
  maxCopyAmount: number;
  copyPercentage: number;
  totalCopiedTrades: number;
  totalCopiedValue: number;
  totalCopiedPnl: number;
  createdAt: string;
}

export interface LeaderboardSnapshot {
  id: string;
  source: MarketSource;
  snapshotDate: string;
  topTrader: {
    id: string;
    username?: string;
    displayName?: string;
    profileImageUrl?: string;
    source: MarketSource;
  };
  topTraderPnl: number;
  topTraderVolume: number;
  totalTraders: number;
  totalVolume: number;
  totalTrades: number;
  avgPnl: number;
}

// Legacy types for existing components (can be migrated gradually)
export interface TraderData {
  id: string;
  name: string;
  bio: string;
  platform: string;
  copiers: number;
  daysJoined: number;
  stats: {
    roi30D: string;
    cumulativePnL: string;
    accountAssets: string;
    maxDrawdown: string;
    risk: string;
    cumulativeEarningsOfCopiers: string;
    cumulativeCopiers: string;
    profitShare: string;
    winRatio: string;
    currencyUnit: string;
  };
}

export type ChartMetric = 'ROI' | 'Cumulative PnL' | 'Account Assets';

export interface StatItem {
  label: string;
  value: string;
  color?: 'green' | 'red' | 'white';
  isDivider?: boolean;
}

