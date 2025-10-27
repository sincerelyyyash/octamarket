import { Router } from 'express';
import {
  followTrader,
  unfollowTrader,
  updateCopySettings,
  getMyFollows,
  getCopyTradingStats,
  validateFollowTrader,
  validateUpdateSettings,
  validatePagination,
  validateTraderId,
  validateFollowId,
} from '../controllers/copyTradingController.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// All copy trading routes require authentication
router.use(authenticate);

// Copy trading routes with rate limiting
router.post('/follow', rateLimiter.copyTrading, validateFollowTrader, followTrader);
router.delete('/unfollow/:traderId', rateLimiter.copyTrading, validateTraderId, unfollowTrader);
router.patch('/settings/:followId', rateLimiter.copyTrading, validateFollowId, validateUpdateSettings, updateCopySettings);
router.get('/my-follows', validatePagination, getMyFollows);
router.get('/stats', getCopyTradingStats);

export default router;