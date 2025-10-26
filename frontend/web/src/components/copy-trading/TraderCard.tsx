import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import TraderChart from './TraderChart';

interface TraderCardProps {
  name: string;
  username: string;
  roi: string;
  cumulativePnL: string;
  copiers: string;
  winRatio: string;
  avatarUrl?: string;
  traderId?: string;
}

export default function TraderCard({ 
  name, 
  username, 
  roi, 
  cumulativePnL, 
  copiers, 
  winRatio,
  avatarUrl,
  traderId = 'harkirat-singh' 
}: TraderCardProps) {
  const isPositive = roi.startsWith('+');
  
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
  
  return (
    <Link href={`/copy-trading/${traderId}`}>
      <div className="bg-[#101010] backdrop-blur-sm border border-[#292D32] rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-white/20 transition-all duration-300 cursor-pointer">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#101010] border border-[#292D32] rounded-full flex items-center justify-center text-sm sm:text-lg font-bold">
            {name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-regular truncate">{name}</h3>
            <p className="text-xs sm:text-sm text-white/60 truncate">{username}</p>
          </div>
        </div>
        
        <button className="px-3 sm:px-6 py-1.5 sm:py-2 bg-[#1E00D5] hover:bg-[#1E00D5]/80 rounded-full text-xs font-medium transition-colors flex-shrink-0 cursor-pointer">
          Copy
        </button>
      </div>

      <div className="mb-4 sm:mb-6">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className="min-w-0 flex-1">
            <div className={`text-xl sm:text-2xl font-regular font-dm-mono mb-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {roi}
            </div>
            <div className="text-xs text-white/60">30D ROI</div>
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
      <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 sm:pt-6 border-t border-white/10">
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-regular font-dm-mono mb-1 truncate">{cumulativePnL}</div>
          <div className="text-xs text-white/60">Cumulative PnL</div>
        </div>
        
        <div className="text-center min-w-0">
          <div className="text-sm sm:text-base font-regular font-dm-mono mb-1">{copiers}</div>
          <div className="text-xs text-white/60">Copiers</div>
        </div>
        
        <div className="text-right min-w-0">
          <div className="text-sm sm:text-base font-regular font-dm-mono mb-1">{winRatio}</div>
          <div className="text-xs text-white/60">Win Ratio</div>
        </div>
      </div>
    </div>
    </Link>
  );
}

