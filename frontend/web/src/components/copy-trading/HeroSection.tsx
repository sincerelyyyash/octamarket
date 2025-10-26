import React from 'react';
import Image from 'next/image';

export default function HeroSection() {
  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 lg:px-16 xl:px-24 2xl:px-[110px] pt-12 sm:pt-16 md:pt-20 pb-8 sm:pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-20">
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-4xl md:text-5xl font-semibold mb-2 leading-tight">
            Copy Global Elite Traders
          </h1>
          
          <p className="text-lg sm:text-xl md:text-2xl font-normal text-white/70 mb-8 sm:mb-10 md:mb-12">
            Established 11,525,185 Copy Relationship
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
            <button className="w-full sm:w-auto px-6 py-2 md:py-3 bg-[#4B2EFF] hover:bg-[#1E00D5] rounded-full font-medium transition-colors cursor-pointer">
              Become a Trader
            </button>
            
            <button className="w-full sm:w-auto px-6 py-3 bg-white/12 rounded-full font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <Image src="/icons/guide.svg" alt="Guide" width={24} height={24} />
              Copy Trading Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

