import { BaseWebSocket } from './BaseWebSocket.js';
import { logger } from '../utils/logger.js';

/**
 * WebSocket manager for Kalshi Trade API
 */
export class KalshiWebSocket extends BaseWebSocket {
  constructor() {
    super({
      url: 'wss://api.elections.kalshi.com/trade-api/ws',
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
    });
  }

  protected onOpen(): void {
    logger.info('Kalshi WebSocket connected');
    this.emit('connected', {});
  }

  protected onMessage(message: any): void {
    logger.debug('Kalshi message received', { type: message?.type || 'unknown' });

    // Handle different message types
    if (message.type === 'orderbook_snapshot') {
      this.emit('orderbook_snapshot', message);
    } else if (message.type === 'orderbook_delta') {
      this.emit('orderbook_delta', message);
    } else if (message.type === 'trade') {
      this.emit('trade', message);
    } else if (message.type === 'ticker') {
      this.emit('ticker', message);
    } else if (message.type === 'fill') {
      this.emit('fill', message);
    } else if (message.type === 'error') {
      this.emit('error', message);
      logger.error('Kalshi WebSocket error message', { message });
    } else {
      this.emit('message', message);
    }
  }

  protected onError(error: Error): void {
    logger.error('Kalshi WebSocket error', { error });
    this.emit('error', error);
  }

  protected onClose(code: number, reason: string): void {
    logger.info('Kalshi WebSocket closed', { code, reason });
    this.emit('disconnected', { code, reason });
  }

  protected sendHeartbeat(): void {
    this.send({ type: 'ping' });
  }

  /**
   * Subscribe to market ticker updates
   */
  subscribeToTicker(ticker: string): void {
    this.send({
      cmd: 'subscribe',
      params: {
        channels: ['ticker'],
        market_ticker: ticker,
      },
    });
    logger.debug('Subscribed to ticker', { ticker });
  }

  /**
   * Subscribe to orderbook updates
   */
  subscribeToOrderbook(ticker: string): void {
    this.send({
      cmd: 'subscribe',
      params: {
        channels: ['orderbook_delta'],
        market_ticker: ticker,
      },
    });
    logger.debug('Subscribed to orderbook', { ticker });
  }

  /**
   * Subscribe to trade updates
   */
  subscribeToTrades(ticker: string): void {
    this.send({
      cmd: 'subscribe',
      params: {
        channels: ['trade'],
        market_ticker: ticker,
      },
    });
    logger.debug('Subscribed to trades', { ticker });
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(channel: string, ticker?: string): void {
    const params: any = {
      channels: [channel],
    };
    
    if (ticker) {
      params.market_ticker = ticker;
    }

    this.send({
      cmd: 'unsubscribe',
      params,
    });
    logger.debug('Unsubscribed from channel', { channel, ticker });
  }
}

