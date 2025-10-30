"use client";

import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchPlatformStats,
  fetchMarketStats,
  fetchSourceStats,
  setTimeframe,
} from "../../store/slices/statsSlice";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { TimeframeFilter } from "../../types/api";

export default function StatsPage() {
  const dispatch = useAppDispatch();
  const { platformStats, marketStats, sourceStats, timeframe, loading } =
    useAppSelector((state) => state.stats);

  useEffect(() => {
    dispatch(fetchPlatformStats(timeframe));
    dispatch(fetchMarketStats({ page: 1, limit: 10 }));
    dispatch(fetchSourceStats(timeframe));
  }, [dispatch, timeframe]);

  const formatNumber = (num?: number) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const handleTimeframeChange = (newTimeframe: TimeframeFilter) => {
    dispatch(setTimeframe(newTimeframe));
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[32px] md:text-[40px] font-semibold tracking-[-0.8px] mb-3">
            Platform Statistics
          </h1>
          <p className="text-white/70 text-[14px] font-mono leading-[1.6] max-w-2xl">
            Real-time analytics and insights across all prediction markets and
            trading activity.
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-2 flex-wrap mb-8">
          {(["1h", "24h", "7d", "30d", "all"] as TimeframeFilter[]).map(
            (tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={`px-4 py-2 rounded-[8px] text-[14px] font-mono transition-colors ${
                  timeframe === tf
                    ? "bg-white text-black"
                    : "bg-black border border-[#4c4c4c] text-white hover:border-white/50"
                }`}
              >
                {tf.toUpperCase()}
              </button>
            )
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Platform Overview */}
            {platformStats && (
              <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8">
                <h2 className="text-white text-[22px] font-semibold mb-6">
                  Platform Overview
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-white/50 text-[12px] font-mono mb-2">
                      Total Markets
                    </p>
                    <p className="text-white text-[28px] font-semibold">
                      {formatNumber(platformStats.overview.totalMarkets)}
                    </p>
                    <p className="text-green-400 text-[11px] font-mono mt-1">
                      {platformStats.overview.activeMarkets} active
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50 text-[12px] font-mono mb-2">
                      Total Volume
                    </p>
                    <p className="text-white text-[28px] font-semibold">
                      ${formatNumber(platformStats.overview.totalVolume)}
                    </p>
                    <p className="text-white/50 text-[11px] font-mono mt-1">
                      Avg: $
                      {formatNumber(platformStats.overview.avgMarketVolume)}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50 text-[12px] font-mono mb-2">
                      Total Traders
                    </p>
                    <p className="text-white text-[28px] font-semibold">
                      {formatNumber(platformStats.overview.totalTraders)}
                    </p>
                    <p className="text-white/50 text-[11px] font-mono mt-1">
                      Avg PnL: $
                      {formatNumber(platformStats.overview.avgTraderPnl)}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50 text-[12px] font-mono mb-2">
                      Total Trades
                    </p>
                    <p className="text-white text-[28px] font-semibold">
                      {formatNumber(platformStats.overview.totalTrades)}
                    </p>
                    <p className="text-white/50 text-[11px] font-mono mt-1">
                      {platformStats.overview.recentActivity} recent
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Source Stats */}
            {sourceStats && (
              <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8">
                <h2 className="text-white text-[22px] font-semibold mb-6">
                  By Source
                </h2>
                <div className="space-y-4">
                  {sourceStats.sources.map((source) => (
                    <div
                      key={source.source}
                      className="bg-white/5 rounded-[8px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <h3 className="text-white text-[18px] font-semibold mb-2">
                          {source.source}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div>
                            <p className="text-white/50 text-[11px] font-mono">
                              Markets
                            </p>
                            <p className="text-white text-[16px] font-semibold">
                              {source.markets}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/50 text-[11px] font-mono">
                              Traders
                            </p>
                            <p className="text-white text-[16px] font-semibold">
                              {source.traders}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/50 text-[11px] font-mono">
                              Trades
                            </p>
                            <p className="text-white text-[16px] font-semibold">
                              {source.trades}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/50 text-[11px] font-mono">
                              Volume
                            </p>
                            <p className="text-white text-[16px] font-semibold">
                              ${formatNumber(source.volume)}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/50 text-[11px] font-mono">
                              Avg Trade
                            </p>
                            <p className="text-white text-[16px] font-semibold">
                              ${formatNumber(source.avgTradeValue)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Market Stats */}
            {marketStats && (
              <>
                {/* Markets by Category */}
                {marketStats.overview.marketsByCategory.length > 0 && (
                  <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8">
                    <h2 className="text-white text-[22px] font-semibold mb-6">
                      Markets by Category
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {marketStats.overview.marketsByCategory
                        .slice(0, 8)
                        .map((cat) => (
                          <div
                            key={cat.category}
                            className="bg-white/5 rounded-[8px] p-4"
                          >
                            <p className="text-white/70 text-[12px] font-mono mb-1">
                              {cat.category}
                            </p>
                            <p className="text-white text-[20px] font-semibold">
                              {cat.count}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Top Markets */}
                {marketStats.topMarkets.byVolume.length > 0 && (
                  <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-6 md:p-8">
                    <h2 className="text-white text-[22px] font-semibold mb-6">
                      Top Markets by Volume
                    </h2>
                    <div className="space-y-3">
                      {marketStats.topMarkets.byVolume
                        .slice(0, 5)
                        .map((market, index) => (
                          <div
                            key={market.id}
                            className="bg-white/5 rounded-[8px] p-4 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <span className="text-white/50 text-[16px] font-semibold w-8">
                                #{index + 1}
                              </span>
                              <div className="flex-1">
                                <h3 className="text-white text-[15px] font-semibold line-clamp-1">
                                  {market.title}
                                </h3>
                                {market.category && (
                                  <p className="text-white/50 text-[11px] font-mono">
                                    {market.category}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-white text-[16px] font-semibold">
                                ${formatNumber(market.totalVolume)}
                              </p>
                              <p className="text-white/50 text-[11px] font-mono">
                                {market.participantCount} traders
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
