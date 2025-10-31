import React from "react";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative bg-[#0a0b0d] border-t border-[#4c4c4c]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-12">
          {/* Brand & Logo */}
          <div className="flex flex-col gap-4">
            <Image 
              src="/icons/logo-octamarket.svg" 
              alt="OctaMarket" 
              width={140} 
              height={40}
              className="h-auto"
            />
            <p className="text-white/70 text-[12px] leading-[1.6] font-mono max-w-[300px]">
              The fastest way to bet smarter on Solana. One platform to access, compare and copy trades.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-12">
            <div className="flex flex-col gap-3">
              <h4 className="text-white text-[14px] font-semibold tracking-[-0.28px] mb-1">
                Product
              </h4>
              <ul className="flex flex-col gap-2">
                <li>
                  <a href="#" className="text-white/70 text-[12px] font-mono hover:text-white transition-colors">
                    Markets
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/70 text-[12px] font-mono hover:text-white transition-colors">
                    Copy Trading
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/70 text-[12px] font-mono hover:text-white transition-colors">
                    Rewards Hub
                  </a>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-white text-[14px] font-semibold tracking-[-0.28px] mb-1">
                Company
              </h4>
              <ul className="flex flex-col gap-2">
                <li>
                  <a href="#" className="text-white/70 text-[12px] font-mono hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/70 text-[12px] font-mono hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/70 text-[12px] font-mono hover:text-white transition-colors">
                    Careers
                  </a>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-white text-[14px] font-semibold tracking-[-0.28px] mb-1">
                Legal
              </h4>
              <ul className="flex flex-col gap-2">
                <li>
                  <a href="#" className="text-white/70 text-[12px] font-mono hover:text-white transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/70 text-[12px] font-mono hover:text-white transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="text-white/70 text-[12px] font-mono hover:text-white transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 sm:mt-16 pt-8 border-t border-[#4c4c4c]/30 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-white/50 text-[11px] font-mono">
            © {new Date().getFullYear()} OctaMarket. All rights reserved.
          </p>
          
          {/* Built on Solana */}
          <div className="flex items-center gap-2">
            <Image src="/icons/solana-sol.svg" alt="Solana" width={20} height={20} />
            <p className="text-white/70 text-[11px] font-mono">
              Built on Solana
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
