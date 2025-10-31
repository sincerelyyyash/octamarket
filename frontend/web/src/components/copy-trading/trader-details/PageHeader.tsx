import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  showInsightButton?: boolean;
}

export default function PageHeader({ 
  title, 
  onBack,
  showInsightButton = true 
}: PageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <div className="flex items-center justify-between mb-4 sm:mb-8 gap-4">
      <button 
        onClick={handleBack}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors cursor-pointer"
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-base sm:text-lg">{title}</span>
      </button>
      
      {showInsightButton && (
        <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs sm:text-sm transition-colors flex-shrink-0 cursor-pointer">
          <span className="flex items-center gap-1.5 sm:gap-2">
            <Image src="/icons/insight.svg" alt="insight" width={16} height={16} />
            <span className="hidden sm:inline">Insight</span>
          </span>
        </button>
      )}
    </div>
  );
}

