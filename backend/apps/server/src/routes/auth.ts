import { Router } from 'express';
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

const router = Router();

// Auth routes with rate limiting
router.post('/register', rateLimiter.auth, validateRegister, register);
router.post('/login', rateLimiter.auth, validateLogin, login);

// Protected routes
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, rateLimiter.copyTrading, validateUpdateProfile, updateProfile);
router.post('/wallet/connect', authenticate, rateLimiter.copyTrading, validateConnectWallet, connectWallet);

export default router;
