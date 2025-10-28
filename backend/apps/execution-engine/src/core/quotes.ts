import type { EngineConfig } from '../lib/config.js';
import type { Logger } from 'winston';
import { KalshiAdapter } from '../venues/kalshi/adapter.js';
import { PolymarketAdapter } from '../venues/polymarket/adapter.js';
import { SignerClient } from '../signer/client.js';

export type VenueQuote = {
  venue: 'KALSHI' | 'POLYMARKET';
  bestBid?: number;
  bestAsk?: number;
  bestBidNo?: number;
  bestAskNo?: number;
  effectiveBuy?: number;
  effectiveSell?: number;
};

export const fetchVenueQuotes = async (
  config: EngineConfig,
  logger: Logger,
  inputs: { kalshiTicker?: string; polymarketConditionId?: string; outcomeIndex?: number }
): Promise<VenueQuote[]> => {
  const quotes: VenueQuote[] = [];
  const signerClient = new SignerClient(config);

  // Fetch quotes in parallel
  const promises: Promise<void>[] = [];

  if (inputs.kalshiTicker) {
    promises.push(
      (async () => {
        try {
          const creds = await signerClient.getKalshiCredentials();
          const kalshi = new KalshiAdapter('https://trading-api.kalshi.com', creds.apiKey, creds.privateKeyPem);
          const q = await kalshi.getQuote(inputs.kalshiTicker!);
          if (q.bestAsk != null || q.bestBid != null || (q as any).bestAskNo != null || (q as any).bestBidNo != null) {
            quotes.push({
              venue: 'KALSHI',
              bestBid: q.bestBid,
              bestAsk: q.bestAsk,
              bestBidNo: (q as any).bestBidNo,
              bestAskNo: (q as any).bestAskNo,
              // effective prices computed post-fetch below
            });
          }
        } catch (err: any) {
          logger.warn('Kalshi quote fetch failed', { ticker: inputs.kalshiTicker, error: err.message });
        }
      })()
    );
  }

  if (inputs.polymarketConditionId) {
    promises.push(
      (async () => {
        try {
          const creds = await signerClient.getPolymarketCredentials();
          const poly = new PolymarketAdapter(creds.clobEndpoint, creds.privateKey, creds.chainId);
          const q = await poly.getQuote(inputs.polymarketConditionId!, inputs.outcomeIndex);
          if (q.bestAsk != null || q.bestBid != null) {
            quotes.push({
              venue: 'POLYMARKET',
              bestBid: q.bestBid,
              bestAsk: q.bestAsk,
              // effective prices computed post-fetch below
            });
          }
        } catch (err: any) {
          logger.warn('Polymarket quote fetch failed', { conditionId: inputs.polymarketConditionId, error: err.message });
        }
      })()
    );
  }

  await Promise.all(promises);
  // Compute effective prices based on outcome index
  const oi = inputs.outcomeIndex ?? 0; // 0=yes, 1=no
  for (const q of quotes) {
    if (q.venue === 'KALSHI') {
      if (oi === 0) {
        q.effectiveBuy = q.bestAsk;
        q.effectiveSell = q.bestBid;
      } else {
        q.effectiveBuy = q.bestAskNo ?? (q.bestBid != null ? 1 - q.bestBid : undefined);
        q.effectiveSell = q.bestBidNo ?? (q.bestAsk != null ? 1 - q.bestAsk : undefined);
      }
    } else {
      q.effectiveBuy = q.bestAsk;
      q.effectiveSell = q.bestBid;
    }
  }
  return quotes;
};

export const chooseBestVenue = (
  quotes: VenueQuote[],
  side: 'BUY' | 'SELL'
): VenueQuote | undefined => {
  if (quotes.length === 0) return undefined;
  if (side === 'BUY') {
    return quotes
      .filter((q) => q.effectiveBuy != null)
      .sort((a, b) => (a.effectiveBuy! - b.effectiveBuy!))[0];
  }
  return quotes
    .filter((q) => q.effectiveSell != null)
    .sort((a, b) => (b.effectiveSell! - a.effectiveSell!))[0];
};


