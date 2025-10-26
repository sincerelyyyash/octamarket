import React from "react";
import Image from "next/image";

export default function SearchSection() {
  return (
    <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 lg:px-16 xl:px-24 2xl:px-[110px] py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-6 sm:mb-8">
        <button className="px-3 py-2 bg-white/10 rounded-lg text-sm font-medium">
          Polymarket
        </button>
        <button className="px-3 py-2 text-white/60 hover:bg-white/5 rounded-lg text-sm font-medium transition-colors">
          Kalshi
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        {/* Search and buttons row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 flex items-center gap-2 sm:gap-4">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 sm:px-4 h-10 sm:h-11 flex items-center gap-2">
              <Image
                src="/icons/search.svg"
                alt="search"
                width={16}
                height={16}
              />
              <input
                type="text"
                placeholder="search"
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
            <button className="px-4 sm:px-6 h-10 bg-[#1E00D5] hover:bg-[#1E00D5]/80 rounded-full text-sm font-regular transition-colors cursor-pointer whitespace-nowrap">
              Search
            </button>
          </div>
        </div>

        {/* Action buttons row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button className="bg-white/5 border border-white/10 rounded-lg px-3 sm:px-4 h-10 sm:h-11 flex items-center justify-center gap-2 hover:bg-white/10 transition-colors cursor-pointer">
            <Image
              src="/icons/trade.svg"
              alt="my-trades"
              width={16}
              height={16}
            />
            <span className="text-sm">My Trades</span>
          </button>

          <button className="bg-white/5 border border-white/10 rounded-lg px-3 sm:px-4 h-10 sm:h-11 text-sm hover:bg-white/10 transition-colors cursor-pointer text-center">
            My Subscriptions
          </button>
        </div>
      </div>
    </div>
  );
}
