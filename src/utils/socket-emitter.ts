// src/utils/socket-emitter.ts
// Emit real-time events to connected clients

import { io } from '../server';
import { Request, Response, NextFunction } from 'express';

export function emitToUser(userId: string, event: string, data: any): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Wrap a route handler to emit a socket event after a successful response.
 * Intercepts res.json() to capture the response data and emit.
 */
export function withEmit(
  handler: (req: Request, res: Response, next: NextFunction) => any,
  event: string,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const origJson = res.json.bind(res);
    res.json = function (body: any) {
      if (body?.success !== false) {
        const userId = (req as any).user?.id;
        if (userId) {
          emitToUser(userId, event, {
            contactId: req.body?.contactId || body?.data?.contactId || req.params?.contactId,
            data: body?.data,
            id: req.params?.id,
          });
        }
      }
      return origJson(body);
    } as any;
    return handler(req, res, next);
  };
}
