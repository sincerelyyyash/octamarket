import { Router } from 'express';
import {
  getMarkets,
  getMarketById,
  getMarketOutcomes,
  getMarketPriceHistory,
  getActiveMarkets,
  getTrendingMarkets,
  getMarketCategories,
  getMarketTags,
  validateMarketQuery,
  validatePagination,
  validateId,
  validatePriceHistoryQuery,
} from '../controllers/marketController.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { config } from '../config/index.js';

const router = Router();

// Cache middleware with different TTLs
const marketCache = cacheMiddleware({ ttl: config.cache.ttl.markets });
const statsCache = cacheMiddleware({ ttl: config.cache.ttl.stats });

// Market routes
router.get('/', marketCache, validateMarketQuery, getMarkets);
router.get('/active', marketCache, validatePagination, getActiveMarkets);
router.get('/trending', marketCache, validatePagination, getTrendingMarkets);
router.get('/categories', statsCache, getMarketCategories);
router.get('/tags', statsCache, getMarketTags);

// Individual market routes
router.get('/:id', marketCache, validateId, getMarketById);
router.get('/:id/outcomes', marketCache, validateId, getMarketOutcomes);
router.get('/:id/price-history', validateId, validatePriceHistoryQuery, getMarketPriceHistory);

export default router;
