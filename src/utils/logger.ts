// src/utils/logger.ts
// High-performance logging with Pino

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const level = process.env.LOG_LEVEL || 'info';

const transport = isDevelopment
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino(
  {
    level,
    transport,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
);

export default logger;
