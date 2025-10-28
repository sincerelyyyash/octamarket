import { Router, type RequestHandler } from 'express';
import { 
  register, 
  login, 
  getMe, 
  updateProfile, 
  connectWallet,
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateConnectWallet
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router: Router = Router();

// Auth routes with rate limiting
router.post('/register', rateLimiter.auth as unknown as RequestHandler, validateRegister, register);
router.post('/login', rateLimiter.auth as unknown as RequestHandler, validateLogin, login);

// Protected routes
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, rateLimiter.copyTrading as unknown as RequestHandler, validateUpdateProfile, updateProfile);
router.post('/wallet/connect', authenticate, rateLimiter.copyTrading as unknown as RequestHandler, validateConnectWallet, connectWallet);

export default router;
