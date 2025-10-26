'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="border-b border-white/10 bg-black backdrop-blur-sm sticky top-0 z-50">
      <nav className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        {/* Logo - always visible */}
        <div className="flex items-center cursor-pointer">
          <div className="text-lg sm:text-xl font-semibold flex items-center">
            <Image src="/images/logo.png" alt="Logo" width={48} height={48} className="sm:w-16 sm:h-16" />
            <span>Octamarket</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-6">
          
          <ul className="flex items-center gap-6">
            <li className="px-3 py-2 text-white/70 hover:text-white transition-colors cursor-pointer">
              Markets
            </li>
            <li className="px-3 py-2 text-white/70 hover:text-white transition-colors cursor-pointer">
              Spot
            </li>
            <li className="px-3 py-2 text-white hover:text-white transition-colors cursor-pointer">
              Copy Trading
            </li>
            <li className="px-3 py-2 text-white/70 hover:text-white transition-colors cursor-pointer">
              Wealth
            </li>
            <li className="px-3 py-2 text-white/70 hover:text-white transition-colors cursor-pointer">
              Rewards Hub
            </li>
          </ul>
        </div>


        {/* Mobile Menu Button and Signup */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button className="px-3 sm:px-6 h-8 sm:h-10 bg-[#1E00D5] hover:bg-[#1E00D5]/80 rounded-full text-xs sm:text-sm font-regular transition-colors cursor-pointer">
            <span className="hidden sm:inline">Sign Up</span>
            <span className="sm:hidden">Signup</span>
          </button>

          <button 
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 text-white/70 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-sm border-b border-white/10">
          <div className="px-4 py-6 space-y-4">
            <ul className="space-y-3">
              <li className="px-3 py-2 text-white/70 hover:text-white transition-colors cursor-pointer">
                Markets
              </li>
              <li className="px-3 py-2 text-white/70 hover:text-white transition-colors cursor-pointer">
                Spot
              </li>
              <li className="px-3 py-2 text-white hover:text-white transition-colors cursor-pointer">
                Copy Trading
              </li>
              <li className="px-3 py-2 text-white/70 hover:text-white transition-colors cursor-pointer">
                Wealth
              </li>
              <li className="px-3 py-2 text-white/70 hover:text-white transition-colors cursor-pointer">
                Rewards Hub
              </li>
            </ul>
            
           
          </div>
        </div>
      )}
    </header>
  );
}