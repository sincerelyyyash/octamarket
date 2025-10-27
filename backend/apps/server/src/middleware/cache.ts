import { Request, Response, NextFunction } from 'express';
import { cache } from '../utils/redis.js';
import { config } from '../config/index.js';
import { cacheLogger } from '../utils/logger.js';

export interface CacheOptions {
  ttl?: number;
  key?: string;
  skipCache?: boolean;
}

export const cacheMiddleware = (options: CacheOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip cache if requested
    if (options.skipCache || req.query.skipCache === 'true') {
      next();
      return;
    }

    // Generate cache key
    const cacheKey = options.key || generateCacheKey(req);
    const ttl = options.ttl || config.cache.ttl.markets;

    try {
      // Try to get from cache
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        cacheLogger.debug('Cache hit', { key: cacheKey });
        
        // Add cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        res.json(cachedData);
        return;
      }

      cacheLogger.debug('Cache miss', { key: cacheKey });

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data: any) {
        // Cache the response
        cache.set(cacheKey, data, ttl).catch(error => {
          cacheLogger.error('Failed to cache response', { 
            key: cacheKey, 
            error: error instanceof Error ? error.message : String(error) 
          });
        });

        // Add cache headers
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);

        // Call original json method
        return originalJson(data);
      };

      next();
    } catch (error) {
      cacheLogger.error('Cache middleware error', {
        key: cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Continue without caching on error
      next();
    }
  };
};

export const invalidateCache = async (pattern: string): Promise<void> => {
  try {
    const deletedCount = await cache.invalidatePattern(pattern);
    cacheLogger.info('Cache invalidated', { pattern, deletedCount });
  } catch (error) {
    cacheLogger.error('Cache invalidation failed', {
      pattern,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const invalidateUserCache = async (userId: string): Promise<void> => {
  await invalidateCache(`user:${userId}:*`);
};

export const invalidateMarketCache = async (marketId?: string): Promise<void> => {
  if (marketId) {
    await invalidateCache(`market:${marketId}:*`);
  }
  await invalidateCache('markets:*');
  await invalidateCache('stats:*');
};

export const invalidateTraderCache = async (traderId?: string): Promise<void> => {
  if (traderId) {
    await invalidateCache(`trader:${traderId}:*`);
  }
  await invalidateCache('traders:*');
  await invalidateCache('leaderboard:*');
};

export const invalidateLeaderboardCache = async (): Promise<void> => {
  await invalidateCache('leaderboard:*');
  await invalidateCache('stats:*');
};

function generateCacheKey(req: Request): string {
  const { path, query } = req;
  
  // Sort query parameters for consistent cache keys
  const sortedQuery = Object.keys(query)
    .sort()
    .reduce((result, key) => {
      result[key] = query[key];
      return result;
    }, {} as Record<string, any>);

  const queryString = JSON.stringify(sortedQuery);
  return `api:${path}:${Buffer.from(queryString).toString('base64')}`;
}
