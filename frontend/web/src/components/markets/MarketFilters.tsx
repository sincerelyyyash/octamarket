'use client';

import React from 'react';
import { MarketStatus, MarketSource } from '../../types/market';

interface MarketFiltersProps {
  filters: {
    status?: MarketStatus;
    category?: string;
    source?: MarketSource;
    search?: string;
  };
  categories: string[];
  onFilterChange: (filters: any) => void;
}

export default function MarketFilters({ filters, categories, onFilterChange }: MarketFiltersProps) {
  const handleStatusChange = (status: MarketStatus | undefined) => {
    onFilterChange({ ...filters, status });
  };

  const handleSourceChange = (source: MarketSource | undefined) => {
    onFilterChange({ ...filters, source });
  };

  const handleCategoryChange = (category: string | undefined) => {
    onFilterChange({ ...filters, category });
  };

  const handleSearchChange = (search: string) => {
    onFilterChange({ ...filters, search });
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <label className="block text-white text-[14px] font-medium mb-2">Search</label>
        <input
          type="text"
          value={filters.search || ""}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search markets..."
          className="w-full bg-black border border-[#4c4c4c] rounded-[8px] px-4 py-2 text-white text-[14px] font-mono focus:outline-none focus:border-white/50 transition-colors"
        />
      </div>

      {/* Status Filter */}
      <div>
        <label className="block text-white text-[14px] font-medium mb-3">Status</label>
        <div className="space-y-2">
          {[undefined, MarketStatus.ACTIVE, MarketStatus.RESOLVED, MarketStatus.CANCELLED].map((status) => (
            <label key={status || "all"} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="status"
                checked={filters.status === status}
                onChange={() => handleStatusChange(status)}
                className="w-4 h-4 accent-white"
              />
              <span className="text-white/70 text-[13px] font-mono group-hover:text-white transition-colors">
                {status || "All"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Source Filter */}
      <div>
        <label className="block text-white text-[14px] font-medium mb-3">Source</label>
        <div className="space-y-2">
          {[undefined, MarketSource.POLYMARKET, MarketSource.KALSHI, MarketSource.AUGUR].map(
            (source) => (
              <label key={source || "all"} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="source"
                  checked={filters.source === source}
                  onChange={() => handleSourceChange(source)}
                  className="w-4 h-4 accent-white"
                />
                <span className="text-white/70 text-[13px] font-mono group-hover:text-white transition-colors">
                  {source || "All"}
                </span>
              </label>
            )
          )}
        </div>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div>
          <label className="block text-white text-[14px] font-medium mb-3">Category</label>
          <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-hide">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="category"
                checked={!filters.category}
                onChange={() => handleCategoryChange(undefined)}
                className="w-4 h-4 accent-white"
              />
              <span className="text-white/70 text-[13px] font-mono group-hover:text-white transition-colors">
                All
              </span>
            </label>
            {categories.map((category) => (
              <label key={category} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="category"
                  checked={filters.category === category}
                  onChange={() => handleCategoryChange(category)}
                  className="w-4 h-4 accent-white"
                />
                <span className="text-white/70 text-[13px] font-mono group-hover:text-white transition-colors">
                  {category}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Clear Filters */}
      <button
        onClick={() => onFilterChange({})}
        className="w-full bg-white/10 hover:bg-white/20 text-white text-[14px] font-mono px-4 py-2 rounded-[8px] transition-colors"
      >
        Clear Filters
      </button>
    </div>
  );
}

