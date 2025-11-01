'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export default function WalletButton() {
  const { publicKey, disconnect, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleConnect = () => {
    setVisible(true);
  };

  const handleDisconnect = async () => {
    await disconnect();
    setShowDropdown(false);
  };

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!connected && !connecting) {
    return (
      <button
        onClick={handleConnect}
        className="px-4 sm:px-6 h-8 sm:h-10 bg-white hover:bg-gray-100 rounded-[8px] text-xs sm:text-sm font-medium font-mono transition-colors cursor-pointer"
      >
        <span className="text-black">Connect Wallet</span>
      </button>
    );
  }

  if (connecting) {
    return (
      <button
        disabled
        className="px-4 sm:px-6 h-8 sm:h-10 bg-white/50 rounded-[8px] text-xs sm:text-sm font-medium font-mono cursor-not-allowed"
      >
        <span className="text-black">Connecting...</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="px-4 sm:px-6 h-8 sm:h-10 bg-white hover:bg-gray-100 rounded-[8px] text-xs sm:text-sm font-medium font-mono transition-colors cursor-pointer flex items-center gap-2"
      >
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-black">{publicKey ? truncateAddress(publicKey.toBase58()) : 'Connected'}</span>
      </button>

      {showDropdown && publicKey && (
        <div className="absolute right-0 mt-2 w-64 bg-black border border-[#4c4c4c] rounded-[8px] shadow-lg z-50">
          <div className="p-4">
            <p className="text-white/50 text-[11px] font-mono mb-2">Wallet Address</p>
            <div className="flex items-center gap-2 mb-4">
              <p className="text-white text-[12px] font-mono flex-1 truncate">
                {publicKey.toBase58()}
              </p>
              <button
                onClick={copyAddress}
                className="text-white/70 hover:text-white transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={handleDisconnect}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[13px] font-medium font-mono px-4 py-2 rounded-[6px] transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

