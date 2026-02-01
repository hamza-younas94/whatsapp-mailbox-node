// src/utils/auth-helpers.ts
// Auth utility functions

import { Request } from 'express';

/**
 * Get userId from authenticated request
 * Supports both old tokens (userId only) and new tokens (id + userId)
 */
export function getUserId(req: Request): string | undefined {
  return req.user?.id || req.user?.userId;
}

/**
 * Get userId and throw if not found
 */
export function requireUserId(req: Request): string {
  const userId = getUserId(req);
  if (!userId) {
    throw new Error('User ID not found in request. Please logout and login again.');
  }
  return userId;
}
