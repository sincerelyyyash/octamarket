import { BaseWebSocket } from './BaseWebSocket.js';
import { logger } from '../utils/logger.js';

/**
 * WebSocket manager for Polymarket CLOB
 */
export class PolymarketCLOBWebSocket extends BaseWebSocket {
  constructor() {
    super({
      url: 'wss://clob.polymarket.com/ws',
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
    });
  }

  protected onOpen(): void {
    logger.info('Polymarket CLOB WebSocket connected');
    this.emit('connected', {});
  }

  protected onMessage(message: any): void {
    logger.debug('Polymarket CLOB message received', { type: message?.type || 'unknown' });

    // Handle different message types
    if (message.type === 'book') {
      this.emit('book', message);
    } else if (message.type === 'trade') {
      this.emit('trade', message);
    } else if (message.type === 'ticker') {
      this.emit('ticker', message);
    } else if (message.type === 'last_trade_price') {
      this.emit('last_trade_price', message);
    } else {
      this.emit('message', message);
    }
  }

  protected onError(error: Error): void {
    logger.error('Polymarket CLOB WebSocket error', { error });
    this.emit('error', error);
  }

  protected onClose(code: number, reason: string): void {
    logger.info('Polymarket CLOB WebSocket closed', { code, reason });
    this.emit('disconnected', { code, reason });
  }

  protected sendHeartbeat(): void {
    // Polymarket may not require explicit heartbeat
    // Add if needed based on API documentation
  }

  /**
   * Subscribe to market updates
   */
  subscribeToMarket(tokenId: string): void {
    this.send({
      type: 'subscribe',
      market: tokenId,
    });
    logger.debug('Subscribed to market', { tokenId });
  }

  /**
   * Unsubscribe from market updates
   */
  unsubscribeFromMarket(tokenId: string): void {
    this.send({
      type: 'unsubscribe',
      market: tokenId,
    });
    logger.debug('Unsubscribed from market', { tokenId });
  }

  /**
   * Subscribe to all markets
   */
  subscribeToAll(): void {
    this.send({
      type: 'subscribe',
      market: '*',
    });
    logger.debug('Subscribed to all markets');
  }
}

/**
 * WebSocket manager for Polymarket Gamma API
 */
export class PolymarketGammaWebSocket extends BaseWebSocket {
  constructor() {
    super({
      url: 'wss://gamma-api.polymarket.com/ws',
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
    });
  }

  protected onOpen(): void {
    logger.info('Polymarket Gamma WebSocket connected');
    this.emit('connected', {});
  }

  protected onMessage(message: any): void {
    logger.debug('Polymarket Gamma message received', { type: message?.type || 'unknown' });

    // Handle different message types
    if (message.type === 'market_update') {
      this.emit('market_update', message);
    } else if (message.type === 'market_created') {
      this.emit('market_created', message);
    } else if (message.type === 'market_resolved') {
      this.emit('market_resolved', message);
    } else {
      this.emit('message', message);
    }
  }

  protected onError(error: Error): void {
    logger.error('Polymarket Gamma WebSocket error', { error });
    this.emit('error', error);
  }

  protected onClose(code: number, reason: string): void {
    logger.info('Polymarket Gamma WebSocket closed', { code, reason });
    this.emit('disconnected', { code, reason });
  }

  protected sendHeartbeat(): void {
    this.send({ type: 'ping' });
  }
}

