// src/middleware/rate-limit.middleware.ts
// Rate limiting middleware for API endpoints

import rateLimit from 'express-rate-limit';

/**
 * Create a rate limiter with custom window and max requests
 */
export function createRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please try again after ${Math.ceil(windowMs / 1000)} seconds.`,
      },
    },
  });
}

// Pre-configured limiters matching PHP rate limits
export const globalLimiter = createRateLimiter(60 * 1000, 300);       // 300 req/min
export const sendMessageLimiter = createRateLimiter(60 * 1000, 60);   // 60 req/min
export const sendMediaLimiter = createRateLimiter(60 * 1000, 30);     // 30 req/min
export const bulkOperationLimiter = createRateLimiter(60 * 1000, 20); // 20 req/min
export const authLimiter = createRateLimiter(15 * 60 * 1000, 10);     // 10 req/15min
