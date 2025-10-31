"use client";

import React, { useEffect, useState } from "react";
import TraderCard from "./TraderCard";
import Image from "next/image";
import { useAppDispatch } from "../../store/hooks";
import { fetchTopTraders } from "../../store/slices/tradersSlice";
import LoadingSpinner from '../ui/LoadingSpinner';
import Link from "next/link";

export default function TrendingTradersSection() {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [traders, setTraders] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    dispatch(fetchTopTraders({ limit: 3, timeframe: "7d" }))
      .unwrap()
      .then((res) => {
        if (isMounted) setTraders(res.traders || []);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  return (
    <section className="mb-12 sm:mb-16">
      {/* Title */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tightest mb-2">Trending Traders</h2>
            <p className="text-white/60 text-sm">Trending traders in the last 7 days</p>
          </div>
          
          {/* See All Link */}
          <Link href="/leaderboard" className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors cursor-pointer self-start sm:self-auto">
            <span>See all</span>
            <Image
              src="/icons/arrow-right.svg"
              alt="Arrow Right"
              width={16}
              height={16}
            />
          </Link>
        </div>
      </div>

      {/* Traders Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
      ) : traders.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {traders.slice(0, 3).map((trader) => (
            <TraderCard key={trader.id} trader={trader} />
          ))}
        </div>
      ) : (
        <p className="text-white/50 text-sm font-mono text-center py-12">No traders available</p>
      )}
    </section>
  );
}

