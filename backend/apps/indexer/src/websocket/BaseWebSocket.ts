import WebSocket from 'ws';
import { logger } from '../utils/logger.js';

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export type WebSocketEventHandler = (data: any) => void | Promise<void>;

/**
 * Base WebSocket manager with auto-reconnect capabilities
 */
export abstract class BaseWebSocket {
  protected ws: WebSocket | null = null;
  protected config: Required<WebSocketConfig>;
  protected reconnectAttempts = 0;
  protected isConnecting = false;
  protected shouldReconnect = true;
  protected heartbeatTimer: NodeJS.Timeout | null = null;
  protected eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config,
    };
  }

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      logger.info(`Connecting to WebSocket: ${this.config.url}`);
      
      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('error', (error) => this.handleError(error));
      this.ws.on('close', (code, reason) => this.handleClose(code, reason));

      await this.waitForConnection();
    } catch (error) {
      logger.error('Failed to connect to WebSocket', { url: this.config.url, error });
      this.isConnecting = false;
      await this.attemptReconnect();
    }
  }

  /**
   * Wait for connection to establish
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      const checkConnection = () => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          clearTimeout(timeout);
          resolve();
        } else if (this.ws?.readyState === WebSocket.CLOSED) {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.shouldReconnect = false;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    logger.info(`Disconnected from WebSocket: ${this.config.url}`);
  }

  /**
   * Send message to WebSocket
   */
  send(data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send message, WebSocket not connected');
      return;
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(message);
  }

  /**
   * Subscribe to specific event type
   */
  on(eventType: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Emit event to all subscribed handlers
   */
  protected async emit(eventType: string, data: any): Promise<void> {
    const handlers = this.eventHandlers.get(eventType) || [];
    
    for (const handler of handlers) {
      try {
        await handler(data);
      } catch (error) {
        logger.error(`Error in event handler for ${eventType}`, { error });
      }
    }
  }

  /**
   * Handle WebSocket open event
   */
  protected handleOpen(): void {
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    logger.info(`WebSocket connected: ${this.config.url}`);

    // Start heartbeat
    if (this.config.heartbeatInterval > 0) {
      this.startHeartbeat();
    }

    // Call subclass hook
    this.onOpen();
  }

  /**
   * Handle incoming WebSocket message
   */
  protected handleMessage(data: WebSocket.Data): void {
    try {
      const message = this.parseMessage(data);
      this.onMessage(message);
    } catch (error) {
      logger.error('Error handling WebSocket message', { error });
    }
  }

  /**
   * Handle WebSocket error
   */
  protected handleError(error: Error): void {
    logger.error('WebSocket error', { url: this.config.url, error });
    this.onError(error);
  }

  /**
   * Handle WebSocket close event
   */
  protected handleClose(code: number, reason: Buffer): void {
    this.isConnecting = false;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    logger.warn(`WebSocket closed: ${this.config.url}`, {
      code,
      reason: reason.toString(),
    });

    this.onClose(code, reason.toString());

    if (this.shouldReconnect) {
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached, giving up', {
        url: this.config.url,
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      60000
    );

    logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`, {
      url: this.config.url,
    });

    await new Promise(resolve => setTimeout(resolve, delay));
    await this.connect();
  }

  /**
   * Start sending heartbeat messages
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendHeartbeat();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Parse incoming message - override in subclass
   */
  protected parseMessage(data: WebSocket.Data): any {
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    if (Buffer.isBuffer(data)) {
      return JSON.parse(data.toString());
    }
    return data;
  }

  /**
   * Hooks for subclasses to override
   */
  protected abstract onOpen(): void;
  protected abstract onMessage(message: any): void;
  protected abstract onError(error: Error): void;
  protected abstract onClose(code: number, reason: string): void;
  protected abstract sendHeartbeat(): void;

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

