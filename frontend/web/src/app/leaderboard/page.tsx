"use client";

import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchLeaderboard,
  setFilters,
  setSortParams,
} from "../../store/slices/tradersSlice";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Link from "next/link";
import { TimeframeFilter } from "../../types/api";
import { MarketSource } from "../../types/market";

export default function LeaderboardPage() {
  const dispatch = useAppDispatch();
  const { leaderboard, filters, sortParams, pagination, loading } =
    useAppSelector((state) => state.traders);
  const [currentPage, setCurrentPage] = useState(1);
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("all");
  const [selectedSource, setSelectedSource] = useState<
    MarketSource | undefined
  >();

  useEffect(() => {
    dispatch(
      fetchLeaderboard({
        page: currentPage,
        limit: 20,
        source: selectedSource,
        timeframe,
        sortParams,
      })
    );
  }, [dispatch, currentPage, selectedSource, timeframe, sortParams]);

  const formatNumber = (num?: number) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const getRankChange = (change?: number) => {
    if (!change || change === 0) return null;
    if (change > 0) {
      return (
        <span className="text-green-400 text-[12px] font-mono flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          {Math.abs(change)}
        </span>
      );
    }
    return (
      <span className="text-red-400 text-[12px] font-mono flex items-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {Math.abs(change)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[32px] md:text-[40px] font-semibold tracking-[-0.8px] mb-3">
            Leaderboard
          </h1>
          <p className="text-white/70 text-[14px] font-mono leading-[1.6] max-w-2xl">
            Top performing traders across all prediction markets. Track
            performance, analyze strategies, and discover traders to follow.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Timeframe Filter */}
          <div className="flex gap-2 flex-wrap">
            {(["1h", "24h", "7d", "30d", "all"] as TimeframeFilter[]).map(
              (tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
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

          {/* Source Filter */}
          <select
            value={selectedSource || ""}
            onChange={(e) =>
              setSelectedSource((e.target.value as MarketSource) || undefined)
            }
            className="bg-black border border-[#4c4c4c] rounded-[8px] px-4 py-2 text-white text-[14px] font-mono focus:outline-none focus:border-white/50 transition-colors"
          >
            <option value="">All Sources</option>
            <option value={MarketSource.POLYMARKET}>Polymarket</option>
            <option value={MarketSource.KALSHI}>Kalshi</option>
            <option value={MarketSource.AUGUR}>Augur</option>
          </select>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-black border border-[#4c4c4c] rounded-[12px] overflow-hidden">
          {loading && leaderboard.length === 0 ? (
            <div className="p-12 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : leaderboard.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-[#4c4c4c]">
                    <tr className="text-left">
                      <th className="px-6 py-4 text-white/70 text-[12px] font-mono uppercase">
                        Rank
                      </th>
                      <th className="px-6 py-4 text-white/70 text-[12px] font-mono uppercase">
                        Trader
                      </th>
                      <th className="px-6 py-4 text-white/70 text-[12px] font-mono uppercase">
                        Source
                      </th>
                      <th className="px-6 py-4 text-white/70 text-[12px] font-mono uppercase text-right">
                        PnL
                      </th>
                      <th className="px-6 py-4 text-white/70 text-[12px] font-mono uppercase text-right">
                        Volume
                      </th>
                      <th className="px-6 py-4 text-white/70 text-[12px] font-mono uppercase text-right">
                        Win Rate
                      </th>
                      <th className="px-6 py-4 text-white/70 text-[12px] font-mono uppercase text-right">
                        Trades
                      </th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((trader) => (
                      <tr
                        key={trader.id}
                        className="border-b border-[#4c4c4c]/30 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-[16px] font-semibold">
                              #{trader.currentRank || "-"}
                            </span>
                            {getRankChange(trader.rankChange)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/traders/${trader.id}`}
                            className="flex items-center gap-3 group"
                          >
                            {trader.profileImageUrl ? (
                              <img
                                src={trader.profileImageUrl}
                                alt={
                                  trader.displayName ||
                                  trader.username ||
                                  "Trader"
                                }
                                className="w-10 h-10 rounded-full"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                <span className="text-white text-[14px] font-semibold">
                                  {(trader.displayName ||
                                    trader.username ||
                                    "?")[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="text-white text-[14px] font-medium group-hover:underline">
                              {trader.displayName ||
                                trader.username ||
                                "Anonymous"}
                            </span>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-white/70 text-[13px] font-mono">
                            {trader.source}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`text-[14px] font-semibold ${
                              trader.totalPnl > 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            ${formatNumber(trader.totalPnl)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-white text-[14px] font-semibold">
                            ${formatNumber(trader.totalVolume)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-white text-[14px] font-semibold">
                            {trader.winRate !== undefined
                              ? `${(trader.winRate * 100).toFixed(1)}%`
                              : "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-white text-[14px] font-semibold">
                            {trader.totalTrades}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/traders/${trader.id}`}
                            className="text-white/70 hover:text-white text-[13px] font-mono transition-colors"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-[#4c4c4c]/30">
                {leaderboard.map((trader) => (
                  <Link
                    key={trader.id}
                    href={`/traders/${trader.id}`}
                    className="block p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-[18px] font-semibold">
                          #{trader.currentRank || "-"}
                        </span>
                        {getRankChange(trader.rankChange)}
                      </div>
                      {trader.profileImageUrl ? (
                        <img
                          src={trader.profileImageUrl}
                          alt={
                            trader.displayName || trader.username || "Trader"
                          }
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                          <span className="text-white text-[16px] font-semibold">
                            {(trader.displayName ||
                              trader.username ||
                              "?")[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-white text-[15px] font-semibold">
                          {trader.displayName || trader.username || "Anonymous"}
                        </p>
                        <p className="text-white/50 text-[12px] font-mono">
                          {trader.source}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-white/50 text-[11px] font-mono">
                          PnL
                        </p>
                        <p
                          className={`text-[15px] font-semibold ${
                            trader.totalPnl > 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          ${formatNumber(trader.totalPnl)}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/50 text-[11px] font-mono">
                          Volume
                        </p>
                        <p className="text-white text-[15px] font-semibold">
                          ${formatNumber(trader.totalVolume)}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/50 text-[11px] font-mono">
                          Win Rate
                        </p>
                        <p className="text-white text-[15px] font-semibold">
                          {trader.winRate !== undefined
                            ? `${(trader.winRate * 100).toFixed(1)}%`
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/50 text-[11px] font-mono">
                          Trades
                        </p>
                        <p className="text-white text-[15px] font-semibold">
                          {trader.totalTrades}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.total > pagination.limit && (
                <div className="p-6 border-t border-[#4c4c4c] flex justify-center items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="bg-black border border-[#4c4c4c] hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-mono px-4 py-2 rounded-[8px] transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-white/70 text-[14px] font-mono px-4">
                    Page {currentPage} of{" "}
                    {Math.ceil(pagination.total / pagination.limit)}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={!pagination.hasMore}
                    className="bg-black border border-[#4c4c4c] hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-mono px-4 py-2 rounded-[8px] transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <p className="text-white/70 text-[14px] font-mono">
                No traders found.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
