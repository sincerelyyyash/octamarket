'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { fetchMarketById, fetchPriceHistory } from '../../../store/slices/marketsSlice';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import TradeModal from '../../../components/trading/TradeModal';
import TradeStatusModal from '../../../components/trading/TradeStatusModal';
import Link from 'next/link';
import { TradeSide } from '../../../types/trade';
import type { MarketOutcome } from '../../../types/market';

export default function MarketDetailPage() {
  const params = useParams();
  const dispatch = useAppDispatch();
  const { selectedMarket, priceHistory, loading } = useAppSelector((state) => state.markets);
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showTradeStatusModal, setShowTradeStatusModal] = useState(false);
  const [currentIntentId, setCurrentIntentId] = useState<string | null>(null);
  const [selectedOutcomeForTrade, setSelectedOutcomeForTrade] = useState<any>(null);
  const [selectedSideForTrade, setSelectedSideForTrade] = useState<any>(null);

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

  // Ensure Yes/No outcomes exist for binary markets (fallback logic)
  const displayOutcomes = useMemo(() => {
    if (!selectedMarket) return [];
    
    // Create a new array copy to avoid mutating the original
    const originalOutcomes = selectedMarket.outcomes || [];
    let outcomes = [...originalOutcomes];
    
    // If no outcomes exist, but this looks like a binary market, create Yes/No fallback
    if (outcomes.length === 0) {
      // Check if this is likely a binary market (not a parlay)
      const isBinaryMarket = !selectedMarket.description?.includes('\n') && 
                            !selectedMarket.description?.includes(',');
      
      if (isBinaryMarket) {
        outcomes = [
          {
            id: 'fallback-yes',
            title: 'Yes',
            index: 0,
            currentPrice: undefined,
            currentVolume: undefined,
            currentLiquidity: undefined,
          },
          {
            id: 'fallback-no',
            title: 'No',
            index: 1,
            currentPrice: undefined,
            currentVolume: undefined,
            currentLiquidity: undefined,
          },
        ] as MarketOutcome[];
      }
    }
    
    // Ensure we have at least Yes/No if outcomes exist but don't include them
    const hasYes = outcomes.some(o => o.title.toLowerCase() === 'yes');
    const hasNo = outcomes.some(o => o.title.toLowerCase() === 'no');
    
    if (outcomes.length > 0 && (!hasYes || !hasNo)) {
      // Create a new array with missing Yes/No outcomes
      const updatedOutcomes = [...outcomes];
      
      if (!hasYes) {
        updatedOutcomes.unshift({
          id: `fallback-yes-${selectedMarket.id}`,
          title: 'Yes',
          index: 0,
          currentPrice: undefined,
          currentVolume: undefined,
          currentLiquidity: undefined,
        } as MarketOutcome);
      }
      if (!hasNo) {
        updatedOutcomes.push({
          id: `fallback-no-${selectedMarket.id}`,
          title: 'No',
          index: 1,
          currentPrice: undefined,
          currentVolume: undefined,
          currentLiquidity: undefined,
        } as MarketOutcome);
      }
      
      outcomes = updatedOutcomes;
    }
    
    return outcomes;
  }, [selectedMarket]);

  const handleQuickTrade = (outcome: MarketOutcome, side: TradeSide) => {
    setSelectedOutcomeForTrade(outcome);
    setSelectedSideForTrade(side);
    setShowTradeModal(true);
  };

  // Error state (if market not found or failed to load)
  if (!loading && !selectedMarket) {
    return (
      <div className="min-h-screen bg-[#090C15] text-white flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h1 className="text-[24px] font-semibold mb-4">Market Not Found</h1>
          <p className="text-white/70 text-[14px] font-mono mb-6">
            The market you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/markets"
            className="inline-flex items-center gap-2 text-white hover:text-white/80 text-[14px] font-mono transition-colors"
            aria-label="Back to markets"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Markets
          </Link>
        </div>
      </div>
    );
  }

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
        <nav className="mb-6" aria-label="Breadcrumb">
          <Link
            href="/markets"
            className="text-white/70 hover:text-white text-[14px] font-mono transition-colors inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-[#090C15] rounded px-2 py-1"
            aria-label="Navigate back to markets list"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Markets
          </Link>
        </nav>

        {/* Header */}
        <header className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-[14px] font-mono ${getStatusColor(selectedMarket.status)}`} aria-label={`Market status: ${selectedMarket.status}`}>
                  {selectedMarket.status}
                </span>
                {selectedMarket.category && (
                  <span className="text-[12px] font-mono text-white/50 bg-white/5 px-3 py-1 rounded-[4px]" aria-label={`Category: ${selectedMarket.category}`}>
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
          
          {/* Additional Market Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-[#4c4c4c]/50 mt-4">
            <div>
              <p className="text-white/50 text-[12px] font-mono mb-1">Created</p>
              <p className="text-white text-[14px] font-mono">{formatDate(selectedMarket.createdAt)}</p>
            </div>
            <div>
              <p className="text-white/50 text-[12px] font-mono mb-1">Last Updated</p>
              <p className="text-white text-[14px] font-mono">{formatDate(selectedMarket.updatedAt)}</p>
            </div>
            {selectedMarket.sourceMarkets && selectedMarket.sourceMarkets.length > 0 && (
              <div>
                <p className="text-white/50 text-[12px] font-mono mb-1">Sources</p>
                <div className="flex flex-wrap gap-1">
                  {selectedMarket.sourceMarkets.map((sm, idx) => (
                    <span key={idx} className="text-green-400 text-[11px] font-mono bg-green-400/10 px-2 py-0.5 rounded">
                      {sm.source}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Outcomes */}
        <section className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8 mb-6" aria-labelledby="outcomes-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="outcomes-heading" className="text-white text-[22px] font-semibold">Outcomes</h2>
            {displayOutcomes.length === 0 && (
              <span className="text-white/50 text-[12px] font-mono" aria-live="polite">No outcomes available</span>
            )}
          </div>
          {displayOutcomes.length === 0 ? (
            <div className="bg-white/5 border border-[#4c4c4c] rounded-[8px] p-8 text-center" role="status" aria-live="polite">
              <p className="text-white/50 text-[14px] font-mono mb-2">No outcomes available for this market</p>
              <p className="text-white/30 text-[12px] font-mono">Prices may be unavailable at this time</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayOutcomes.map((outcome) => {
              const displayPrice = outcome.bestPrice ?? outcome.currentPrice;
              const hasMultipleSources = outcome.prices && outcome.prices.length > 1;
              
                const isYes = outcome.title.toLowerCase() === 'yes';
                const isNo = outcome.title.toLowerCase() === 'no';
                const priceColor = isYes ? 'text-green-400' : isNo ? 'text-red-400' : 'text-white';
                
                return (
                  <div
                    key={outcome.id}
                    className="bg-white/5 border border-[#4c4c4c] rounded-[10px] p-5 hover:border-white/30 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className={`text-white text-[18px] font-semibold ${isYes ? 'text-green-400' : isNo ? 'text-red-400' : ''}`}>
                            {outcome.title}
                          </h3>
                          {outcome.id?.startsWith('fallback') && (
                            <span className="text-white/40 text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded">
                              Placeholder
                            </span>
                          )}
                        </div>
                        {outcome.description && (
                          <p className="text-white/60 text-[12px] font-mono mb-2">{outcome.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          <p className={`text-[28px] font-bold ${displayPrice !== undefined ? priceColor : 'text-white/30'}`}>
                            {displayPrice !== undefined
                              ? `${(displayPrice * 100).toFixed(1)}%`
                              : 'N/A'}
                          </p>
                          {hasMultipleSources && outcome.bestPriceSource && (
                            <span className="text-green-400 text-[10px] font-mono bg-green-400/10 px-2 py-0.5 rounded">
                              Best
                            </span>
                          )}
                        </div>
                        <p className="text-white/50 text-[11px] font-mono">Current Price</p>
                        {displayPrice === undefined && (
                          <p className="text-white/30 text-[10px] font-mono mt-1">Price unavailable</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Per-Source Prices */}
                    {hasMultipleSources && outcome.prices && outcome.prices.length > 0 && (
                      <div className="mb-4 pb-4 border-b border-[#4c4c4c]/50">
                        <p className="text-white/50 text-[11px] font-mono mb-2">Prices by Source</p>
                        <div className="space-y-2">
                          {outcome.prices.map((price, idx) => {
                            const isBest = outcome.bestPriceSource === price.source;
                            return (
                              <div
                                key={idx}
                                className={`flex items-center justify-between bg-black/50 rounded-[6px] px-3 py-2 ${
                                  isBest ? 'border border-green-400/30' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-white/70 text-[12px] font-mono">
                                    {price.source}
                                  </span>
                                  {isBest && (
                                    <span className="text-green-400 text-[10px] font-mono">⭐</span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className={`text-[14px] font-semibold ${
                                    isBest ? 'text-green-400' : 'text-white'
                                  }`}>
                                    {(price.price * 100).toFixed(1)}%
                                  </p>
                                  {price.volume !== undefined && (
                                    <p className="text-white/50 text-[10px] font-mono">
                                      Vol: ${formatNumber(price.volume)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-white/50 text-[11px] font-mono mb-1">Volume</p>
                        <p className="text-white text-[16px] font-semibold">
                          ${formatNumber(outcome.currentVolume)}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/50 text-[11px] font-mono mb-1">Liquidity</p>
                        <p className="text-white text-[16px] font-semibold">
                          ${formatNumber(outcome.currentLiquidity)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Quick Trade Buttons */}
                    {isAuthenticated ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleQuickTrade(outcome, TradeSide.BUY)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleQuickTrade(outcome, TradeSide.BUY);
                            }
                          }}
                          className="bg-green-500 hover:bg-green-600 active:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-black text-white text-[13px] font-medium font-mono px-4 py-2.5 rounded-[8px] transition-colors cursor-pointer flex items-center justify-center gap-2"
                          aria-label={`Buy ${outcome.title} outcome`}
                          tabIndex={0}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Buy {outcome.title}
                        </button>
                        <button
                          onClick={() => handleQuickTrade(outcome, TradeSide.SELL)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleQuickTrade(outcome, TradeSide.SELL);
                            }
                          }}
                          className="bg-red-500 hover:bg-red-600 active:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-black text-white text-[13px] font-medium font-mono px-4 py-2.5 rounded-[8px] transition-colors cursor-pointer flex items-center justify-center gap-2"
                          aria-label={`Sell ${outcome.title} outcome`}
                          tabIndex={0}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                          Sell {outcome.title}
                        </button>
                      </div>
                    ) : (
                      <div className="w-full bg-white/10 text-white/50 text-[13px] font-medium font-mono px-6 py-3 rounded-[8px] text-center">
                        Connect Wallet to Trade
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Price History Chart */}
        {priceHistory && priceHistory.length > 0 && (
          <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8 mb-6">
            <h2 className="text-white text-[22px] font-semibold mb-4">Price History</h2>
            <div className="bg-white/5 rounded-[8px] p-4 h-[300px] flex items-center justify-center">
              <p className="text-white/50 text-[14px] font-mono">
                Chart visualization coming soon. {priceHistory.length} data points available.
              </p>
            </div>
          </div>
        )}

        {/* Source Markets */}
        {selectedMarket.sourceMarkets && selectedMarket.sourceMarkets.length > 0 && (
          <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-[22px] font-semibold">Available on</h2>
              {selectedMarket.sourceMarkets.length > 1 && (
                <span className="text-green-400 text-[12px] font-mono bg-green-400/10 px-3 py-1 rounded">
                  {selectedMarket.sourceMarkets.length} Sources Aggregated
                </span>
              )}
            </div>
            <p className="text-white/50 text-[12px] font-mono mb-4">
              {selectedMarket.sourceMarkets.length > 1 
                ? 'This market aggregates prices from multiple sources. Execution engine will automatically choose the best venue based on real-time quotes.'
                : 'Prices are sourced from this platform.'}
            </p>
            <div className="space-y-3">
              {selectedMarket.sourceMarkets.map((sourceMarket) => (
                <div
                  key={sourceMarket.id}
                  className="bg-white/5 rounded-[8px] px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white text-[14px] font-semibold">{sourceMarket.source}</p>
                      {sourceMarket.isActive && (
                        <span className="text-green-400 text-[10px] font-mono bg-green-400/10 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-white/50 text-[11px] font-mono truncate max-w-[200px] sm:max-w-none">
                      {sourceMarket.sourceMarketId}
                    </p>
                  </div>
                  {!sourceMarket.isActive && (
                    <span className="text-white/50 text-[12px] font-mono">
                      Inactive
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade Modal */}
        {selectedMarket && (
          <TradeModal
            isOpen={showTradeModal}
            onClose={() => {
              setShowTradeModal(false);
              setSelectedOutcomeForTrade(null);
              setSelectedSideForTrade(null);
            }}
            market={selectedMarket}
            initialOutcome={selectedOutcomeForTrade}
            initialSide={selectedSideForTrade}
            onTradeCreated={(intentId) => {
              setCurrentIntentId(intentId);
              setShowTradeStatusModal(true);
              setSelectedOutcomeForTrade(null);
              setSelectedSideForTrade(null);
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

