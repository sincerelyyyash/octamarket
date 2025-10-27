'use client';

import React, { useState } from 'react';
import TraderCard from './TraderCard';
import Image from 'next/image';
import { useWalletLeaderboard } from '@/lib/api';

export default function AllTradersSection() {
  const [activeTab, setActiveTab] = useState('all');
  const { data: leaderboard, isLoading, error } = useWalletLeaderboard({ limit: 50 });

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
  };

  // Transform API data to TraderCard format
  const traders = leaderboard?.map((wallet: any) => ({
    name: wallet.nickname || wallet.wallet_address.substring(0, 10) + '...',
    username: wallet.wallet_address.substring(0, 8),
    roi: `${wallet.pnl_30d >= 0 ? '+' : ''}${wallet.pnl_30d.toFixed(2)}%`,
    cumulativePnL: `${wallet.pnl_all_time >= 0 ? '+' : ''}${wallet.pnl_all_time.toLocaleString()}`,
    copiers: wallet.total_trades.toString(),
    winRatio: `${(wallet.win_rate * 100).toFixed(2)}%`,
  })) || [];

  return (
    <section className="mb-8 sm:mb-12 lg:mb-16 px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tightest">All Traders</h2>
        <button className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors self-start sm:self-auto cursor-pointer">
          <span>See all</span>
          <Image
            src="/icons/arrow-right.svg"
            alt="Arrow Right"
            width={16}
            height={16}
          />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 mb-6 sm:mb-8 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center gap-2 cursor-pointer bg-[#101010] border border-[#292D32] p-2 rounded-[12px] mr-4 flex-shrink-0">
        <Image
          src="/icons/filter.svg"
          alt="Filter"
          width={20}
          height={20}
          className="sm:w-6 sm:h-6"
        />
        </div>
          <button 
          onClick={() => handleTabClick('all')} 
          className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
            activeTab === 'all'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/5 bg-[#101010] border border-[#292D32] p-2 rounded-[12px]'
          }`}
        >
          <span className="hidden sm:inline">All</span>
          <span className="sm:hidden">All</span>
        </button>
        
        <button 
          onClick={() => handleTabClick('comprehensive-rankings')} 
          className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
            activeTab === 'comprehensive-rankings'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/5 bg-[#101010] border border-[#292D32] p-2 rounded-[12px]'
          }`}
        >
          <span className="hidden sm:inline">Comprehensive Rankings</span>
          <span className="sm:hidden">Rankings</span>
        </button>
        <button 
          onClick={() => handleTabClick('account-level')} 
          className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
            activeTab === 'account-level'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/5 bg-[#101010] border border-[#292D32] p-2 rounded-[12px]'
          }`}
        >
          <span className="hidden sm:inline">Account Level</span>
          <span className="sm:hidden">Level</span>
        </button>
        <button 
          onClick={() => handleTabClick('account-assets')} 
          className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
            activeTab === 'account-assets'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/5 bg-[#101010] border border-[#292D32] p-2 rounded-[12px]'
          }`}
        >
          <span className="hidden sm:inline">Account Assets</span>
          <span className="sm:hidden">Assets</span>
        </button>
        <button 
          onClick={() => handleTabClick('copiers')} 
          className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
            activeTab === 'copiers'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/5 bg-[#101010] border border-[#292D32] p-2 rounded-[12px]'
          }`}
        >
          Copiers
        </button>
        <button 
          onClick={() => handleTabClick('30d-roi')} 
          className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
            activeTab === '30d-roi'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/5 bg-[#101010] border border-[#292D32] p-2 rounded-[12px]'
          }`}
        >
          30D ROI
        </button>
        <button 
          onClick={() => handleTabClick('cumulative-pnl')} 
          className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
            activeTab === 'cumulative-pnl'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/5 bg-[#101010] border border-[#292D32] p-2 rounded-[12px]'
          }`}
        >
          <span className="hidden sm:inline">Cumulative PnL</span>
          <span className="sm:hidden">PnL</span>
        </button>
        <button 
          onClick={() => handleTabClick('followers')} 
          className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
            activeTab === 'followers'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/5 bg-[#101010] border border-[#292D32] p-2 rounded-[12px]'
          }`}
        >
          Followers
        </button>
        <button 
          onClick={() => handleTabClick('risk')} 
          className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
            activeTab === 'risk'
              ? 'bg-white/20 text-white'
              : 'text-white/60 hover:bg-white/5 bg-[#101010] border border-[#292D32] p-2 rounded-[12px]'
          }`}
        >
          Risk
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-[#101010] border border-[#292D32] rounded-lg h-64"></div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
          <p className="text-red-500 font-semibold mb-2">Failed to load traders</p>
          <p className="text-gray-400 text-sm">Please try again later</p>
        </div>
      )}

      {!isLoading && !error && traders.length === 0 && (
        <div className="bg-[#101010] border border-[#292D32] rounded-lg p-12 text-center">
          <p className="text-white/60">No traders available at the moment</p>
        </div>
      )}

      {!isLoading && !error && traders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {traders.map((trader: any, index: number) => (
            <TraderCard key={index} {...trader} />
          ))}
        </div>
      )}
    </section>
  );
}

