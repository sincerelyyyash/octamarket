'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { fetchMarketById, fetchPriceHistory } from '../../../store/slices/marketsSlice';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import TradeModal from '../../../components/trading/TradeModal';
import TradeStatusModal from '../../../components/trading/TradeStatusModal';
import Link from 'next/link';

export default function MarketDetailPage() {
  const params = useParams();
  const dispatch = useAppDispatch();
  const { selectedMarket, priceHistory, loading } = useAppSelector((state) => state.markets);
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showTradeStatusModal, setShowTradeStatusModal] = useState(false);
  const [currentIntentId, setCurrentIntentId] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      dispatch(fetchMarketById(params.id as string));
      dispatch(fetchPriceHistory({ id: params.id as string }));
    }
  }, [dispatch, params.id]);

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  const formatDescription = (description?: string) => {
    if (!description) return null;
    
    // Check if this looks like a list of conditions (newline or comma separated)
    // Pattern: "PlayerName: Stats\nPlayerName: Stats" or "yes PlayerName: Stats,no PlayerName: Stats,..."
    const hasNewlines = description.includes('\n');
    const conditionPattern = /^(yes|no)\s+\w+.*?,/i;
    
    let conditions: string[] = [];
    
    if (hasNewlines) {
      // Already formatted from backend with newlines
      conditions = description.split('\n').filter(c => c.trim());
    } else if (conditionPattern.test(description)) {
      // Parse comma-separated conditions (fallback for old data)
      conditions = description.split(',').filter(c => c.trim());
    }
    
    if (conditions.length > 0) {
      return conditions.map((condition, index) => {
        const trimmed = condition.trim();
        // Format: "yes PlayerName: Stat" -> "PlayerName: Stat" (for old data)
        const cleaned = trimmed.replace(/^(yes|no)\s+/i, '');
        return (
          <span key={index} className="block mb-1">
            <span className="text-white/50 font-mono text-[12px] mr-2">•</span>
            {cleaned}
          </span>
        );
      });
    }
    
    // Return original description if it doesn't match the pattern
    return <span>{description}</span>;
  };

  if (loading || !selectedMarket) {
    return (
      <div className="min-h-screen bg-[#090C15] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090C15] text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/markets"
            className="text-white/70 hover:text-white text-[14px] font-mono transition-colors inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Markets
          </Link>
        </div>

        {/* Header */}
        <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-[14px] font-mono ${getStatusColor(selectedMarket.status)}`}>
                  {selectedMarket.status}
                </span>
                {selectedMarket.category && (
                  <span className="text-[12px] font-mono text-white/50 bg-white/5 px-3 py-1 rounded-[4px]">
                    {selectedMarket.category}
                  </span>
                )}
              </div>
              <h1 className="text-[28px] md:text-[36px] font-semibold tracking-[-0.72px] mb-4">
                {selectedMarket.title}
              </h1>
              {selectedMarket.description && (
                <div className="text-white/70 text-[14px] font-mono leading-[1.6]">
                  {formatDescription(selectedMarket.description)}
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-[#4c4c4c]/50">
            <div>
              <p className="text-white/50 text-[12px] font-mono mb-1">Total Volume</p>
              <p className="text-white text-[20px] font-semibold">
                ${formatNumber(selectedMarket.totalVolume)}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-[12px] font-mono mb-1">Liquidity</p>
              <p className="text-white text-[20px] font-semibold">
                ${formatNumber(selectedMarket.totalLiquidity)}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-[12px] font-mono mb-1">Traders</p>
              <p className="text-white text-[20px] font-semibold">
                {selectedMarket.participantCount || 0}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-[12px] font-mono mb-1">End Date</p>
              <p className="text-white text-[20px] font-semibold">{formatDate(selectedMarket.endDate)}</p>
            </div>
          </div>
        </div>

        {/* Outcomes */}
        <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8 mb-6">
          <h2 className="text-white text-[22px] font-semibold mb-4">Outcomes</h2>
          <div className="space-y-3">
            {selectedMarket.outcomes.map((outcome) => (
              <div
                key={outcome.id}
                className="bg-white/5 border border-[#4c4c4c] rounded-[8px] p-4 hover:border-white/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white text-[16px] font-semibold">{outcome.title}</h3>
                  <div className="text-right">
                    <p className="text-white text-[24px] font-bold">
                      {outcome.currentPrice !== undefined
                        ? `${(outcome.currentPrice * 100).toFixed(1)}%`
                        : '-'}
                    </p>
                    <p className="text-white/50 text-[11px] font-mono">Current Price</p>
                  </div>
                </div>
                {outcome.description && (
                  <p className="text-white/70 text-[12px] font-mono mb-3">{outcome.description}</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/50 text-[11px] font-mono">Volume</p>
                    <p className="text-white text-[14px] font-semibold">
                      ${formatNumber(outcome.currentVolume)}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50 text-[11px] font-mono">Liquidity</p>
                    <p className="text-white text-[14px] font-semibold">
                      ${formatNumber(outcome.currentLiquidity)}
                    </p>
                  </div>
                </div>
                {isAuthenticated ? (
                  <button
                    onClick={() => setShowTradeModal(true)}
                    className="w-full mt-4 bg-white hover:bg-white/90 text-black text-[14px] font-medium font-mono px-6 py-3 rounded-[8px] transition-colors cursor-pointer"
                  >
                    Trade
                  </button>
                ) : (
                  <div className="w-full mt-4 bg-white/10 text-white/50 text-[14px] font-medium font-mono px-6 py-3 rounded-[8px] text-center">
                    Login to Trade
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Source Markets */}
        {selectedMarket.sourceMarkets && selectedMarket.sourceMarkets.length > 0 && (
          <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8">
            <h2 className="text-white text-[22px] font-semibold mb-4">Available on</h2>
            <div className="space-y-3">
              {selectedMarket.sourceMarkets.map((sourceMarket) => (
                <div
                  key={sourceMarket.id}
                  className="bg-white/5 rounded-[8px] px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white text-[14px] font-semibold">{sourceMarket.source}</p>
                    <p className="text-white/50 text-[11px] font-mono truncate max-w-[200px] sm:max-w-none">
                      {sourceMarket.sourceMarketId}
                    </p>
                  </div>
                  <span
                    className={`text-[12px] font-mono ${
                      sourceMarket.isActive ? 'text-green-400' : 'text-white/50'
                    }`}
                  >
                    {sourceMarket.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade Modal */}
        {selectedMarket && (
          <TradeModal
            isOpen={showTradeModal}
            onClose={() => setShowTradeModal(false)}
            market={selectedMarket}
            onTradeCreated={(intentId) => {
              setCurrentIntentId(intentId);
              setShowTradeStatusModal(true);
            }}
          />
        )}

        {/* Trade Status Modal */}
        {currentIntentId && (
          <TradeStatusModal
            isOpen={showTradeStatusModal}
            onClose={() => {
              setShowTradeStatusModal(false);
              setCurrentIntentId(null);
            }}
            intentId={currentIntentId}
          />
        )}
      </main>
    </div>
  );
}

