import { useLeaderDetail } from '@/lib/api';
import { TraderData } from '@/types/trader';

// Helper function to format numbers
const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

// Helper function to format percentage
const formatPct = (num: number): string => {
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
};

export function useTraderData(traderId: string) {
  const { data: leaderData, isLoading, error } = useLeaderDetail(traderId);

  // Transform API data to TraderData format
  const data: TraderData | null = leaderData ? {
    id: leaderData.leader_id,
    name: leaderData.name,
    bio: leaderData.bio || "No bio available",
    platform: leaderData.platform,
    copiers: leaderData.followers_count,
    daysJoined: 185, // TODO: Calculate from created_at when available
    stats: {
      roi30D: formatPct(leaderData.stats.pnl_30d),
      cumulativePnL: formatNumber(leaderData.stats.pnl_all_time),
      accountAssets: formatNumber(leaderData.stats.pnl_all_time), // TODO: Add actual account assets
      maxDrawdown: 'Cumulative PnL',
      risk: '24.81%', // TODO: Add risk calculation
      cumulativeEarningsOfCopiers: formatNumber(0), // TODO: Add from backend
      cumulativeCopiers: leaderData.followers_count.toString(),
      profitShare: '16%', // TODO: Add from backend
      winRatio: formatPct(leaderData.stats.win_rate * 100),
      currencyUnit: 'USDT'
    }
  } : null;

  return {
    data,
    loading: isLoading,
    error: error as Error | null,
  };
}

