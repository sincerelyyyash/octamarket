'use client';

import React from 'react';
import Link from 'next/link';
import TraderChart from './TraderChart';
import { Trader } from '../../types/trader';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { followTrader } from '../../store/slices/copyTradingSlice';

interface TraderCardProps {
  trader: Trader;
  onFollow?: () => void;
}

export default function TraderCard({ trader, onFollow }: TraderCardProps) {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { follows } = useAppSelector((state) => state.copyTrading);
  
  const isFollowing = follows.some((f) => f.followingId === trader.id);
  const avgReturn = trader.avgReturn ?? 0;
  const isPositive = avgReturn >= 0;
  
  const formatNumber = (num?: number) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const generateChartData = () => {
    const baseValue = isPositive ? 20 : -15;
    const data = [];
    for (let i = 0; i < 10; i++) {
      const variation = (Math.random() - 0.5) * 10;
      const trend = isPositive ? i * 2 : -i * 1.5;
      data.push(baseValue + variation + trend);
    }
    return data;
  };
  
  const chartData = generateChartData();

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated || !trader.allowCopyTrading) return;

    if (onFollow) {
      onFollow();
    } else {
      // Default follow behavior
      await dispatch(followTrader({
        traderId: trader.id,
        autoCopyTrades: true,
        maxCopyAmount: 1000,
        copyPercentage: 0.1,
      }));
    }
  };
  
  return (
    <Link href={`/traders/${trader.id}`}>
      <div className="bg-black border border-[#4c4c4c] rounded-[12px] p-4 sm:p-6 hover:border-white/50 transition-colors cursor-pointer">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          {trader.profileImageUrl ? (
            <img
              src={trader.profileImageUrl}
              alt={trader.displayName || trader.username || "Trader"}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black border border-[#4c4c4c] rounded-full flex items-center justify-center text-sm sm:text-lg font-bold">
              {((trader.displayName || trader.username || "?").toString().substring(0, 2).toUpperCase())}
            </div>
          )}
          <div className="min-w-0 flex-1 overflow-hidden">
            <h3 className="text-sm sm:text-base font-regular truncate">{((trader.displayName || trader.username || "?").toString().substring(0, 20) + "...")}</h3>
            <p className="text-xs sm:text-sm text-white/60 font-mono truncate">{trader.source}</p>
          </div>
        </div>
        
        {trader.allowCopyTrading && isAuthenticated && (
          <button 
            onClick={handleFollow}
            disabled={isFollowing}
            className={`px-3 sm:px-6 py-2 rounded-[8px] text-xs font-mono font-medium transition-colors flex-shrink-0 cursor-pointer ${
              isFollowing
                ? "border-2 border-white/30 text-white/50 cursor-not-allowed"
                : "bg-white text-black hover:bg-gray-100"
            }`}
          >
            {isFollowing ? "Following" : "Copy"}
          </button>
        )}
      </div>

      <div className="mb-4 sm:mb-6">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className="min-w-0 flex-1">
            <div className={`text-xl sm:text-2xl font-regular font-mono mb-1 ${isPositive ? "text-green-400" : "text-red-400"}`}>
              {isPositive ? '+' : ''}{(avgReturn * 100).toFixed(2)}%
            </div>
            <div className="text-xs text-white/60 font-mono">Avg Return</div>
          </div>
          
          <div className="w-24 sm:w-32 h-8 sm:h-11 relative flex-shrink-0 ml-2">
            <TraderChart 
              data={chartData} 
              isPositive={isPositive}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 sm:pt-6 border-t border-[#4c4c4c]/50">
        <div className="min-w-0">
          <div className={`text-sm sm:text-base font-regular font-mono mb-1 truncate ${trader.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            ${formatNumber(Math.abs(trader.totalPnl))}
          </div>
          <div className="text-xs text-white/60 font-mono">Total PnL</div>
        </div>
        
        <div className="text-center min-w-0">
          <div className="text-sm sm:text-base font-regular font-mono mb-1">{trader.totalTrades}</div>
          <div className="text-xs text-white/60 font-mono">Trades</div>
        </div>
        
        <div className="text-right min-w-0">
          <div className="text-sm sm:text-base font-regular font-mono mb-1">
            {trader.winRate ? `${(trader.winRate * 100).toFixed(0)}%` : '-'}
          </div>
          <div className="text-xs text-white/60 font-mono">Win Rate</div>
        </div>
      </div>
    </div>
    </Link>
  );
}

