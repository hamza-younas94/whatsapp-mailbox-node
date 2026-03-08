// src/routes/message-templates.ts
// Message Templates API routes

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import getPrismaClient from '@config/database';
import logger from '@utils/logger';
import { z } from 'zod';

const router = Router();
const prisma = getPrismaClient();

router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  language: z.string().default('en'),
  content: z.string().min(1),
  variables: z.array(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.string().min(1).max(50).optional(),
  language: z.string().optional(),
  content: z.string().min(1).optional(),
  variables: z.array(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

// GET / - List all templates with optional filters
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, language, search } = req.query;
    const where: any = {};

    if (category) where.category = category;
    if (language) where.language = language;
    if (search) where.name = { contains: search as string };

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
});

// GET /:id - Get single template
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.messageTemplate.findUnique({
      where: { id: req.params.id },
    });

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
});

// POST / - Create template (ADMIN/MANAGER only)
router.post('/', requireRole('ADMIN', 'MANAGER'), validateRequest(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, language, content, variables, metadata } = req.body;

    const template = await prisma.messageTemplate.create({
      data: {
        name,
        category,
        language: language || 'en',
        content,
        variables: variables || [],
        metadata: metadata || {},
      },
    });

    logger.info({ templateId: template.id }, 'Message template created');
    res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Template with this name and language already exists' });
    }
    next(error);
  }
});

// PUT /:id - Update template (ADMIN/MANAGER only)
router.put('/:id', requireRole('ADMIN', 'MANAGER'), validateRequest(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.messageTemplate.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const template = await prisma.messageTemplate.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json({ success: true, data: template });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Template with this name and language already exists' });
    }
    next(error);
  }
});

// DELETE /:id - Delete template (ADMIN/MANAGER only)
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.messageTemplate.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    await prisma.messageTemplate.delete({ where: { id: req.params.id } });

    logger.info({ templateId: req.params.id }, 'Message template deleted');
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
