import { Request, Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export class ResponseHelper {
  static success<T>(res: Response, data: T, meta?: PaginationMeta, statusCode = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
    };

    if (meta) {
      response.meta = meta;
    }

    res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message: string,
    code: string,
    statusCode = 400,
    details?: any
  ): void {
    const response: ApiResponse = {
      success: false,
      error: {
        message,
        code,
        details,
      },
    };

    res.status(statusCode).json(response);
  }

  static notFound(res: Response, message = 'Resource not found'): void {
    this.error(res, message, 'NOT_FOUND', 404);
  }

  static unauthorized(res: Response, message = 'Unauthorized'): void {
    this.error(res, message, 'UNAUTHORIZED', 401);
  }

  static forbidden(res: Response, message = 'Forbidden'): void {
    this.error(res, message, 'FORBIDDEN', 403);
  }

  static badRequest(res: Response, message = 'Bad request', details?: any): void {
    this.error(res, message, 'BAD_REQUEST', 400, details);
  }

  static internalError(res: Response, message = 'Internal server error'): void {
    this.error(res, message, 'INTERNAL_ERROR', 500);
  }

  static validationError(res: Response, message = 'Validation error', details?: any): void {
    this.error(res, message, 'VALIDATION_ERROR', 422, details);
  }
}

export const pagination = {
  parseQuery(req: Request): { page: number; limit: number; offset: number } {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  },

  createMeta(page: number, limit: number, total: number): PaginationMeta {
    return {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  },
};
