'use client';

import { useState, useMemo } from 'react';

export function ArbitrageCalculator() {
  const [buyPrice, setBuyPrice] = useState<number>(0.45);
  const [sellPrice, setSellPrice] = useState<number>(0.55);
  const [capital, setCapital] = useState<number>(1000);
  const [fees, setFees] = useState<number>(2); // percentage

  const calculations = useMemo(() => {
    // Calculate raw profit
    const rawProfit = sellPrice - buyPrice;
    const rawProfitPct = (rawProfit / buyPrice) * 100;
    
    // Calculate with fees
    const totalFees = (fees / 100) * capital;
    const netProfit = (rawProfit * capital) - totalFees;
    const netProfitPct = (netProfit / capital) * 100;
    
    // Calculate shares
    const shares = capital / buyPrice;
    const sellValue = shares * sellPrice;
    const buyValue = shares * buyPrice;
    
    return {
      rawProfit,
      rawProfitPct,
      netProfit,
      netProfitPct,
      totalFees,
      shares,
      sellValue,
      buyValue,
      breakEvenPrice: buyPrice + (totalFees / shares),
    };
  }, [buyPrice, sellPrice, capital, fees]);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">🧮 Arbitrage Calculator</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Side */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Buy Price (decimal)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={buyPrice}
              onChange={(e) => setBuyPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500"
            />
            <div className="text-xs text-gray-400 mt-1">
              {(buyPrice * 100).toFixed(2)}¢
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sell Price (decimal)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={sellPrice}
              onChange={(e) => setSellPrice(parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
            />
            <div className="text-xs text-gray-400 mt-1">
              {(sellPrice * 100).toFixed(2)}¢
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Capital to Invest ($)
            </label>
            <input
              type="number"
              step="100"
              min="0"
              value={capital}
              onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Total Fees (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={fees}
              onChange={(e) => setFees(parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            />
            <div className="text-xs text-gray-400 mt-1">
              Fee Amount: ${calculations.totalFees.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Results Side */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">📊 Results</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Shares:</span>
                <span className="text-white font-mono font-bold">
                  {calculations.shares.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Buy Value:</span>
                <span className="text-green-400 font-mono font-bold">
                  ${calculations.buyValue.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Sell Value:</span>
                <span className="text-red-400 font-mono font-bold">
                  ${calculations.sellValue.toFixed(2)}
                </span>
              </div>

              <div className="border-t border-gray-700 pt-3 mt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">Raw Profit:</span>
                  <span className={`font-mono font-bold ${
                    calculations.rawProfit > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    ${(calculations.rawProfit * calculations.shares).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Raw Profit %:</span>
                  <span className={`font-mono ${
                    calculations.rawProfitPct > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {calculations.rawProfitPct > 0 ? '+' : ''}{calculations.rawProfitPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="bg-gray-900/50 border border-gray-700 rounded p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-300 font-semibold">Net Profit:</span>
                  <span className={`font-mono font-bold text-xl ${
                    calculations.netProfit > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    ${calculations.netProfit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Net Profit %:</span>
                  <span className={`font-mono text-lg ${
                    calculations.netProfitPct > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {calculations.netProfitPct > 0 ? '+' : ''}{calculations.netProfitPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-gray-400">Break-even Price:</span>
                <span className="text-yellow-400 font-mono">
                  {(calculations.breakEvenPrice * 100).toFixed(2)}¢
                </span>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className={`rounded-lg p-4 ${
            calculations.netProfitPct > 2 
              ? 'bg-green-500/10 border border-green-500/30' 
              : calculations.netProfitPct > 0
              ? 'bg-yellow-500/10 border border-yellow-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className="text-sm">
              {calculations.netProfitPct > 2 ? (
                <>
                  <div className="font-semibold text-green-400 mb-1">✅ Good Opportunity</div>
                  <div className="text-gray-300">This arbitrage opportunity has a net profit above 2%</div>
                </>
              ) : calculations.netProfitPct > 0 ? (
                <>
                  <div className="font-semibold text-yellow-400 mb-1">⚠️ Low Margin</div>
                  <div className="text-gray-300">Profit margin is low. Consider fees and execution risk.</div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-red-400 mb-1">❌ Not Profitable</div>
                  <div className="text-gray-300">This trade would result in a loss after fees.</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


