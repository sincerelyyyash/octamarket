import React from 'react';

interface TabNavigationProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="border-b border-white/10 mb-4 sm:mb-6 overflow-x-auto scrollbar-hide">
      <div className="flex gap-4 sm:gap-6 lg:gap-8 min-w-max">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`pb-3 sm:pb-4 text-xs sm:text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === tab 
                ? 'text-white' 
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

