import { Router } from 'express';
import {
  getTraders,
  getTraderById,
  getTraderStats,
  getTraderTrades,
  getTraderFollowers,
  getTraderFollowing,
  getTradersForCopyTrading,
  validateTraderQuery,
  validatePagination,
  validateId,
  validateTradeQuery,
} from '../controllers/traderController.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { config } from '../config/index.js';

const router: Router = Router();

// Cache middleware with different TTLs
const traderCache = cacheMiddleware({ ttl: config.cache.ttl.traders });
const statsCache = cacheMiddleware({ ttl: config.cache.ttl.stats });

// Trader routes
router.get('/', traderCache, validateTraderQuery, getTraders);
router.get('/copy-trading', traderCache, validatePagination, getTradersForCopyTrading);

// Individual trader routes
router.get('/:id', traderCache, validateId, getTraderById);
router.get('/:id/stats', statsCache, validateId, getTraderStats);
router.get('/:id/trades', validateId, validateTradeQuery, getTraderTrades);
router.get('/:id/followers', traderCache, validateId, validatePagination, getTraderFollowers);
router.get('/:id/following', traderCache, validateId, validatePagination, getTraderFollowing);

export default router;
