export interface TraderStats {
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
}

export interface TraderData {
  id: string;
  name: string;
  bio: string;
  platform: string;
  copiers: number;
  daysJoined: number;
  stats: TraderStats;
}

export type ChartMetric = 'ROI' | 'Cumulative PnL' | 'Account Assets';

export interface StatItem {
  label: string;
  value: string;
  color?: 'green' | 'red' | 'white';
  isDivider?: boolean;
}

