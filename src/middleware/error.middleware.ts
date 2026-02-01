// src/middleware/error.middleware.ts
// Global error handling middleware

import { Express, Request, Response, NextFunction } from 'express';
import { AppError } from '@utils/errors';
import logger from '@utils/logger';

export function setupErrorMiddleware(app: Express): void {
  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  });

  // Global error handler (must be last)
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ error: error.message, stack: error.stack }, 'Unhandled error');

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    // Default error response
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
}

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
