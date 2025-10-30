import { Router, type RequestHandler } from 'express';
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
} from '../controllers/copyTradingController';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router: Router = Router();

router.use(authenticate);


router.post('/follow', rateLimiter.copyTrading as unknown as RequestHandler, validateFollowTrader, followTrader);
router.delete('/unfollow/:traderId', rateLimiter.copyTrading as unknown as RequestHandler, validateTraderId, unfollowTrader);
router.patch('/settings/:followId', rateLimiter.copyTrading as unknown as RequestHandler, validateFollowId, validateUpdateSettings, updateCopySettings);
router.get('/my-follows', validatePagination, getMyFollows);
router.get('/stats', getCopyTradingStats);

export default router;