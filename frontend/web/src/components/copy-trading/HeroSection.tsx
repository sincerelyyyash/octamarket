import React from 'react';
import Image from 'next/image';

export default function HeroSection() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 md:pt-20 pb-8 sm:pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-20">
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-4xl md:text-5xl font-semibold mb-2 leading-tight">
            Copy Global Elite Traders
          </h1>
          
          <p className="text-lg sm:text-xl md:text-2xl font-normal text-white/70 mb-4">
            Established 11,525,185 Copy Relationship
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
            <button className="w-full sm:w-auto px-3 py-2 bg-white hover:bg-gray-100 rounded-[6px] font-mono font-medium text-black transition-colors cursor-pointer text-[14px]">
              Become a Trader
            </button>

            <button className="w-full sm:w-auto px-3 py-2 border-2 border-white/30 hover:bg-white/10 rounded-[6px] font-mono font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer text-[14px]">
              <Image src="/icons/guide.svg" alt="Guide" width={16} height={16} />
              Copy Trading Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

