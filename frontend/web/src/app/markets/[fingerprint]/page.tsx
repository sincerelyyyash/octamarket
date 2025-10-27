'use client';

import { use } from 'react';
import { MarketDetails } from '@/components/markets/MarketDetails';
import { OrderForm } from '@/components/orders/OrderForm';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useMarketSources } from '@/lib/api';
import Link from 'next/link';

export default function MarketDetailsPage({ 
  params 
}: { 
  params: Promise<{ fingerprint: string }> 
}) {
  const { fingerprint } = use(params);
  const { data: sources } = useMarketSources(fingerprint);
  
  const market = sources?.[0];
  
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/markets"
            className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2"
          >
            ← Back to Markets
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MarketDetails 
              eventFingerprint={fingerprint}
              title={market?.name || 'Loading...'}
              description={market?.name}
            />
          </div>
          
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <OrderForm 
                marketId={market?.market_id}
                platform={market?.source}
                eventTitle={market?.name}
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}


