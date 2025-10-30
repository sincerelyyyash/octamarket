import React from "react";
import { StatItem } from "@/types/trader";
import Image from "next/image";
interface DataOverviewProps {
  timeRange: string;
  stats: StatItem[];
  currencyUnit: string;
  onTimeRangeChange?: () => void;
}

export default function DataOverview({
  timeRange,
  stats,
  currencyUnit,
  onTimeRangeChange,
}: DataOverviewProps) {
  const getColorClass = (color?: "green" | "red" | "white") => {
    switch (color) {
      case "green":
        return "text-green-400";
      case "red":
        return "text-red-400";
      default:
        return "text-white";
    }
  };

  return (
    <div className="bg-[#101010] border border-[#292D32] rounded-lg sm:rounded-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-regular">Data Overview</h2>
        <div className="flex items-center bg-white/5 border border-white/10 rounded-md w-full sm:w-auto">
          <button
            onClick={onTimeRangeChange}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm hover:bg-white/10 transition-colors"
          >
            {timeRange}
          </button>
          <Image
            src="/icons/arrow-down.svg"
            alt="arrow-down"
            width={14}
            height={14}
            className="mr-2 sm:w-4 sm:h-4"
          />
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 ${
              stat.isDivider ? "border-t border-white/10 pt-3 sm:pt-3" : ""
            }`}
          >
            <span className="text-white/60 text-xs sm:text-sm">{stat.label}</span>
            <span
              className={`${getColorClass(stat.color)} text-base sm:text-lg font-dm-mono`}
            >
              {stat.value}
            </span>
          </div>
        ))}

        <div className="flex items-center justify-between py-3 sm:pt-6 pt-4 border-t border-white/10">
          <span className="text-white/60 text-xs sm:text-sm">
            Currency Unit: {currencyUnit}
          </span>
        </div>
      </div>
    </div>
  );
}
