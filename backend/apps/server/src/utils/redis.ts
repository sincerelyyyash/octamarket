import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { cacheLogger } from './logger.js';

class RedisClient {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      enableReadyCheck: config.redis.enableReadyCheck,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
    });

    this.client.on('connect', () => {
      cacheLogger.info('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      cacheLogger.error('Redis connection error', { error: error.message });
    });

    this.client.on('close', () => {
      cacheLogger.warn('Redis connection closed');
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      cacheLogger.debug('Redis GET', { key, found: !!value });
      return value;
    } catch (error) {
      cacheLogger.error('Redis GET error', { key, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      cacheLogger.debug('Redis SET', { key, ttl: ttlSeconds });
      return true;
    } catch (error) {
      cacheLogger.error('Redis SET error', { key, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      cacheLogger.debug('Redis DEL', { key, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      cacheLogger.error('Redis DEL error', { key, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      cacheLogger.error('Redis EXISTS error', { key, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async flushPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.client.del(...keys);
      cacheLogger.debug('Redis FLUSH PATTERN', { pattern, deleted: result });
      return result;
    } catch (error) {
      cacheLogger.error('Redis FLUSH PATTERN error', { pattern, error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      cacheLogger.info('Redis disconnected');
    } catch (error) {
      cacheLogger.error('Redis disconnect error', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  getClient(): Redis {
    return this.client;
  }
}

// Singleton instance
export const redis = new RedisClient();

// Cache helper functions
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      cacheLogger.error('Cache parse error', { key, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      return await redis.set(key, serialized, ttlSeconds);
    } catch (error) {
      cacheLogger.error('Cache serialize error', { key, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async del(key: string): Promise<boolean> {
    return await redis.del(key);
  },

  async invalidatePattern(pattern: string): Promise<number> {
    return await redis.flushPattern(pattern);
  },

  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  },
};
