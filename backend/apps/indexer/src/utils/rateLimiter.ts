import { config } from '../config/index.js';
import { logger } from './logger.js';

interface RateLimitState {
  requests: number[];
  lastReset: number;
}

class RateLimiter {
  private state: Map<string, RateLimitState> = new Map();
  private readonly logger = logger.child({ component: 'rateLimiter' });

  async waitForSlot(service: string): Promise<void> {
    const limits = config.rateLimiting.thegraph;
    if (!limits.enabled) return;

    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);

    // Get or create state for this service
    let state = this.state.get(service);
    if (!state) {
      state = { requests: [], lastReset: now };
      this.state.set(service, state);
    }

    // Clean old requests (older than 1 hour)
    const hourAgo = now - 3600000;
    state.requests = state.requests.filter(timestamp => timestamp > hourAgo);

    // Check hourly limit
    if (state.requests.length >= limits.requestsPerHour) {
      const oldestRequest = Math.min(...state.requests);
      const waitTime = oldestRequest + 3600000 - now;
      this.logger.warn('Rate limit exceeded (hourly)', {
        service,
        requests: state.requests.length,
        limit: limits.requestsPerHour,
        waitTime: Math.ceil(waitTime / 1000),
      });
      await this.sleep(waitTime);
      return this.waitForSlot(service);
    }

    // Check minute limit
    const minuteAgo = now - 60000;
    const recentRequests = state.requests.filter(timestamp => timestamp > minuteAgo);
    
    if (recentRequests.length >= limits.requestsPerMinute) {
      const oldestRecentRequest = Math.min(...recentRequests);
      const waitTime = oldestRecentRequest + 60000 - now;
      this.logger.warn('Rate limit exceeded (minute)', {
        service,
        requests: recentRequests.length,
        limit: limits.requestsPerMinute,
        waitTime: Math.ceil(waitTime / 1000),
      });
      await this.sleep(waitTime);
      return this.waitForSlot(service);
    }

    // Record this request
    state.requests.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats(service: string): { requestsLastMinute: number; requestsLastHour: number } {
    const state = this.state.get(service);
    if (!state) return { requestsLastMinute: 0, requestsLastHour: 0 };

    const now = Date.now();
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;

    return {
      requestsLastMinute: state.requests.filter(t => t > minuteAgo).length,
      requestsLastHour: state.requests.filter(t => t > hourAgo).length,
    };
  }
}

export const rateLimiter = new RateLimiter();
