import React from 'react';
import TraderCard from './TraderCard';
import Image from 'next/image';

export default function ConservativeTradersSection() {
  const traders = [
    {
      name: 'Harkirat Singh',
      username: '100xSchool',
      roi: '+20.95%',
      cumulativePnL: '+52,944.59',
      copiers: '317',
      winRatio: '76.00%',
    },
    {
      name: 'Harkirat Singh',
      username: '100xSchool',
      roi: '+20.95%',
      cumulativePnL: '+52,944.59',
      copiers: '317',
      winRatio: '76.00%',
    },
  ];

  return (
    <section className="mb-12 sm:mb-16">
      {/* Title */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tightest mb-2">Conservative Traders</h2>
            <p className="text-white/60 text-sm">Low risk, long-term growth</p>
          </div>
          
          {/* See All Link */}
          <button className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors cursor-pointer self-start sm:self-auto">
            <span>See all</span>
            <Image
              src="/icons/arrow-right.svg"
              alt="Arrow Right"
              width={16}
              height={16}
            />
          </button>
        </div>
      </div>

      {/* Traders Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {traders.map((trader, index) => (
          <TraderCard key={index} {...trader} />
        ))}
      </div>
    </section>
  );
}

