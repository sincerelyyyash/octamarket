'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '../store/hooks';
import WalletButton from './wallet/WalletButton';
import { useWalletSync } from '../hooks/useWallet';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  
  // Sync wallet state with Redux
  useWalletSync();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navItems = [
    { label: 'Markets', href: '/markets' },
    { label: 'Leaderboard', href: '/leaderboard' },
    { label: 'Copy Trading', href: '/copy-trading' },
    { label: 'Statistics', href: '/stats' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="border-b border-white/10 bg-black sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/">
          <Image src="/icons/logo-octamarket.svg" alt="Logo" width={160} height={56} />
        </Link>

        <div className="hidden lg:flex items-center gap-6">
          
          <ul className="flex items-center gap-6">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`px-3 py-2 transition-colors cursor-pointer font-mono ${
                    isActive(item.href)
                      ? 'text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>


        <div className="flex items-center gap-2 sm:gap-3">
          <WalletButton />

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
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-3 py-2 transition-colors cursor-pointer font-mono ${
                      isActive(item.href)
                        ? 'text-white'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

          </div>
        </div>
      )}
    </header>
  );
}