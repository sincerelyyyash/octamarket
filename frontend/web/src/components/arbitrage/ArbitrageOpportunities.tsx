'use client';

import { useArbitrageOpportunities } from '@/lib/api';
import { ArbitrageCard } from './ArbitrageCard';
import { useState } from 'react';

export function ArbitrageOpportunities() {
  const [page, setPage] = useState(1);
  const limit = 20;
  
  const { data: opportunities, isLoading, isError, error, refetch } = useArbitrageOpportunities({ 
    page, 
    limit 
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-800 rounded-lg h-32"></div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
        <h3 className="text-red-500 font-semibold mb-2">Error Loading Opportunities</h3>
        <p className="text-gray-300">{error?.message || 'Failed to load arbitrage opportunities'}</p>
        <button 
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!opportunities || opportunities.length === 0) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-white mb-2">No Arbitrage Opportunities</h3>
        <p className="text-gray-400 mb-6">
          We're continuously scanning the markets. Check back soon!
        </p>
        <button 
          onClick={() => refetch()}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors"
        >
          Refresh Now
        </button>
      </div>
    );
  }

  // Calculate total potential profit
  const totalProfit = opportunities.reduce((sum, opp) => sum + (opp.profit_amount_usd || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              💰 {opportunities.length} Active Opportunities
            </h2>
            <p className="text-gray-400">
              Total potential profit: <span className="text-green-400 font-bold">${totalProfit.toFixed(2)}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => refetch()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-2"
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>
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
                disabled={opportunities.length < limit}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="space-y-4">
        {opportunities.map(opportunity => (
          <ArbitrageCard key={opportunity.id} opportunity={opportunity} />
        ))}
      </div>
    </div>
  );
}


