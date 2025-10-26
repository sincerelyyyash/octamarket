import { useState, useEffect } from 'react';
import { TraderData } from '@/types/trader';

// Mock data - in a real app, this would fetch from an API
const mockTraderData: TraderData = {
  id: 'harkirat-singh',
  name: 'Harkirat Singh',
  bio: "As a risk-averse trader, I base my trading decisions on chart analysis and follow Glenn Neely's approach to Elliott Wave Theory, only BTC, DOGE on low leverage - like spot",
  platform: 'Polymarket',
  copiers: 317,
  daysJoined: 185,
  stats: {
    roi30D: '+20.95%',
    cumulativePnL: '+52,944.59',
    accountAssets: '248,236.83',
    maxDrawdown: 'Cumulative PnL',
    risk: '24.81%',
    cumulativeEarningsOfCopiers: '-2,718.38',
    cumulativeCopiers: '2,410',
    profitShare: '16%',
    winRatio: '76.00%',
    currencyUnit: 'USDT'
  }
};

export function useTraderData(traderId: string) {
  const [data, setData] = useState<TraderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate API call
    const fetchTraderData = async () => {
      try {
        setLoading(true);
        // In a real app, you would fetch from your API:
        // const response = await fetch(`/api/traders/${traderId}`);
        // const data = await response.json();
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setData(mockTraderData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch trader data'));
      } finally {
        setLoading(false);
      }
    };

    fetchTraderData();
  }, [traderId]);

  return { data, loading, error };
}

