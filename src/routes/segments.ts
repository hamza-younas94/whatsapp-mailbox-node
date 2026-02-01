// src/routes/segments.ts
// Segments API routes

import { Router, Request, Response, NextFunction } from 'express';
import { SegmentController } from '@controllers/segment.controller';
import { SegmentService } from '@services/segment.service';
import { SegmentRepository } from '@repositories/segment.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();


// Initialize dependencies
  const prisma = getPrismaClient();
const repository = new SegmentRepository(prisma);
const service = new SegmentService(repository);
const controller = new SegmentController(service);

// Validation schemas - support both array and object conditions
const createSegmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  conditions: z.union([z.array(z.any()), z.record(z.any())]),
  logic: z.enum(['AND', 'OR']).optional(),
});

// Apply authentication to all routes
router.use(authenticate);

// Preview endpoint - calculate matching contacts without saving
router.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { conditions, logic } = req.body;
    
    // For now, return a placeholder count - in production, this would query contacts
    // based on the conditions
    const count = await prisma.contact.count({
      where: { userId }
    });

    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

// Routes
router.post('/', validateRequest(createSegmentSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const segment = await prisma.segment.findFirst({
      where: { id, userId }
    });

    if (!segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    res.json({ success: true, data: segment });
  } catch (error) {
    next(error);
  }
});
router.get('/:id/contacts', controller.getContacts);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;
