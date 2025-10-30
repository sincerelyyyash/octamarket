import React from 'react';

interface TestimonialCardProps {
  name: string;
  content: string;
}

export default function TestimonialCard({ name, content }: TestimonialCardProps) {
  return (
    <div className="bg-[#101010] backdrop-blur-sm border border-[#292D32] rounded-lg sm:rounded-xl p-4 sm:p-6 hover:border-white/20 transition-all duration-300 h-[200px] sm:h-[240px]">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#101010] border border-[#292D32] rounded-full flex items-center justify-center text-base sm:text-lg font-bold">
            {name.charAt(0)}
          </div>
          <div className="text-sm sm:text-base font-semibold">{name}</div>
        </div>
      </div>
      <div className="mb-4 sm:mb-6">
        <p className="text-xs sm:text-sm text-white/80 leading-relaxed line-clamp-4">
          {content}
        </p>
      </div>
    </div>
  );
}

