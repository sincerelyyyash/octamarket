import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { linkWallet, getBalances, depositWebhook, jupiterQuote, jupiterBuildTx } from '../controllers/solanaController';
import { authenticateSolana } from '../middleware/siws';
import {
  linkWallet,
  getBalances,
  depositWebhook,
  jupiterQuote,
  jupiterBuildTx,
  buildInitUser,
  buildOpenIntent,
  buildCancelIntent,
  buildSetCopyPolicy,
  buildFundEscrow,
  buildWithdrawEscrow,
  getVaultBalance,
} from '../controllers/solanaController';

const router: Router = Router();

// Legacy routes (JWT auth)

router.post('/link', authenticateToken, linkWallet);
router.get('/balances', authenticateToken, getBalances);
router.post('/deposit-webhook', depositWebhook);
router.get('/jupiter/quote', authenticateToken, jupiterQuote);
router.post('/jupiter/build', authenticateToken, jupiterBuildTx);

// On-chain program routes (SIWS auth)
router.post('/init-user/build', authenticateSolana, buildInitUser);
router.post('/intents/build', authenticateSolana, buildOpenIntent);
router.post('/intents/cancel/build', authenticateSolana, buildCancelIntent);
router.post('/copy/policy/build', authenticateSolana, buildSetCopyPolicy);
router.post('/copy/escrow/deposit/build', authenticateSolana, buildFundEscrow);
router.post('/copy/escrow/withdraw/build', authenticateSolana, buildWithdrawEscrow);
router.get('/vault/balance', authenticateSolana, getVaultBalance);

export default router;


