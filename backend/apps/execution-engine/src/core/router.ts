import type { VenueQuote } from './quotes.js';

export type OrderPlan = {
  venue: 'POLYMARKET' | 'KALSHI';
  price: number;
};

export const buildOrderPlan = (
  best: VenueQuote | undefined,
  side: 'BUY' | 'SELL',
  constraints?: { maxPrice?: number; maxSlippage?: number }
): OrderPlan | undefined => {
  if (!best) return undefined;
  const px = side === 'BUY' ? best.effectiveBuy : best.effectiveSell;
  if (px == null) return undefined;
  if (constraints?.maxPrice != null) {
    if (side === 'BUY' && px > constraints.maxPrice) return undefined;
    if (side === 'SELL' && px < constraints.maxPrice) return undefined; // treat maxPrice as min acceptable sell price
  }
  // Slippage guard is deferred (we use quotes only in MVP)
  return { venue: best.venue, price: px };
};


