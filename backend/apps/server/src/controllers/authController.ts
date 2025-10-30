import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Types
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

const connectWalletSchema = z.object({
  walletAddress: z.string().length(42),
});

// Validation middleware
export const validateRegister = (req: Request, res: Response, next: NextFunction): void => {
  try {
    req.body = registerSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
      });
      return;
    }
    next(error);
  }
};

export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    req.body = loginSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
      });
      return;
    }
    next(error);
  }
};

export const validateUpdateProfile = (req: Request, res: Response, next: NextFunction): void => {
  try {
    req.body = updateProfileSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
      });
      return;
    }
    next(error);
  }
};

export const validateConnectWallet = (req: Request, res: Response, next: NextFunction): void => {
  try {
    req.body = connectWalletSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        },
      });
      return;
    }
    next(error);
  }
};

// Controller functions
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    const result = await authService.register({ name, email, password });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Registration failed', {
      email: req.body.email,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const result = await authService.login({ email, password });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Login failed', {
      email: req.body.email,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const { name, email } = req.body;
    const userId = req.user.id;

    const user = await authService.updateProfile(userId, { name, email });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Profile update failed', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export const connectWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const { walletAddress } = req.body;
    const userId = req.user.id;

    const result = await authService.connectWallet(userId, walletAddress);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Wallet connection failed', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};
