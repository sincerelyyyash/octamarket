import { TraderStats, StatItem } from '@/types/trader';

export function prepareStatsData(stats: TraderStats): StatItem[] {
  return [
    { label: '30D ROI', value: stats.roi30D, color: 'green' as const },
    { label: 'Cumulative PnL', value: stats.cumulativePnL, color: 'green' as const },
    { label: 'Account Assets', value: stats.accountAssets },
    // { label: 'Max. Drawdown', value: stats.maxDrawdown, isDivider: true },
    { label: 'Risk', value: stats.risk },
    { label: 'Cumulative Earnings of Copiers', value: stats.cumulativeEarningsOfCopiers, color: 'red' as const },
    { label: 'Cumulative Copiers', value: stats.cumulativeCopiers },
    { label: 'Profit Share (%)', value: stats.profitShare },
    { label: 'Win Ratio', value: stats.winRatio },
  ];
}

export function getCurrentChartValue(metric: string, stats: TraderStats): string {
  switch (metric) {
    case 'ROI':
      return stats.roi30D;
    case 'Cumulative PnL':
      return stats.cumulativePnL;
    case 'Account Assets':
      return stats.accountAssets;
    default:
      return stats.roi30D;
  }
}

