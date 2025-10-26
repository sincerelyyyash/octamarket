import React from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from "@/components/copy-trading/HeroSection";
import SearchSection from "@/components/copy-trading/SearchSection";
import AllTradersSection from "@/components/copy-trading/AllTradersSection";
import TrendingTradersSection from "@/components/copy-trading/TrendingTradersSection";
import ConservativeTradersSection from "@/components/copy-trading/ConservativeTradersSection";
import RisingStarsSection from "@/components/copy-trading/RisingStarsSection";
import TestimonialsSection from "@/components/copy-trading/TestimonialsSection";
import Image from "next/image";

export default function CopyTradingPage() {
  return (
    <div className="min-h-screen bg-[#090C15] text-white relative">
      <Header />

      <main className="relative overflow-hidden">
        <Image
          src="/images/hero-gradient.svg"
          alt="Background"
          width={1000}
          height={1000}
          className="absolute right-0 top-0"
        />

        <div className="relative z-10">
          <HeroSection />
          <SearchSection />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <AllTradersSection />
            <TrendingTradersSection />
            <ConservativeTradersSection />
            <RisingStarsSection />
            <TestimonialsSection />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
