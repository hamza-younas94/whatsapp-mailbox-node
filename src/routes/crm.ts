// src/routes/crm.ts
// CRM API routes

import { Router, Request, Response, NextFunction } from 'express';
import { CRMController } from '@controllers/crm.controller';
import { CRMService } from '@services/crm.service';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';
import { emitToUser } from '@utils/socket-emitter';

const router = Router();


// Initialize dependencies
  const prisma = getPrismaClient();
const service = new CRMService(prisma);
const controller = new CRMController(service);

// Validation schemas
const createDealSchema = z.object({
  title: z.string().min(1),
  contactId: z.string().cuid(),
  value: z.number().optional(),
  stage: z.string(),
  expectedCloseDate: z.string().datetime().optional(),
  description: z.string().optional(),
});

const moveDealSchema = z.object({
  stage: z.string(),
});

const createTransactionSchema = z.object({
  contactId: z.string(),
  amount: z.number(),
  description: z.string().optional(),
  status: z.enum(['pending', 'completed', 'cancelled', 'refunded']).default('pending'),
});

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.post('/', validateRequest(createDealSchema), controller.createDeal);
router.get('/', controller.listDeals);
router.put('/:id', controller.updateDeal);
router.patch('/:id/stage', validateRequest(moveDealSchema), controller.moveStage);
router.get('/stats', controller.getStats);

// Transaction routes
router.get('/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { contactId } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const where: any = { userId };
    if (contactId) {
      where.contactId = contactId as string;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { contact: true }
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
});

router.post('/transactions', validateRequest(createTransactionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { contactId, amount, description, status } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Map status to enum value
    const statusMap: Record<string, string> = {
      'pending': 'PENDING',
      'completed': 'COMPLETED',
      'cancelled': 'CANCELLED',
      'refunded': 'REFUNDED'
    };

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        contactId,
        amount,
        description: description || '',
        status: (statusMap[status] || 'PENDING') as any,
      }
    });

    emitToUser(userId, 'transaction:created', { contactId, data: transaction });
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
});

router.put('/transactions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { amount, description, status } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    await prisma.transaction.update({
      where: { id },
      data: { amount, description, status }
    });

    const updated = await prisma.transaction.findUnique({ where: { id } });
    emitToUser(userId, 'transaction:updated', { contactId: existing.contactId, data: updated });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/transactions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    await prisma.transaction.delete({ where: { id } });
    emitToUser(userId, 'transaction:deleted', { contactId: existing.contactId, id });
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
