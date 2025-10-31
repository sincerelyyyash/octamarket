import React from "react";
import Image from "next/image";

export default function SearchSection() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
   

      <div className="flex flex-col gap-3 sm:gap-4">
        {/* Search and buttons row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 flex items-center gap-2 sm:gap-4">
            <div className="flex-1 bg-black border border-[#4c4c4c] rounded-[8px] px-3 sm:px-4 h-10 sm:h-11 flex items-center gap-2">
              <Image
                src="/icons/search.svg"
                alt="search"
                width={16}
                height={16}
              />
              <input
                type="text"
                placeholder="search"
                className="flex-1 bg-transparent outline-none text-sm font-mono text-white"
              />
            </div>
            <button className="px-4 sm:px-6 h-10 bg-white hover:bg-gray-100 rounded-[8px] text-sm font-mono font-medium text-black transition-colors cursor-pointer whitespace-nowrap">
              Search
            </button>
          </div>
        </div>

        {/* Action buttons row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button className="bg-black border border-[#4c4c4c] rounded-[8px] px-3 sm:px-4 h-10 sm:h-11 flex items-center justify-center gap-2 hover:border-white/50 transition-colors cursor-pointer">
            <Image
              src="/icons/trade.svg"
              alt="my-trades"
              width={16}
              height={16}
            />
            <span className="text-sm">My Trades</span>
          </button>

          <button className="bg-black border border-[#4c4c4c] rounded-[8px] px-3 sm:px-4 h-10 sm:h-11 text-sm hover:border-white/50 transition-colors cursor-pointer text-center">
            My Subscriptions
          </button>
        </div>
      </div>
    </div>
  );
}
