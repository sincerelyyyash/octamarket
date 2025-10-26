import React from "react";
import Image from "next/image";

interface ProfileSectionProps {
  name: string;
  bio: string;
  platform: string;
  copiers: number;
  daysJoined: number;
  onCopy?: () => void;
}

export default function ProfileSection({
  name,
  bio,
  platform,
  copiers,
  daysJoined,
  onCopy,
}: ProfileSectionProps) {
  return (
    <div className="p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex flex-col lg:flex-row items-start justify-between gap-4 sm:gap-6">
        <div className="flex items-start gap-3 sm:gap-4 flex-1 w-full">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-black rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold flex-shrink-0">
            {name.charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-regular mb-2">{name}</h1>
            <p className="text-white/60 text-xs sm:text-sm mb-3 leading-relaxed max-w-2xl">
              {bio}
            </p>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 sm:mt-4">
              <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white/5 border border-white/10 rounded-lg flex items-center gap-1.5 sm:gap-2">
                <Image src="/images/polymarket.webp" alt="platform" width={14} height={14} className="sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">{platform}</span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-lg sm:text-2xl font-dm-mono">{copiers}</span>
                <span className="text-white/60 text-xs sm:text-sm">Copiers</span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-lg sm:text-2xl font-dm-mono">{daysJoined}</span>
                <span className="text-white/60 text-xs sm:text-sm">Days Joined</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onCopy}
          className="w-full lg:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-[#1E00D5] hover:bg-[#1E00D5]/80 rounded-full text-sm sm:text-base font-medium transition-colors flex-shrink-0 cursor-pointer"
        >
          Copy
        </button>
      </div>
    </div>
  );
}
