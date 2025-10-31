import React from 'react';
import Link from 'next/link';
import { Market } from '../../types/market';

interface MarketCardProps {
  market: Market;
}

export default function MarketCard({ market }: MarketCardProps) {
  const formatNumber = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-400';
      case 'RESOLVED':
        return 'text-blue-400';
      case 'CANCELLED':
        return 'text-red-400';
      case 'PAUSED':
        return 'text-yellow-400';
      default:
        return 'text-white/70';
    }
  };

  const formatDescriptionPreview = (description?: string) => {
    if (!description) return null;
    
    // Check if this looks like a list of conditions
    const hasNewlines = description.includes('\n');
    const conditionPattern = /^(yes|no)\s+\w+.*?,/i;
    
    let preview: string = description;
    
    if (hasNewlines) {
      // Take first condition only for preview
      const firstCondition = description.split('\n')[0];
      const cleaned = firstCondition.replace(/^(yes|no)\s+/i, '');
      preview = cleaned;
    } else if (conditionPattern.test(description)) {
      // Take first condition from comma-separated list
      const firstCondition = description.split(',')[0];
      const cleaned = firstCondition.replace(/^(yes|no)\s+/i, '');
      preview = cleaned;
    }
    
    return preview;
  };

  return (
    <Link href={`/markets/${market.id}`}>
      <div className="bg-black border border-[#4c4c4c] rounded-[20px] p-4 md:p-6 hover:border-white/50 transition-all cursor-pointer group min-h-[280px] flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className={`text-[12px] font-mono ${getStatusColor(market.status)}`}>
            {market.status}
          </span>
          {market.category && (
            <span className="text-[11px] font-mono text-white/50 bg-white/5 px-2 py-1 rounded-[6px]">
              {market.category}
            </span>
          )}
        </div>

        <h3 className="text-white text-[18px] md:text-[20px] font-semibold leading-[1.3] tracking-[-0.4px] mb-3 line-clamp-2 group-hover:text-white/90 transition-colors">
          {market.title}
        </h3>

        {market.description && (
          <p className="text-white/70 text-[12px] font-mono leading-[1.5] mb-4 line-clamp-2">
            {formatDescriptionPreview(market.description)}
          </p>
        )}

        <div className="flex-1" />

        {/* Outcomes */}
        {market.outcomes && market.outcomes.length > 0 && (
          <div className="space-y-2 mb-4">
            {market.outcomes.slice(0, 2).map((outcome) => (
              <div
                key={outcome.id}
                className="flex items-center justify-between bg-white/5 rounded-[10px] px-3 py-2"
              >
                <span className="text-white text-[13px] font-mono">{outcome.title}</span>
                <span className="text-white font-semibold text-[14px]">
                  {outcome.currentPrice !== undefined
                    ? `${(outcome.currentPrice * 100).toFixed(1)}%`
                    : '-'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#4c4c4c]/50">
          <div>
            <p className="text-white/50 text-[10px] font-mono mb-1">Volume</p>
            <p className="text-white text-[13px] font-semibold">
              ${formatNumber(market.totalVolume)}
            </p>
          </div>
          <div>
            <p className="text-white/50 text-[10px] font-mono mb-1">Liquidity</p>
            <p className="text-white text-[13px] font-semibold">
              ${formatNumber(market.totalLiquidity)}
            </p>
          </div>
          <div>
            <p className="text-white/50 text-[10px] font-mono mb-1">Traders</p>
            <p className="text-white text-[13px] font-semibold">
              {market.participantCount || 0}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

