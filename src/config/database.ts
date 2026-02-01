// src/config/database.ts
// Database configuration and Prisma client

import { PrismaClient } from '@prisma/client';
import logger from '@utils/logger';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    }) as any;

    // Log queries in development
    (prisma as any).$on('query', (e: any) => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug({ query: e.query, params: e.params }, 'DB Query');
      }
    });

    (prisma as any).$on('error', (e: any) => {
      logger.error({ error: e.message }, 'DB Error');
    });

    (prisma as any).$on('warn', (e: any) => {
      logger.warn({ warning: e.message }, 'DB Warning');
    });
  }

  return prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    const client = getPrismaClient();
    await client.$connect();
    logger.info('Database connected');
  } catch (error) {
    logger.error(error, 'Database connection failed');
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  }
}

export default getPrismaClient;
