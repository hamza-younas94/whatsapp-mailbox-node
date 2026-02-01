// src/middleware/auth.middleware.ts
// JWT authentication and authorization

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getEnv } from '@config/env';
import { UnauthorizedError, ForbiddenError } from '@utils/errors';
import logger from '@utils/logger';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError('Missing or invalid token');
    }

    const payload = jwt.verify(token, getEnv().JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid token');
    }
    throw error;
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (!roles.includes(req.user.role as UserRole)) {
      throw new ForbiddenError(`Requires one of: ${roles.join(', ')}`);
    }

    next();
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

export function generateToken(payload: JwtPayload): string {
  const env = getEnv();
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY || '7d',
  } as jwt.SignOptions);
}

// Export aliases for compatibility
export { authMiddleware as authenticate };
