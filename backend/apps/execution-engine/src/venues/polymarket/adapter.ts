import axios from 'axios';
import { signPolymarketOrder, getAddressFromPrivateKey } from './auth.js';

export type PolymarketQuote = {
  bestBid?: number;
  bestAsk?: number;
  liquidity?: number;
};

export type PolymarketOrderParams = {
  tokenId: string;
  price: number; // 0-1 range
  size: number; // number of contracts
  side: 'BUY' | 'SELL';
  feeRateBps?: number;
  nonce?: number;
  expiration?: number; // unix timestamp
};

export type PolymarketOrderResponse = {
  orderId: string;
  status: string;
  price?: number;
  size?: number;
  sizeFilled?: number;
};

export class PolymarketAdapter {
  private wallet: string;

  constructor(
    private clobEndpoint: string,
    private privateKey: string,
    private chainId: number
  ) {
    this.wallet = getAddressFromPrivateKey(privateKey);
  }

  async getQuote(tokenIdOrConditionId: string, outcomeIndex?: number): Promise<PolymarketQuote> {
    // Resolve to token_id if a condition_id was provided
    const tokenId = await this.resolveTokenId(tokenIdOrConditionId, outcomeIndex).catch(() => tokenIdOrConditionId);

    const url = `${this.clobEndpoint}/book`;
    try {
      const resp = await axios.get(url, {
        params: { token_id: tokenId },
        timeout: 15000,
      });

      const bids = resp.data?.bids || [];
      const asks = resp.data?.asks || [];

      const bestBid = bids.length > 0 ? Number(bids[0].price) : undefined;
      const bestAsk = asks.length > 0 ? Number(asks[0].price) : undefined;

      return { bestBid, bestAsk, liquidity: undefined };
    } catch {
      return {};
    }
  }

  async placeOrder(params: PolymarketOrderParams): Promise<PolymarketOrderResponse> {
    const salt = Math.floor(Math.random() * 1e16).toString();
    const nonce = params.nonce || 0;
    const expiration = params.expiration || Math.floor(Date.now() / 1000) + 86400; // 24h default
    const feeRateBps = params.feeRateBps || 0;

    // Convert price to maker/taker amounts (Polymarket uses 6 decimals for USDC)
    const priceScaled = Math.floor(params.price * 1e6);
    const sizeScaled = Math.floor(params.size * 1e6);

    const makerAmount = params.side === 'BUY' ? sizeScaled.toString() : (sizeScaled * priceScaled / 1e6).toString();
    const takerAmount = params.side === 'BUY' ? (sizeScaled * priceScaled / 1e6).toString() : sizeScaled.toString();

    const order = {
      salt,
      maker: this.wallet,
      signer: this.wallet,
      taker: '0x0000000000000000000000000000000000000000',
      tokenId: params.tokenId,
      makerAmount,
      takerAmount,
      expiration: expiration.toString(),
      nonce: nonce.toString(),
      feeRateBps: feeRateBps.toString(),
      side: params.side === 'BUY' ? 0 : 1,
      signatureType: 0,
    };

    const signature = await signPolymarketOrder(this.privateKey, order, this.chainId);

    const url = `${this.clobEndpoint}/order`;
    const resp = await axios.post(
      url,
      {
        ...order,
        signature,
      },
      { timeout: 15000 }
    );

    return {
      orderId: resp.data?.orderID || '',
      status: resp.data?.status || 'unknown',
      price: params.price,
      size: params.size,
      sizeFilled: 0,
    };
  }

  async getOrderStatus(orderId: string): Promise<PolymarketOrderResponse> {
    const url = `${this.clobEndpoint}/order/${orderId}`;
    const resp = await axios.get(url, { timeout: 15000 });

    const order = resp.data;
    const sizeFilled = order?.size_matched != null
      ? Number(order.size_matched)
      : 0;

    return {
      orderId,
      status: order?.status || 'unknown',
      price: order?.price ? Number(order.price) : undefined,
      size: order?.original_size ? Number(order.original_size) : undefined,
      sizeFilled,
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    const url = `${this.clobEndpoint}/order`;
    await axios.delete(url, {
      data: { orderID: orderId },
      timeout: 15000,
    });
  }

  // Helper: resolve token_id from condition_id via CLOB markets endpoint
  async resolveTokenId(conditionIdOrTokenId: string, outcomeIndex: number = 0): Promise<string> {
    // If it already looks like a token id (big integer-ish), skip resolution
    if (/^\d+$/.test(conditionIdOrTokenId) && conditionIdOrTokenId.length > 6) return conditionIdOrTokenId;

    const url = `${this.clobEndpoint}/markets`;
    const resp = await axios.get(url, {
      params: { condition_id: conditionIdOrTokenId },
      timeout: 15000,
    });

    const markets = Array.isArray(resp.data) ? resp.data : (resp.data?.markets || []);
    if (!markets.length) throw new Error('NO_MARKET_FOR_CONDITION');

    const market = markets[0];
    const tokens = market?.tokens || market?.outcomes || [];
    if (!Array.isArray(tokens) || !tokens.length) throw new Error('NO_TOKENS_FOR_MARKET');

    // Try to find by outcomeIndex; fallback to YES/NO naming; else first/second
    let picked: any = tokens[outcomeIndex] ?? tokens[0];
    if (!picked) picked = tokens[0];

    const tokenId = picked.token_id || picked.tokenId || picked.id || picked.tokenID;
    if (!tokenId) throw new Error('TOKEN_ID_NOT_FOUND');
    return String(tokenId);
  }
}


