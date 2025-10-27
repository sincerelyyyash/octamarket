import { MarketsList } from '@/components/markets/MarketsList';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MarketsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Market Aggregator</h1>
          <p className="text-gray-400 text-lg">
            Find the best prices across prediction markets
          </p>
        </div>
        
        <MarketsList />
      </main>

      <Footer />
    </div>
  );
}


