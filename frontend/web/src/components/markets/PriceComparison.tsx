'use client';

import { MarketSource } from '@/lib/api/types';
import { useMemo } from 'react';

interface PriceComparisonProps {
  sources: MarketSource[];
}

export function PriceComparison({ sources }: PriceComparisonProps) {
  const priceData = useMemo(() => {
    return sources
      .map(source => {
        const prices = source.prices as any;
        return {
          platform: source.source,
          yesPrice: prices?.yes || 0,
          noPrice: prices?.no || 0,
        };
      })
      .filter(item => item.yesPrice > 0 || item.noPrice > 0);
  }, [sources]);

  const maxPrice = Math.max(
    ...priceData.map(d => Math.max(d.yesPrice, d.noPrice))
  );

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-6">📊 Price Comparison</h2>
      
      <div className="space-y-4">
        {priceData.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium capitalize">{item.platform}</span>
              <div className="flex gap-4 text-sm">
                <span className="text-green-400">
                  Yes: {(item.yesPrice * 100).toFixed(2)}¢
                </span>
                <span className="text-red-400">
                  No: {(item.noPrice * 100).toFixed(2)}¢
                </span>
              </div>
            </div>
            
            {/* Visual bar chart */}
            <div className="flex gap-2 h-8">
              <div className="flex-1 bg-gray-900 rounded overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-full flex items-center justify-end px-2 transition-all"
                  style={{ width: `${(item.yesPrice / maxPrice) * 100}%` }}
                >
                  {item.yesPrice > 0.1 && (
                    <span className="text-white text-xs font-bold">
                      {(item.yesPrice * 100).toFixed(1)}¢
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 bg-gray-900 rounded overflow-hidden">
                <div
                  className="bg-gradient-to-r from-red-500 to-red-600 h-full flex items-center justify-end px-2 transition-all"
                  style={{ width: `${(item.noPrice / maxPrice) * 100}%` }}
                >
                  {item.noPrice > 0.1 && (
                    <span className="text-white text-xs font-bold">
                      {(item.noPrice * 100).toFixed(1)}¢
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {priceData.length === 0 && (
        <p className="text-gray-400 text-center py-8">
          No price data available for comparison
        </p>
      )}
    </div>
  );
}


