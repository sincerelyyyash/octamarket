import rateLimit from 'express-rate-limit';
import { config } from '../config/index';
import { logger } from '../utils/logger';

// General rate limiter
export const generalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests from this IP, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    });
  },
});

// Stricter rate limiter for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Higher limit for authenticated users
export const authenticatedRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authenticatedMax,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 'AUTHENTICATED_RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict rate limiter for sensitive operations
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 attempts per minute
  message: {
    success: false,
    error: {
      message: 'Too many attempts, please try again later',
      code: 'STRICT_RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export rate limiter object for easy access
export const rateLimiter = {
  general: generalRateLimit,
  auth: authRateLimit,
  authenticated: authenticatedRateLimit,
  strict: strictRateLimit,
  copyTrading: strictRateLimit, // Use strict rate limit for copy trading operations
};
