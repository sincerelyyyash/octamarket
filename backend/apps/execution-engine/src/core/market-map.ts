import axios from 'axios';
import type { EngineConfig } from '../lib/config.js';

export type SourceMarket = {
  source: 'POLYMARKET' | 'KALSHI';
  sourceMarketId: string;
  tokenId?: string; // Token ID for Polymarket CLOB trading
};

export const resolveSourceMarkets = async (
  config: EngineConfig,
  marketId: string
): Promise<SourceMarket[]> => {
  const url = `${config.server.baseUrl}/api/markets/${marketId}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.server.internalToken) headers['Authorization'] = `Bearer ${config.server.internalToken}`;

  const resp = await axios.get(url, { headers, timeout: 15000 });
  if (!resp.data?.success || !resp.data?.data) return [];

  const sourceMarkets = (resp.data.data.sourceMarkets || []) as Array<{
    source: SourceMarket['source'];
    sourceMarketId: string;
    tokenId?: string;
  }>;
  return sourceMarkets.map((s) => ({ 
    source: s.source, 
    sourceMarketId: s.sourceMarketId,
    tokenId: s.tokenId 
  }));
};


