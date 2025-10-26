'use client';

import React, { useState } from 'react';
import TraderCard from './TraderCard';
import Image from 'next/image';

export default function AllTradersSection() {
  const [activeTab, setActiveTab] = useState('all');

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    console.log(activeTab);
  };

  const traders = [
    {
      name: 'Harkirat Singh',
      username: '100xSchool',
      roi: '+20.95%',
      cumulativePnL: '+52,944.59',
      copiers: '317',
      winRatio: '76.00%',
    },
    {
      name: 'Alex Chen',
      username: 'CryptoTrader',
      roi: '+15.32%',
      cumulativePnL: '+28,156.23',
      copiers: '189',
      winRatio: '68.50%',
    },
    {
      name: 'Sarah Johnson',
      username: 'DeFiQueen',
      roi: '-8.45%',
      cumulativePnL: '-12,345.67',
      copiers: '95',
      winRatio: '42.30%',
    },
  ];

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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {traders.map((trader, index) => (
          <TraderCard key={index} {...trader} />
        ))}
      </div>
    </section>
  );
}

