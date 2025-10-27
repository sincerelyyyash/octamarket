import { ArbitrageOpportunities } from '@/components/arbitrage/ArbitrageOpportunities';
import { ArbitrageCalculator } from '@/components/arbitrage/ArbitrageCalculator';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ArbitragePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">💰 Arbitrage Opportunities</h1>
          <p className="text-gray-400 text-lg">
            Profit from price differences across prediction markets
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <ArbitrageOpportunities />
          </div>
          
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <ArbitrageCalculator />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}


