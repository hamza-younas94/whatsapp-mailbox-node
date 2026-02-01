// src/config/env.ts
// Environment variable validation using Zod

import { z } from 'zod';
import logger from '@utils/logger';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('7d'),

  // WhatsApp API
  WHATSAPP_ACCESS_TOKEN: z.string(),
  WHATSAPP_PHONE_NUMBER_ID: z.string(),
  WEBHOOK_VERIFY_TOKEN: z.string(),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_DB: z.coerce.number().default(0),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

export type Environment = z.infer<typeof envSchema>;

let env: Environment;

export function loadEnv(): Environment {
  try {
    env = envSchema.parse(process.env);
    logger.info('Environment variables validated');
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      logger.error(messages, 'Environment validation failed');
      process.exit(1);
    }
    throw error;
  }
}

export function getEnv(): Environment {
  if (!env) {
    return loadEnv();
  }
  return env;
}

export default getEnv;
