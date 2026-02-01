// src/middleware/validation.middleware.ts
// Input validation using Zod

import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '@utils/errors';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      const message = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new ValidationError(message || 'Validation failed');
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated as any;
      next();
    } catch (error: any) {
      const message = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new ValidationError(message || 'Validation failed');
    }
  };
}

// Export alias for compatibility
export { validate as validateRequest };
