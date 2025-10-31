'use client';

import React, { useState, useEffect } from 'react';
import TraderCard from './TraderCard';
import Image from 'next/image';
import { useAppDispatch } from '../../store/hooks';
import { fetchTopTraders } from '../../store/slices/tradersSlice';
import LoadingSpinner from '../ui/LoadingSpinner';

export default function AllTradersSection() {
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [traders, setTraders] = useState<any[]>([]);
  const dispatch = useAppDispatch();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    dispatch(fetchTopTraders({ limit: 12, timeframe: '30d' }))
      .unwrap()
      .then((res) => {
        if (isMounted) setTraders(res.traders || []);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    console.log(activeTab);
  };

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

      <div className="flex flex-wrap items-center gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center gap-2 cursor-pointer bg-black border border-[#4c4c4c] p-2 rounded-[8px] mr-4 flex-shrink-0">
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
          className={`px-3 py-2 rounded-[8px] text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors font-mono ${
            activeTab === 'all'
              ? 'bg-white text-black'
              : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
          }`}
        >
          <span className="hidden sm:inline">All</span>
          <span className="sm:hidden">All</span>
        </button>
        
        <button 
          onClick={() => handleTabClick('comprehensive-rankings')} 
          className={`px-3 py-2 rounded-[8px] text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors font-mono ${
            activeTab === 'comprehensive-rankings'
              ? 'bg-white text-black'
              : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
          }`}
        >
          <span className="hidden sm:inline">Comprehensive Rankings</span>
          <span className="sm:hidden">Rankings</span>
        </button>
        <button 
          onClick={() => handleTabClick('account-level')} 
          className={`px-3 py-2 rounded-[8px] text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors font-mono ${
            activeTab === 'account-level'
              ? 'bg-white text-black'
              : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
          }`}
        >
          <span className="hidden sm:inline">Account Level</span>
          <span className="sm:hidden">Level</span>
        </button>
        <button 
          onClick={() => handleTabClick('account-assets')} 
          className={`px-3 py-2 rounded-[8px] text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors font-mono ${
            activeTab === 'account-assets'
              ? 'bg-white text-black'
              : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
          }`}
        >
          <span className="hidden sm:inline">Account Assets</span>
          <span className="sm:hidden">Assets</span>
        </button>
        <button 
          onClick={() => handleTabClick('copiers')} 
          className={`px-3 py-2 rounded-[8px] text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors font-mono ${
            activeTab === 'copiers'
              ? 'bg-white text-black'
              : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
          }`}
        >
          Copiers
        </button>
        <button 
          onClick={() => handleTabClick('30d-roi')} 
          className={`px-3 py-2 rounded-[8px] text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors font-mono ${
            activeTab === '30d-roi'
              ? 'bg-white text-black'
              : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
          }`}
        >
          30D ROI
        </button>
        <button 
          onClick={() => handleTabClick('cumulative-pnl')} 
          className={`px-3 py-2 rounded-[8px] text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors font-mono ${
            activeTab === 'cumulative-pnl'
              ? 'bg-white text-black'
              : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
          }`}
        >
          <span className="hidden sm:inline">Cumulative PnL</span>
          <span className="sm:hidden">PnL</span>
        </button>
        <button 
          onClick={() => handleTabClick('followers')} 
          className={`px-3 py-2 rounded-[10px] text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors font-mono ${
            activeTab === 'followers'
              ? 'bg-white text-black'
              : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
          }`}
        >
          Followers
        </button>
        <button 
          onClick={() => handleTabClick('risk')} 
          className={`px-3 py-2 rounded-[10px] text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors font-mono ${
            activeTab === 'risk'
              ? 'bg-white text-black'
              : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
          }`}
        >
          Risk
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
      ) : traders.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {traders.map((trader) => (
            <TraderCard key={trader.id} trader={trader} />
          ))}
        </div>
      ) : (
        <p className="text-white/50 text-sm font-mono text-center py-12">No traders available</p>
      )}
    </section>
  );
}

