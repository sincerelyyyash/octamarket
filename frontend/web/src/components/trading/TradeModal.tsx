'use client';

import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { createTrade } from '../../store/slices/tradesSlice';
import { Market, MarketOutcome } from '../../types/market';
import { TradeSide } from '../../types/trade';
import LoadingSpinner from '../ui/LoadingSpinner';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: Market;
  onTradeCreated?: (intentId: string) => void;
  initialOutcome?: MarketOutcome | null;
  initialSide?: TradeSide;
}

export default function TradeModal({ isOpen, onClose, market, onTradeCreated, initialOutcome, initialSide }: TradeModalProps) {
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.trades);
  const [side, setSide] = useState<TradeSide>(initialSide || TradeSide.BUY);
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | null>(
    initialOutcome || market.outcomes[0] || null
  );
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');

  // Update selected outcome and side when props change
  useEffect(() => {
    if (isOpen) {
      if (initialOutcome) {
        setSelectedOutcome(initialOutcome);
      } else {
        setSelectedOutcome(market.outcomes[0] || null);
      }
      if (initialSide) {
        setSide(initialSide);
      } else {
        setSide(TradeSide.BUY);
      }
      setQuantity('');
      setLimitPrice('');
    }
  }, [isOpen, initialOutcome, initialSide, market.outcomes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOutcome || !quantity) return;

    const intentId = `intent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const idempotencyKey = intentId;

    // Use canonical marketId - execution engine will choose best venue
    // We still need a sourceMarketId for the API, so use the first one as fallback
    const sourceMarket = market.sourceMarkets[0];
    if (!sourceMarket) {
      alert('No source market available');
      return;
    }

    const result = await dispatch(
      createTrade({
        data: {
          intentId,
          source: sourceMarket.source,
          sourceMarketId: sourceMarket.sourceMarketId,
          marketId: market.id,
          side,
          outcomeIndex: selectedOutcome.index,
          quantity: parseFloat(quantity),
          limitPrice: limitPrice ? parseFloat(limitPrice) : undefined,
        },
        idempotencyKey,
      })
    );

    if (createTrade.fulfilled.match(result)) {
      if (onTradeCreated) {
        onTradeCreated(intentId);
      }
      onClose();
      setQuantity('');
      setLimitPrice('');
    }
  };

  const calculateTotal = () => {
    if (!quantity || !selectedOutcome) return '0.00';
    const displayPrice = selectedOutcome.bestPrice ?? selectedOutcome.currentPrice;
    if (!displayPrice) return '0.00';
    const price = limitPrice ? parseFloat(limitPrice) : displayPrice;
    return (parseFloat(quantity) * price).toFixed(2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0b0d] border border-[#4c4c4c] rounded-[12px] p-6 md:p-8 max-w-lg w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-white text-[24px] md:text-[28px] font-semibold tracking-[-0.56px] mb-2">
          Place Trade
        </h2>
        <p className="text-white/70 text-[12px] font-mono mb-6 line-clamp-2">{market.title}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Side Selection */}
          <div>
            <label className="block text-white text-[14px] font-medium mb-2">Side</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSide(TradeSide.BUY)}
                className={`px-4 py-3 rounded-[8px] text-[14px] font-mono transition-colors ${
                  side === TradeSide.BUY
                    ? 'bg-green-500 text-white'
                    : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setSide(TradeSide.SELL)}
                className={`px-4 py-3 rounded-[8px] text-[14px] font-mono transition-colors ${
                  side === TradeSide.SELL
                    ? 'bg-red-500 text-white'
                    : 'bg-black border border-[#4c4c4c] text-white hover:border-white/50'
                }`}
              >
                SELL
              </button>
            </div>
          </div>

          {/* Outcome Selection */}
          <div>
            <label className="block text-white text-[14px] font-medium mb-2">Outcome</label>
            <div className="space-y-2">
              {market.outcomes.map((outcome) => (
                <label
                  key={outcome.id}
                  className="flex items-center justify-between bg-black border border-[#4c4c4c] rounded-[8px] px-4 py-3 cursor-pointer hover:border-white/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="outcome"
                      checked={selectedOutcome?.id === outcome.id}
                      onChange={() => setSelectedOutcome(outcome)}
                      className="w-4 h-4 accent-white"
                    />
                    <span className="text-white text-[14px] font-mono">{outcome.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-[14px] font-semibold">
                      {(outcome.bestPrice ?? outcome.currentPrice) !== undefined
                        ? `${(((outcome.bestPrice ?? outcome.currentPrice)!) * 100).toFixed(1)}%`
                        : '-'}
                    </span>
                    {outcome.bestPriceSource && outcome.prices && outcome.prices.length > 1 && (
                      <span className="text-green-400 text-[10px] font-mono bg-green-400/10 px-1.5 py-0.5 rounded">
                        {outcome.bestPriceSource}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label htmlFor="quantity" className="block text-white text-[14px] font-medium mb-2">
              Quantity
            </label>
            <input
              type="number"
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-black border border-[#4c4c4c] rounded-[8px] px-4 py-3 text-white text-[14px] font-mono focus:outline-none focus:border-white/50 transition-colors"
              placeholder="Enter quantity"
              required
              min="0"
              step="0.01"
            />
          </div>

          {/* Limit Price */}
          <div>
            <label htmlFor="limitPrice" className="block text-white text-[14px] font-medium mb-2">
              Limit Price (Optional)
            </label>
            <input
              type="number"
              id="limitPrice"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="w-full bg-black border border-[#4c4c4c] rounded-[8px] px-4 py-3 text-white text-[14px] font-mono focus:outline-none focus:border-white/50 transition-colors"
              placeholder="Market price"
              min="0"
              max="1"
              step="0.01"
            />
            <p className="text-white/50 text-[11px] font-mono mt-1">
              Price between 0 and 1. Leave empty for market price.
            </p>
          </div>

          {/* Total */}
          <div className="bg-white/5 rounded-[8px] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-[14px] font-mono">Estimated Total</span>
              <span className="text-white text-[18px] font-semibold">${calculateTotal()}</span>
            </div>
            {selectedOutcome && selectedOutcome.prices && selectedOutcome.prices.length > 1 && (
              <p className="text-green-400/80 text-[11px] font-mono">
                Execution engine will automatically choose the best price across {selectedOutcome.prices.length} sources
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !quantity || !selectedOutcome}
            className="w-full bg-white hover:bg-white/90 disabled:bg-white/50 text-black text-[14px] font-medium font-mono px-6 py-3 rounded-[8px] transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? <LoadingSpinner size="sm" /> : `Place ${side} Order`}
          </button>
        </form>
      </div>
    </div>
  );
}

