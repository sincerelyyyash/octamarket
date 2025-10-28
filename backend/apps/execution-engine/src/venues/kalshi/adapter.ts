import axios from 'axios';
import { createKalshiSignature, createKalshiHeaders } from './auth.js';

export type KalshiQuote = {
  bestBid?: number;
  bestAsk?: number;
  liquidity?: number;
  bestBidNo?: number;
  bestAskNo?: number;
};

export type KalshiOrderParams = {
  ticker: string;
  action: 'buy' | 'sell';
  side: 'yes' | 'no';
  count: number;
  type: 'market' | 'limit';
  yes_price?: number;
  no_price?: number;
  expiration_ts?: number;
  sell_position_floor?: number;
  buy_max_cost?: number;
};

export type KalshiOrderResponse = {
  order_id: string;
  status: string;
  yes_price?: number;
  no_price?: number;
  remaining_count: number;
};

export class KalshiAdapter {
  constructor(
    private restEndpoint: string,
    private apiKey: string,
    private privateKeyPem: string
  ) {}

  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: any
  ): Promise<T> {
    const timestamp = Date.now().toString();
    const signature = createKalshiSignature(this.privateKeyPem, method, path, timestamp);
    const headers = createKalshiHeaders(this.apiKey, signature, timestamp);

    const url = `${this.restEndpoint}${path}`;
    const config = { headers, timeout: 15000 };

    let resp;
    if (method === 'GET') {
      resp = await axios.get(url, config);
    } else if (method === 'POST') {
      resp = await axios.post(url, body, config);
    } else if (method === 'DELETE') {
      resp = await axios.delete(url, config);
    } else {
      throw new Error(`Unsupported method: ${method}`);
    }

    return resp.data;
  }

  async getQuote(ticker: string): Promise<KalshiQuote> {
    const data = await this.signedRequest<any>('GET', `/trade-api/v2/markets?tickers=${ticker}&limit=1`);
    const mkt = data?.markets?.[0];
    if (!mkt) return {};

    const yesBid = mkt.yes_bid != null ? Number(mkt.yes_bid) / 100 : undefined;
    const yesAsk = mkt.yes_ask != null ? Number(mkt.yes_ask) / 100 : undefined;
    // If API doesn't expose no_* directly, derive from yes as 1 - yes
    const noBid = mkt.no_bid != null ? Number(mkt.no_bid) / 100 : (yesAsk != null ? 1 - yesAsk : undefined);
    const noAsk = mkt.no_ask != null ? Number(mkt.no_ask) / 100 : (yesBid != null ? 1 - yesBid : undefined);

    return {
      bestBid: yesBid,
      bestAsk: yesAsk,
      bestBidNo: noBid,
      bestAskNo: noAsk,
      liquidity: mkt.open_interest ? Number(mkt.open_interest) : undefined,
    };
  }

  async placeOrder(params: KalshiOrderParams): Promise<KalshiOrderResponse> {
    const data = await this.signedRequest<any>('POST', '/trade-api/v2/portfolio/orders', params);
    return {
      order_id: data.order?.order_id || '',
      status: data.order?.status || 'unknown',
      yes_price: data.order?.yes_price ? Number(data.order.yes_price) : undefined,
      no_price: data.order?.no_price ? Number(data.order.no_price) : undefined,
      remaining_count: data.order?.remaining_count || 0,
    };
  }

  async getOrderStatus(orderId: string): Promise<KalshiOrderResponse> {
    const data = await this.signedRequest<any>('GET', `/trade-api/v2/portfolio/orders/${orderId}`);
    return {
      order_id: data.order?.order_id || orderId,
      status: data.order?.status || 'unknown',
      yes_price: data.order?.yes_price ? Number(data.order.yes_price) : undefined,
      no_price: data.order?.no_price ? Number(data.order.no_price) : undefined,
      remaining_count: data.order?.remaining_count || 0,
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.signedRequest('DELETE', `/trade-api/v2/portfolio/orders/${orderId}`);
  }
}


