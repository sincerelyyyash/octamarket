'use client';

import { useMarketSources, useBestPrice } from '@/lib/api';
import { PriceComparison } from './PriceComparison';

interface MarketDetailsProps {
  eventFingerprint: string;
  title: string;
  description?: string;
}

export function MarketDetails({ eventFingerprint, title, description }: MarketDetailsProps) {
  const { data: sources, isLoading: sourcesLoading } = useMarketSources(eventFingerprint);
  const { data: bestPrice, isLoading: priceLoading } = useBestPrice(eventFingerprint);

  if (sourcesLoading || priceLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="bg-gray-800 h-40 rounded-lg"></div>
        <div className="bg-gray-800 h-60 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
        <h1 className="text-3xl font-bold text-white mb-4">{title}</h1>
        {description && (
          <p className="text-gray-300 leading-relaxed">{description}</p>
        )}
      </div>

      {/* Best Prices */}
      {bestPrice && (
        <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">🎯 Best Prices</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-400 font-semibold">Best Yes Price</span>
                <span className="text-green-400 text-2xl font-bold">
                  {(bestPrice.best_yes_price * 100).toFixed(2)}¢
                </span>
              </div>
              <div className="text-gray-300 text-sm">
                Available on <span className="font-semibold text-white">{bestPrice.best_yes_platform}</span>
              </div>
              <div className="text-gray-400 text-xs mt-2">
                Market ID: {bestPrice.best_yes_market_id}
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-400 font-semibold">Best No Price</span>
                <span className="text-red-400 text-2xl font-bold">
                  {(bestPrice.best_no_price * 100).toFixed(2)}¢
                </span>
              </div>
              <div className="text-gray-300 text-sm">
                Available on <span className="font-semibold text-white">{bestPrice.best_no_platform}</span>
              </div>
              <div className="text-gray-400 text-xs mt-2">
                Market ID: {bestPrice.best_no_market_id}
              </div>
            </div>
          </div>
          <div className="text-gray-400 text-xs mt-4">
            Last updated: {new Date(bestPrice.last_updated).toLocaleString()}
          </div>
        </div>
      )}

      {/* Price Comparison */}
      {sources && sources.length > 0 && (
        <PriceComparison sources={sources} />
      )}

      {/* Platform Sources */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">
          Available on {sources?.length || 0} Platform{sources?.length !== 1 ? 's' : ''}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources?.map(source => (
            <div key={source.id} className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-white capitalize">{source.source}</span>
                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                  {source.status || 'active'}
                </span>
              </div>
              
              {source.prices && (
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Yes:</span>
                    <span className="text-green-400 font-mono">
                      {typeof source.prices === 'object' && source.prices.yes 
                        ? (source.prices.yes * 100).toFixed(2) 
                        : 'N/A'}¢
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">No:</span>
                    <span className="text-red-400 font-mono">
                      {typeof source.prices === 'object' && source.prices.no 
                        ? (source.prices.no * 100).toFixed(2) 
                        : 'N/A'}¢
                    </span>
                  </div>
                </div>
              )}

              {source.traded_amount && (
                <div className="text-xs text-gray-400 mb-2">
                  Volume: ${source.traded_amount.toLocaleString()}
                </div>
              )}

              <a
                href={`https://${source.source}.com/market/${source.market_slug || source.market_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View on {source.source} →
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


