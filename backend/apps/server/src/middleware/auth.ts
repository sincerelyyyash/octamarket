import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { ResponseHelper } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      ResponseHelper.unauthorized(res, 'Access token required');
      return;
    }

    const payload = authService.verifyToken(token);
    
    // Get user details
    const user = await authService.getUserById(payload.userId);
    
    req.user = user;
    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      path: req.path,
      method: req.method,
      error: error instanceof Error ? error.message : String(error),
    });
    
    ResponseHelper.unauthorized(res, 'Invalid or expired token');
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const payload = authService.verifyToken(token);
      const user = await authService.getUserById(payload.userId);
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

export const requireAuth = authenticateToken;
export const authenticate = authenticateToken;
