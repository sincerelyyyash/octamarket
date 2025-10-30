import React from "react";

import HeroSection from "../../components/copy-trading/HeroSection";
import TrendingTradersSection from "../../components/copy-trading/TrendingTradersSection";
import ConservativeTradersSection from "../../components/copy-trading/ConservativeTradersSection";
import RisingStarsSection from "../../components/copy-trading/RisingStarsSection";
import TestimonialsSection from "../../components/copy-trading/TestimonialsSection";

import SearchSection from "../../components/copy-trading/SearchSection";
import AllTradersSection from "../../components/copy-trading/AllTradersSection";

export default function CopyTradingPage() {
  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      <main>
        <HeroSection />
        <SearchSection />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <AllTradersSection />
          <TrendingTradersSection />
          <ConservativeTradersSection />
          <RisingStarsSection />
          <TestimonialsSection />
        </div>
      </main>
    </div>
  );
}
