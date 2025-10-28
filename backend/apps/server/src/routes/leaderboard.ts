import { Router } from 'express';
import {
  getLeaderboard,
  getSourceLeaderboard,
  getLeaderboardSnapshots,
  getTopTraders,
  getRisingTraders,
  validateLeaderboardQuery,
  validateSnapshotQuery,
  validatePagination,
} from '../controllers/leaderboardController.js';
import { cacheMiddleware } from '../middleware/cache.js';
import { config } from '../config/index.js';

const router: Router = Router();

// Cache middleware with different TTLs
const leaderboardCache = cacheMiddleware({ ttl: config.cache.ttl.leaderboards });
const statsCache = cacheMiddleware({ ttl: config.cache.ttl.stats });

// Leaderboard routes
router.get('/', leaderboardCache, validateLeaderboardQuery, getLeaderboard);
router.get('/top', leaderboardCache, validatePagination, getTopTraders);
router.get('/rising', leaderboardCache, validatePagination, getRisingTraders);
router.get('/snapshots', statsCache, validateSnapshotQuery, getLeaderboardSnapshots);

// Source-specific leaderboard
router.get('/:source', leaderboardCache, validateLeaderboardQuery, getSourceLeaderboard);

export default router;