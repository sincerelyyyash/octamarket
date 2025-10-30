'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTraderData } from '../../../hooks/useTraderData';
import { ChartMetric } from '../../../types/trader';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { getCurrentChartValue, prepareStatsData } from '../../../utils/traderStats';
import { ChartSection, DataOverview, PageHeader, ProfileSection, TabNavigation } from '../../../components/copy-trading/trader-details';
import { TRADER_TABS } from '../../../constants/trader';

export default function TraderDetailsPage() {
  const params = useParams();
  const traderId = params.traderId as string;
  
  const { data: traderData, loading, error } = useTraderData(traderId);
  const [activeTab, setActiveTab] = useState('Trading Data');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('ROI');
  const [timeRange, setTimeRange] = useState('Last 30D');

  const handleCopy = () => {
    // Handle copy trading logic
    console.log('Copy trading initiated for trader:', traderId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090C15] text-white">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-white/60">Loading trader data...</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !traderData) {
    return (
      <div className="min-h-screen bg-[#090C15] text-white">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-red-400">
              {error ? error.message : 'Trader not found'}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const statsData = prepareStatsData(traderData.stats);
  const currentChartValue = getCurrentChartValue(chartMetric, traderData.stats);

  return (
    <div className="min-h-screen bg-[#090C15] text-white">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Trader Details" />

        <ProfileSection
          name={traderData.name}
          bio={traderData.bio}
          platform={traderData.platform}
          copiers={traderData.copiers}
          daysJoined={traderData.daysJoined}
          onCopy={handleCopy}
        />

        <TabNavigation
          tabs={TRADER_TABS as unknown as string[]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === 'Trading Data' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            <div className="lg:col-span-5">
              <DataOverview
                timeRange={timeRange}
                stats={statsData}
                currencyUnit={traderData.stats.currencyUnit}
                onTimeRangeChange={() => {
                  console.log('Time range change requested');
                }}
              />
            </div>

            <div className="lg:col-span-7">
              <ChartSection
                activeMetric={chartMetric}
                onMetricChange={setChartMetric}
                currentValue={currentChartValue}
                currentDate={new Date().toISOString().split('T')[0]}
                timeRange={timeRange}
                onTimeRangeChange={() => {
                  // Handle time range change - could open a modal or dropdown
                  console.log('Time range change requested');
                }}
              />
            </div>
          </div>
        )}

        {activeTab !== 'Trading Data' && (
          <div className="bg-[#101010] border border-[#292D32] rounded-lg sm:rounded-xl p-6 sm:p-12 text-center">
            <p className="text-white/60 text-sm sm:text-base">Content for {activeTab} tab coming soon...</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
