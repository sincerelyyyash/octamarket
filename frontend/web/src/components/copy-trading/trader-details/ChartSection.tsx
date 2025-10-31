'use client';

import React from 'react';
import TraderDetailsChart from '../TraderDetailsChart';
import { ChartMetric } from '@/types/trader';

interface ChartSectionProps {
  activeMetric: ChartMetric;
  onMetricChange: (metric: ChartMetric) => void;
  currentValue: string;
  currentDate: string;
  timeRange: string;
  onTimeRangeChange?: () => void;
}

export default function ChartSection({
  activeMetric,
  onMetricChange,
  currentValue,
  currentDate,
  timeRange,
  onTimeRangeChange,
}: ChartSectionProps) {
  const metrics: ChartMetric[] = ['ROI', 'Cumulative PnL', 'Account Assets'];

  return (
    <div className="bg-[#101010] border border-[#292D32] rounded-lg sm:rounded-xl p-4 sm:p-6">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {metrics.map((metric) => (
            <button
              key={metric}
              onClick={() => onMetricChange(metric)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm transition-colors ${
                activeMetric === metric
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {metric}
            </button>
          ))}
        </div>
        
        <button className="p-1.5 sm:p-2 hover:bg-white/5 rounded-md transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="1" fill="currentColor"/>
            <circle cx="10" cy="5" r="1" fill="currentColor"/>
            <circle cx="10" cy="15" r="1" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Current Value */}
      <div className="mb-4 sm:mb-6">
        <div className="text-xs text-white/60 mb-1">{currentDate}</div>
        <div className="text-2xl sm:text-3xl font-dm-mono text-green-400 break-words">{currentValue}</div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="text-xs sm:text-sm text-white/60">{timeRange}</div>
        <button 
          onClick={onTimeRangeChange}
          className="text-xs sm:text-sm text-white/60 hover:text-white transition-colors"
        >
          ▼
        </button>
      </div>

      {/* Chart */}
      <div className="h-[250px] sm:h-[350px] lg:h-[400px]">
        <TraderDetailsChart metric={activeMetric} />
      </div>
    </div>
  );
}

