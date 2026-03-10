// src/routes/labels.ts
// Labels API routes for conversation labeling

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import getPrismaClient from '@config/database';
import logger from '@utils/logger';
import { z } from 'zod';

const router = Router();
const prisma = getPrismaClient();

router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  icon: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
});

const assignSchema = z.object({
  conversationId: z.string().min(1),
  labelId: z.string().min(1),
});

// GET / - List org's labels
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const labels = await prisma.label.findMany({
      where: { orgId },
      include: { _count: { select: { conversations: true } } },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: labels });
  } catch (error) {
    next(error);
  }
});

// POST / - Create label
router.post('/', validateRequest(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;
    if (!userId || !orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const label = await prisma.label.create({
      data: { orgId, userId, ...req.body },
    });

    logger.info({ labelId: label.id, userId, orgId }, 'Label created');
    res.status(201).json({ success: true, data: label });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Label with this name already exists' });
    }
    next(error);
  }
});

// PUT /:id - Update label
router.put('/:id', validateRequest(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await prisma.label.findFirst({ where: { id, orgId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Label not found' });
    }

    const label = await prisma.label.update({
      where: { id },
      data: req.body,
    });

    res.json({ success: true, data: label });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Label with this name already exists' });
    }
    next(error);
  }
});

// DELETE /:id - Delete label
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await prisma.label.findFirst({ where: { id, orgId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Label not found' });
    }

    await prisma.label.delete({ where: { id } });

    logger.info({ labelId: id }, 'Label deleted');
    res.json({ success: true, message: 'Label deleted' });
  } catch (error) {
    next(error);
  }
});

// POST /assign - Assign label to conversation
router.post('/assign', validateRequest(assignSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { conversationId, labelId } = req.body;

    // Verify label belongs to org
    const label = await prisma.label.findFirst({ where: { id: labelId, orgId } });
    if (!label) {
      return res.status(404).json({ success: false, error: 'Label not found' });
    }

    const assignment = await prisma.conversationLabel.upsert({
      where: { conversationId_labelId: { conversationId, labelId } },
      create: { conversationId, labelId },
      update: {},
    });

    res.json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
});

// POST /remove - Remove label from conversation
router.post('/remove', validateRequest(assignSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { conversationId, labelId } = req.body;

    await prisma.conversationLabel.deleteMany({
      where: { conversationId, labelId },
    });

    res.json({ success: true, message: 'Label removed from conversation' });
  } catch (error) {
    next(error);
  }
});

// GET /conversation/:conversationId - Get labels for a conversation
router.get('/conversation/:conversationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const labels = await prisma.conversationLabel.findMany({
      where: { conversationId: req.params.conversationId },
      include: { label: true },
    });

    res.json({ success: true, data: labels.map(cl => cl.label) });
  } catch (error) {
    next(error);
  }
});

export default router;
