import { getAuthToken } from '../api/client';

export interface SSEClientOptions {
  onMessage: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class SSEClient {
  private url: string;
  private options: SSEClientOptions;
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isClosed = false;

  constructor(url: string, options: SSEClientOptions) {
    this.url = url;
    this.options = {
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      ...options,
    };
  }

  connect(): void {
    if (this.eventSource) {
      return;
    }

    this.isClosed = false;

    // Add auth token to URL if available
    const token = getAuthToken();
    const urlWithAuth = token ? `${this.url}?token=${token}` : this.url;

    this.eventSource = new EventSource(urlWithAuth);

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      if (this.options.onOpen) {
        this.options.onOpen();
      }
    };

    this.eventSource.onmessage = (event: MessageEvent) => {
      this.options.onMessage(event);
    };

    this.eventSource.onerror = (error: Event) => {
      if (this.options.onError) {
        this.options.onError(error);
      }

      // Attempt to reconnect if enabled and not manually closed
      if (
        this.options.autoReconnect &&
        !this.isClosed &&
        this.reconnectAttempts < (this.options.maxReconnectAttempts || 5)
      ) {
        this.reconnect();
      }
    };

    // Listen for custom event types (snapshot, update, etc.)
    this.eventSource.addEventListener('snapshot', (event: MessageEvent) => {
      this.options.onMessage(event);
    });

    this.eventSource.addEventListener('update', (event: MessageEvent) => {
      this.options.onMessage(event);
    });
  }

  private reconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.close();
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.options.reconnectInterval);
  }

  close(): void {
    this.isClosed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }
}

// Helper function to create and manage SSE connections
export const createSSEConnection = (
  url: string,
  options: SSEClientOptions
): SSEClient => {
  const client = new SSEClient(url, options);
  client.connect();
  return client;
};

