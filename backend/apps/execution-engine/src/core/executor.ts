import type { Logger } from 'winston';
import type { TradeIntent } from './validator.js';
import type { EngineConfig } from '../lib/config.js';
import { KalshiAdapter } from '../venues/kalshi/adapter.js';
import { PolymarketAdapter } from '../venues/polymarket/adapter.js';
import { SignerClient } from '../signer/client.js';
import { reportState } from '../persistence/reporter.js';

export type ExecutionResult = {
  success: boolean;
  orderId?: string;
  venue?: string;
  avgPrice?: number;
  fills?: Array<{ qty: number; px: number; ts: string }>;
  error?: string;
};

const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 2000;

export class OrderExecutor {
  private signerClient: SignerClient;

  constructor(
    private logger: Logger,
    private config: EngineConfig
  ) {
    this.signerClient = new SignerClient(config);
  }

  async executeOnKalshi(
    intent: TradeIntent,
    ticker: string,
    targetPrice: number
  ): Promise<ExecutionResult> {
    try {
      const creds = await this.signerClient.getKalshiCredentials();
      const adapter = new KalshiAdapter(
        'https://trading-api.kalshi.com',
        creds.apiKey,
        creds.privateKeyPem
      );

      // Place order
      const side = (intent.outcomeIndex ?? 0) === 0 ? 'yes' : 'no';
      const orderParams = {
        ticker,
        action: intent.side === 'BUY' ? 'buy' as const : 'sell' as const,
        side: side as 'yes' | 'no',
        count: Math.floor(intent.quantity),
        type: 'limit' as const,
        // Price field depends on side
        yes_price: side === 'yes' ? Math.floor(targetPrice * 100) : undefined,
        no_price: side === 'no' ? Math.floor(targetPrice * 100) : undefined,
      };

      this.logger.info('Placing Kalshi order', { intentId: intent.intentId, params: orderParams });
      const orderResp = await adapter.placeOrder(orderParams);

      await reportState(this.config, intent.intentId, 'SUBMITTED', {
        venue: 'KALSHI',
        orderId: orderResp.order_id,
        price: targetPrice,
      });

      // Poll for fill
      let filled = false;
      let attempts = 0;
      let finalStatus = orderResp;

      while (attempts < MAX_POLL_ATTEMPTS && !filled) {
        await this.delay(POLL_INTERVAL_MS);
        finalStatus = await adapter.getOrderStatus(orderResp.order_id);
        
        this.logger.info('Polling Kalshi order status', {
          intentId: intent.intentId,
          orderId: orderResp.order_id,
          status: finalStatus.status,
          remaining: finalStatus.remaining_count,
        });

        if (finalStatus.status === 'resting' && finalStatus.remaining_count === 0) {
          filled = true;
        } else if (finalStatus.status === 'executed') {
          filled = true;
        } else if (finalStatus.status === 'canceled' || finalStatus.status === 'expired') {
          break;
        }

        attempts++;
      }

      if (filled) {
        const isYes = (intent.outcomeIndex ?? 0) === 0;
        const rawCents = isYes ? (finalStatus.yes_price ?? Math.round(targetPrice * 100)) : (finalStatus.no_price ?? Math.round(targetPrice * 100));
        const avgPrice = rawCents / 100;
        await reportState(this.config, intent.intentId, 'FILLED', {
          venue: 'KALSHI',
          orderId: orderResp.order_id,
          avgPrice,
          fills: [{ qty: intent.quantity, px: avgPrice, ts: new Date().toISOString() }],
        });

        return {
          success: true,
          orderId: orderResp.order_id,
          venue: 'KALSHI',
          avgPrice,
          fills: [{ qty: intent.quantity, px: avgPrice, ts: new Date().toISOString() }],
        };
      }

      // If not filled, cancel and report failure
      try {
        await adapter.cancelOrder(orderResp.order_id);
      } catch {
        // Best effort cancel
      }

      await reportState(this.config, intent.intentId, 'FAILED', {
        reason: 'ORDER_NOT_FILLED',
        orderId: orderResp.order_id,
      });

      return { success: false, error: 'ORDER_NOT_FILLED' };
    } catch (err: any) {
      this.logger.error('Kalshi execution error', { intentId: intent.intentId, error: err.message });
      await reportState(this.config, intent.intentId, 'FAILED', {
        reason: 'EXECUTION_ERROR',
        error: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  async executeOnPolymarket(
    intent: TradeIntent,
    tokenId: string,
    targetPrice: number
  ): Promise<ExecutionResult> {
    try {
      const creds = await this.signerClient.getPolymarketCredentials();
      const adapter = new PolymarketAdapter(
        creds.clobEndpoint,
        creds.privateKey,
        creds.chainId
      );

      // Place order
      const orderParams = {
        tokenId,
        price: targetPrice,
        size: intent.quantity,
        side: intent.side,
      };

      this.logger.info('Placing Polymarket order', { intentId: intent.intentId, params: orderParams });
      const orderResp = await adapter.placeOrder(orderParams);

      await reportState(this.config, intent.intentId, 'SUBMITTED', {
        venue: 'POLYMARKET',
        orderId: orderResp.orderId,
        price: targetPrice,
      });

      // Poll for fill
      let filled = false;
      let attempts = 0;
      let finalStatus = orderResp;

      while (attempts < MAX_POLL_ATTEMPTS && !filled) {
        await this.delay(POLL_INTERVAL_MS);
        finalStatus = await adapter.getOrderStatus(orderResp.orderId);

        this.logger.info('Polling Polymarket order status', {
          intentId: intent.intentId,
          orderId: orderResp.orderId,
          status: finalStatus.status,
          sizeFilled: finalStatus.sizeFilled,
          totalSize: finalStatus.size,
        });

        if (finalStatus.status === 'MATCHED' || (finalStatus.sizeFilled && finalStatus.sizeFilled >= intent.quantity * 0.95)) {
          filled = true;
        } else if (finalStatus.status === 'CANCELLED' || finalStatus.status === 'EXPIRED') {
          break;
        }

        attempts++;
      }

      if (filled) {
        const avgPrice = finalStatus.price || targetPrice;
        await reportState(this.config, intent.intentId, 'FILLED', {
          venue: 'POLYMARKET',
          orderId: orderResp.orderId,
          avgPrice,
          fills: [{ qty: intent.quantity, px: avgPrice, ts: new Date().toISOString() }],
        });

        return {
          success: true,
          orderId: orderResp.orderId,
          venue: 'POLYMARKET',
          avgPrice,
          fills: [{ qty: intent.quantity, px: avgPrice, ts: new Date().toISOString() }],
        };
      }

      // If not filled, cancel and report failure
      try {
        await adapter.cancelOrder(orderResp.orderId);
      } catch {
        // Best effort cancel
      }

      await reportState(this.config, intent.intentId, 'FAILED', {
        reason: 'ORDER_NOT_FILLED',
        orderId: orderResp.orderId,
      });

      return { success: false, error: 'ORDER_NOT_FILLED' };
    } catch (err: any) {
      this.logger.error('Polymarket execution error', { intentId: intent.intentId, error: err.message });
      await reportState(this.config, intent.intentId, 'FAILED', {
        reason: 'EXECUTION_ERROR',
        error: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

