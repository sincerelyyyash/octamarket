import { logger } from './logger.js';

/**
 * Rate limiter configuration
 */
interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  minDelayMs?: number;
}

/**
 * Request record for tracking
 */
interface RequestRecord {
  timestamp: number;
  count: number;
}

/**
 * Rate limiter to prevent exceeding API limits
 */
export class RateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = {
      minDelayMs: 100,
      ...config,
    };
  }

  /**
   * Wait for rate limit clearance before proceeding
   */
  async acquire(key: string = 'default'): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or initialize request records for this key
    let records = this.requests.get(key) || [];

    // Clean up old records outside the window
    records = records.filter(r => r.timestamp > windowStart);

    // Count total requests in window
    const totalRequests = records.reduce((sum, r) => sum + r.count, 0);

    if (totalRequests >= this.config.maxRequests) {
      // Calculate wait time until oldest request expires
      const oldestTimestamp = records[0]?.timestamp || now;
      const waitMs = Math.max(
        oldestTimestamp + this.config.windowMs - now,
        this.config.minDelayMs || 0
      );

      logger.debug(`Rate limit reached for ${key}, waiting ${waitMs}ms`, {
        totalRequests,
        maxRequests: this.config.maxRequests,
      });

      await this.sleep(waitMs);
      return this.acquire(key); // Recursive retry
    }

    // Add current request
    records.push({ timestamp: now, count: 1 });
    this.requests.set(key, records);

    // Apply minimum delay between requests
    if (this.config.minDelayMs && this.config.minDelayMs > 0) {
      await this.sleep(this.config.minDelayMs);
    }
  }

  /**
   * Reset rate limiter for a specific key
   */
  reset(key: string = 'default'): void {
    this.requests.delete(key);
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    this.requests.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Default rate limiters for different services
 */
export const polymarketRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 100 requests per minute
  minDelayMs: 100,
});

export const kalshiRateLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60000, // 60 requests per minute
  minDelayMs: 500,
});

