import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { linkWallet, getBalances, depositWebhook, jupiterQuote, jupiterBuildTx } from '../controllers/solanaController.js';

const router: Router = Router();

router.post('/link', authenticateToken, linkWallet);
router.get('/balances', authenticateToken, getBalances);
router.post('/deposit-webhook', depositWebhook);
router.get('/jupiter/quote', authenticateToken, jupiterQuote);
router.post('/jupiter/build', authenticateToken, jupiterBuildTx);

export default router;


