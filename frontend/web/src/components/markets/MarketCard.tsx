'use client';

import { AggregatedMarket } from '@/lib/api/types';
import { useBestPrice } from '@/lib/api';
import Link from 'next/link';

interface MarketCardProps {
  market: AggregatedMarket;
}

export function MarketCard({ market }: MarketCardProps) {
  const { data: bestPrice } = useBestPrice(market.event_fingerprint);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No end date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-500/20 text-green-500';
      case 'closed': return 'bg-red-500/20 text-red-500';
      case 'resolved': return 'bg-blue-500/20 text-blue-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  return (
    <Link href={`/markets/${market.event_fingerprint}`}>
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 hover:border-gray-600 rounded-lg p-6 h-full transition-all cursor-pointer hover:scale-[1.02]">
        <div className="flex items-start justify-between mb-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(market.status)}`}>
            {market.status}
          </span>
          {market.source_count && (
            <span className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400">
              {market.source_count} platforms
            </span>
          )}
        </div>

        <h3 className="text-white font-semibold mb-2 line-clamp-2 min-h-[3rem]">
          {market.title}
        </h3>

        {market.description && (
          <p className="text-gray-400 text-sm mb-4 line-clamp-2">
            {market.description}
          </p>
        )}

        {bestPrice && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
              <div className="text-green-400 text-xs font-medium mb-1">Best Yes</div>
              <div className="text-white font-bold text-lg">
                {(bestPrice.best_yes_price * 100).toFixed(1)}¢
              </div>
              <div className="text-gray-400 text-xs mt-1">
                {bestPrice.best_yes_platform}
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
              <div className="text-red-400 text-xs font-medium mb-1">Best No</div>
              <div className="text-white font-bold text-lg">
                {(bestPrice.best_no_price * 100).toFixed(1)}¢
              </div>
              <div className="text-gray-400 text-xs mt-1">
                {bestPrice.best_no_platform}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-700">
          <span>Ends: {formatDate(market.end_time)}</span>
          <span className="text-blue-400">View Details →</span>
        </div>
      </div>
    </Link>
  );
}


