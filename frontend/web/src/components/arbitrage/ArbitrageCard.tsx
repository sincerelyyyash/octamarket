'use client';

import { ArbitrageAlert } from '@/lib/api/types';
import Link from 'next/link';

interface ArbitrageCardProps {
  opportunity: ArbitrageAlert;
}

export function ArbitrageCard({ opportunity }: ArbitrageCardProps) {
  const getProfitColor = (profit: number) => {
    if (profit >= 5) return 'text-green-400';
    if (profit >= 2) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'cross_platform': return '🔄';
      case 'same_platform': return '🎯';
      default: return '💰';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <Link href={`/arbitrage/${opportunity.id}`}>
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 hover:border-purple-500/50 rounded-lg p-6 transition-all cursor-pointer hover:scale-[1.01]">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{getTypeIcon(opportunity.opportunity_type)}</span>
              <h3 className="text-white font-semibold line-clamp-2">
                {opportunity.event_title}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="capitalize">{opportunity.opportunity_type.replace('_', ' ')}</span>
              <span>•</span>
              <span>Detected {formatTime(opportunity.detected_at)}</span>
              {opportunity.expires_at && (
                <>
                  <span>•</span>
                  <span className="text-yellow-400">
                    Expires in {Math.max(0, Math.floor((new Date(opportunity.expires_at).getTime() - Date.now()) / 60000))}m
                  </span>
                </>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className={`text-3xl font-bold ${getProfitColor(opportunity.profit_pct)}`}>
              +{opportunity.profit_pct.toFixed(2)}%
            </div>
            {opportunity.profit_amount_usd && (
              <div className="text-green-400 text-sm font-semibold">
                ${opportunity.profit_amount_usd.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Buy Side */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 text-sm font-semibold">BUY</span>
              <span className="text-green-400 font-mono text-lg font-bold">
                {(opportunity.buy_price * 100).toFixed(2)}¢
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Platform:</span>
                <span className="text-white capitalize">{opportunity.buy_platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Outcome:</span>
                <span className="text-white">{opportunity.buy_outcome}</span>
              </div>
              <div className="text-gray-500 truncate">
                {opportunity.buy_market_id}
              </div>
            </div>
          </div>

          {/* Sell Side */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-400 text-sm font-semibold">SELL</span>
              <span className="text-red-400 font-mono text-lg font-bold">
                {(opportunity.sell_price * 100).toFixed(2)}¢
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Platform:</span>
                <span className="text-white capitalize">{opportunity.sell_platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Outcome:</span>
                <span className="text-white">{opportunity.sell_outcome}</span>
              </div>
              <div className="text-gray-500 truncate">
                {opportunity.sell_market_id}
              </div>
            </div>
          </div>
        </div>

        {opportunity.min_capital_required && (
          <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between text-sm">
            <span className="text-gray-400">Min. Capital Required:</span>
            <span className="text-white font-semibold">
              ${opportunity.min_capital_required.toFixed(2)}
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className={`px-3 py-1 rounded text-xs font-medium ${
            opportunity.status === 'active' 
              ? 'bg-green-500/20 text-green-500' 
              : 'bg-gray-500/20 text-gray-500'
          }`}>
            {opportunity.status}
          </span>
          <span className="text-blue-400 text-sm">View Details →</span>
        </div>
      </div>
    </Link>
  );
}


