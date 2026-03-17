// src/middleware/activity.middleware.ts
// Auto-logs user actions to ActivityLog for audit trail

import { Request, Response, NextFunction } from 'express';
import { PrismaClient, ActivityType } from '@prisma/client';
import logger from '@utils/logger';

let prisma: PrismaClient;

export function initActivityLogger(prismaClient: PrismaClient): void {
  prisma = prismaClient;
}

/**
 * Log an activity to the database (fire-and-forget)
 */
export async function logActivity(
  orgId: string,
  userId: string,
  action: ActivityType,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, any>,
  req?: Request,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        orgId,
        userId,
        action,
        resourceType,
        resourceId,
        details: details || {},
        ipAddress: req?.ip || req?.headers['x-forwarded-for']?.toString(),
        userAgent: req?.headers['user-agent'],
      },
    });
  } catch (error) {
    logger.debug({ error, action, resourceType, resourceId }, 'Failed to log activity (non-critical)');
  }
}

/**
 * Route-level mapping: method + path pattern -> activity type
 */
const ROUTE_ACTIVITY_MAP: Array<{
  method: string;
  pattern: RegExp;
  action: ActivityType;
  resourceType: string;
}> = [
  // Orders
  { method: 'POST', pattern: /\/api\/v1\/orders$/, action: 'ORDER_CREATED', resourceType: 'order' },
  { method: 'PUT', pattern: /\/api\/v1\/orders\//, action: 'ORDER_UPDATED', resourceType: 'order' },
  { method: 'PATCH', pattern: /\/api\/v1\/orders\//, action: 'ORDER_UPDATED', resourceType: 'order' },

  // Invoices
  { method: 'POST', pattern: /\/api\/v1\/invoices$/, action: 'INVOICE_CREATED', resourceType: 'invoice' },
  { method: 'PUT', pattern: /\/api\/v1\/invoices\//, action: 'INVOICE_UPDATED', resourceType: 'invoice' },

  // Tasks
  { method: 'POST', pattern: /\/api\/v1\/tasks$/, action: 'TASK_CREATED', resourceType: 'task' },
  { method: 'PUT', pattern: /\/api\/v1\/tasks\//, action: 'TASK_UPDATED', resourceType: 'task' },
  { method: 'PATCH', pattern: /\/api\/v1\/tasks\//, action: 'TASK_UPDATED', resourceType: 'task' },

  // Contacts
  { method: 'POST', pattern: /\/api\/v1\/contacts$/, action: 'CONTACT_CREATED', resourceType: 'contact' },
  { method: 'PUT', pattern: /\/api\/v1\/contacts\//, action: 'CONTACT_UPDATED', resourceType: 'contact' },
  { method: 'DELETE', pattern: /\/api\/v1\/contacts\//, action: 'CONTACT_DELETED', resourceType: 'contact' },

  // Service Tickets
  { method: 'POST', pattern: /\/api\/v1\/service-tickets$/, action: 'TICKET_CREATED', resourceType: 'serviceTicket' },
  { method: 'PUT', pattern: /\/api\/v1\/service-tickets\//, action: 'TICKET_UPDATED', resourceType: 'serviceTicket' },

  // Products
  { method: 'POST', pattern: /\/api\/v1\/products$/, action: 'PRODUCT_CREATED', resourceType: 'product' },
  { method: 'PUT', pattern: /\/api\/v1\/products\//, action: 'PRODUCT_UPDATED', resourceType: 'product' },

  // Tags
  { method: 'POST', pattern: /\/api\/v1\/tags$/, action: 'TAG_CREATED', resourceType: 'tag' },
  { method: 'DELETE', pattern: /\/api\/v1\/tags\//, action: 'TAG_DELETED', resourceType: 'tag' },

  // Automations
  { method: 'POST', pattern: /\/api\/v1\/automations$/, action: 'AUTOMATION_CREATED', resourceType: 'automation' },
  { method: 'PUT', pattern: /\/api\/v1\/automations\//, action: 'AUTOMATION_UPDATED', resourceType: 'automation' },

  // Notes
  { method: 'POST', pattern: /\/api\/v1\/notes$/, action: 'NOTE_ADDED', resourceType: 'note' },

  // Appointments
  { method: 'POST', pattern: /\/api\/v1\/appointments$/, action: 'APPOINTMENT_CREATED', resourceType: 'appointment' },
  { method: 'PUT', pattern: /\/api\/v1\/appointments\//, action: 'APPOINTMENT_UPDATED', resourceType: 'appointment' },

  // Quick Replies
  { method: 'POST', pattern: /\/api\/v1\/quick-replies$/, action: 'QUICK_REPLY_CREATED', resourceType: 'quickReply' },

  // Messages (manual send)
  { method: 'POST', pattern: /\/api\/v1\/messages$/, action: 'MESSAGE_SENT', resourceType: 'message' },

  // Broadcasts
  { method: 'POST', pattern: /\/api\/v1\/broadcasts\/.*\/send/, action: 'BROADCAST_SENT', resourceType: 'broadcast' },

  // User Management
  { method: 'POST', pattern: /\/api\/v1\/auth\/users$/, action: 'USER_INVITED', resourceType: 'user' },
  { method: 'PUT', pattern: /\/api\/v1\/auth\/users\//, action: 'USER_ROLE_CHANGED', resourceType: 'user' },
  { method: 'DELETE', pattern: /\/api\/v1\/auth\/users\//, action: 'SETTINGS_UPDATED', resourceType: 'user' },
];

/**
 * Middleware that auto-logs write operations (POST/PUT/PATCH/DELETE) to ActivityLog.
 * Only logs on successful responses (2xx).
 */
export function activityLogger(req: Request, res: Response, next: NextFunction): void {
  // Only track write operations
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Hook into response finish to log after success
  // Note: req.user is checked here (at response time) because authenticate middleware
  // may run after this middleware hooks res.end
  const originalEnd = res.end;
  res.end = function (...args: any[]) {
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user?.orgId && req.user?.id) {
      const match = ROUTE_ACTIVITY_MAP.find(
        (r) => r.method === req.method && r.pattern.test(req.originalUrl),
      );

      if (match) {
        const resourceId = req.params?.id || undefined;

        logActivity(
          req.user!.orgId,
          req.user!.id,
          match.action,
          match.resourceType,
          resourceId,
          { method: req.method, path: req.originalUrl },
          req,
        );
      }
    }

    return originalEnd.apply(res, args as [any, BufferEncoding, (() => void)?]);
  } as any;

  next();
}
