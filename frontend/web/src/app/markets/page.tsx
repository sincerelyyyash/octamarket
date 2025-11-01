"use client";

import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchMarkets,
  fetchCategories,
  setFilters,
  setSortParams,
} from "../../store/slices/marketsSlice";
import { MarketFilters } from "../../types/market";
import { SortParams } from "../../types/api";
import MarketFiltersComponent from "../../components/markets/MarketFilters";
import SkeletonMarketCardComponent from "../../components/ui/SkeletonCard";
import MarketCardComponent from "../../components/markets/MarketCard";

export default function MarketsPage() {
  const dispatch = useAppDispatch();
  const { markets, categories, filters, sortParams, pagination, loading } =
    useAppSelector((state) => state.markets);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    dispatch(
      fetchMarkets({
        page: currentPage,
        limit: 12,
        filters,
        sortParams,
      })
    );
  }, [dispatch, currentPage, filters, sortParams]);

  const handleFilterChange = (newFilters: MarketFilters) => {
    dispatch(setFilters(newFilters));
    setCurrentPage(1);
  };

  const handleSortChange = (newSortParams: SortParams) => {
    dispatch(setSortParams(newSortParams as SortParams));
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[32px] md:text-[40px] font-semibold tracking-[-0.8px] mb-3">
            Prediction Markets
          </h1>
          <p className="text-white/70 text-[14px] font-mono leading-normal max-w-2xl">
            Browse and trade on aggregated prediction markets from multiple sources.
            Compare prices across platforms and get the best odds automatically.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden bg-white/10 hover:bg-white/20 text-white text-[14px] font-mono px-4 py-2 rounded-[8px] transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={`${sortParams.sortBy}-${sortParams.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split("-");
                handleSortChange({
                  sortBy,
                  sortOrder: sortOrder as "asc" | "desc",
                });
              }}
              className="bg-black border border-[#4c4c4c] rounded-[8px] px-4 py-2 text-white text-[14px] font-mono focus:outline-none focus:border-white/50 transition-colors flex-1 sm:flex-initial"
            >
              <option value="volume-desc">Volume: High to Low</option>
              <option value="volume-asc">Volume: Low to High</option>
              <option value="liquidity-desc">Liquidity: High to Low</option>
              <option value="liquidity-asc">Liquidity: Low to High</option>
              <option value="participantCount-desc">Most Traders</option>
              <option value="endDate-asc">Ending Soon</option>
            </select>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <aside
            className={`${
              showFilters ? "block" : "hidden"
            } lg:block fixed lg:static inset-0 lg:inset-auto z-40 lg:z-auto bg-[#090C15] lg:bg-transparent w-full lg:w-64 flex-shrink-0 overflow-y-auto p-4 lg:p-0`}
          >
            <div className="lg:sticky lg:top-20">
              <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 lg:mb-6">
                  <h2 className="text-white text-[18px] font-semibold">
                    Filters
                  </h2>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="lg:hidden text-white/70 hover:text-white"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <MarketFiltersComponent
                  filters={filters as MarketFilters}
                  categories={categories}
                  onFilterChange={handleFilterChange}
                />
              </div>
            </div>
          </aside>

          {/* Markets Grid */}
          <div className="flex-1">
            {loading && markets.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonMarketCardComponent key={i} />
                ))}
              </div>
            ) : markets.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                  {markets.map((market) => (
                    <MarketCardComponent key={market.id} market={market} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.total > pagination.limit && (
                  <div className="mt-8 flex justify-center items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
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
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!pagination.hasMore}
                    className="bg-black border border-[#4c4c4c] hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-mono px-4 py-2 rounded-[8px] transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-8 text-center">
                <p className="text-white/70 text-[14px] font-mono">
                  No markets found. Try adjusting your filters.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
