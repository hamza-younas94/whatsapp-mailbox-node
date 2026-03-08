// src/routes/scheduled-messages.ts
// Scheduled Messages API routes

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import getPrismaClient from '@config/database';
import logger from '@utils/logger';
import { z } from 'zod';

const router = Router();
const prisma = getPrismaClient();

// Apply auth to all routes
router.use(authenticate);

// Validation schemas
const createSchema = z.object({
  contactId: z.string().min(1),
  message: z.string().min(1),
  scheduledFor: z.string().transform(s => new Date(s)),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
});

const updateSchema = z.object({
  message: z.string().min(1).optional(),
  scheduledFor: z.string().transform(s => new Date(s)).optional(),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
});

// GET / - List scheduled messages with optional status filter
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const status = req.query.status as string | undefined;
    const where: any = { userId };
    if (status) where.status = status;

    const messages = await prisma.scheduledMessage.findMany({
      where,
      orderBy: { scheduledFor: 'asc' },
    });

    // Enrich with contact info
    const contactIds = [...new Set(messages.map(m => m.contactId))];
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, name: true, phoneNumber: true, chatId: true },
    });
    const contactMap = new Map(contacts.map(c => [c.id, c]));

    const enriched = messages.map(m => ({
      ...m,
      contact: contactMap.get(m.contactId) || null,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

// POST / - Create scheduled message
router.post('/', validateRequest(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { contactId, message, scheduledFor, mediaUrl, mediaType } = req.body;

    const scheduled = await prisma.scheduledMessage.create({
      data: {
        userId,
        contactId,
        message,
        scheduledFor: new Date(scheduledFor),
        mediaUrl,
        mediaType,
        status: 'PENDING',
      },
    });

    logger.info({ id: scheduled.id, userId }, 'Scheduled message created');
    res.status(201).json({ success: true, data: scheduled });
  } catch (error) {
    next(error);
  }
});

// PUT /:id - Update (PENDING only)
router.put('/:id', validateRequest(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await prisma.scheduledMessage.findFirst({
      where: { id, userId, status: 'PENDING' },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Scheduled message not found or not editable' });
    }

    const updateData: any = {};
    if (req.body.message) updateData.message = req.body.message;
    if (req.body.scheduledFor) updateData.scheduledFor = new Date(req.body.scheduledFor);
    if (req.body.mediaUrl !== undefined) updateData.mediaUrl = req.body.mediaUrl;
    if (req.body.mediaType !== undefined) updateData.mediaType = req.body.mediaType;

    const updated = await prisma.scheduledMessage.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id - Cancel (set status to CANCELLED)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await prisma.scheduledMessage.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Scheduled message not found' });
    }

    if (existing.status === 'SENT') {
      return res.status(400).json({ success: false, error: 'Cannot cancel a sent message' });
    }

    const updated = await prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
