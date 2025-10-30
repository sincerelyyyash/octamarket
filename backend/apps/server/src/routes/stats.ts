import { Router } from 'express';
import {
  getPlatformStats,
  getMarketStats,
  getSourceStats,
  getTraderStats,
  getLeaderboardStats,
  validatePagination,
  validateTimeframe,
} from '../controllers/statsController';
import { cacheMiddleware } from '../middleware/cache';
import { config } from '../config/index';

const router: Router = Router();

// Cache middleware with longer TTL for stats
const statsCache = cacheMiddleware({ ttl: config.cache.ttl.stats });

// Stats routes
router.get('/platform', statsCache, validateTimeframe, getPlatformStats);
router.get('/markets', statsCache, validatePagination, getMarketStats);
router.get('/sources', statsCache, validateTimeframe, getSourceStats);
router.get('/traders', statsCache, validatePagination, getTraderStats);
router.get('/leaderboard', statsCache, validatePagination, getLeaderboardStats);

export default router;