import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { validateCreateTrade, createTrade, getTradeStatus, streamTradeStatus, listRecentTrades } from '../controllers/tradeController.js';

const router: Router = Router();

router.post('/', authenticateToken, validateCreateTrade, createTrade);
router.get('/:intentId/status', authenticateToken, getTradeStatus);
router.get('/:intentId/stream', authenticateToken, streamTradeStatus);
router.get('/recent/list', authenticateToken, listRecentTrades);

export default router;


