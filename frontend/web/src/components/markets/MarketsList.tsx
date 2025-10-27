'use client';

import { useMarkets } from '@/lib/api';
import { MarketCard } from './MarketCard';
import { useState } from 'react';

export function MarketsList() {
  const [page, setPage] = useState(1);
  const limit = 20;
  
  const { data: markets, isLoading, isError, error } = useMarkets({ 
    page, 
    limit 
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-800 rounded-lg p-6 h-48"></div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
        <h3 className="text-red-500 font-semibold mb-2">Error Loading Markets</h3>
        <p className="text-gray-300">{error?.message || 'Failed to load markets'}</p>
      </div>
    );
  }

  if (!markets || markets.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-12 text-center">
        <p className="text-gray-400">No markets available at the moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          All Markets ({markets.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
          >
            Previous
          </button>
          <span className="text-gray-400 px-4">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={markets.length < limit}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {markets.map(market => (
          <MarketCard key={market.event_fingerprint} market={market} />
        ))}
      </div>
    </div>
  );
}


