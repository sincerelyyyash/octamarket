import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ResponseHelper } from './response';
import { logger } from './logger';

export class ValidationError extends Error {
  constructor(
    message: string,
    public details: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateRequest = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        logger.warn('Validation error', { 
          path: req.path, 
          method: req.method,
          details 
        });
        
        ResponseHelper.validationError(res, 'Validation failed', details);
        return;
      }
      
      logger.error('Validation middleware error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      ResponseHelper.internalError(res);
    }
  };
};

// Common validation schemas
export const commonSchemas = {
  pagination: {
    page: 'number',
    limit: 'number',
  },
  
  id: {
    id: 'string',
  },
  
  search: {
    q: 'string',
  },
} as const;
