// src/routes/expenses.ts
// Expenses API routes

import { Router } from 'express';
import { ExpenseController } from '@controllers/expense.controller';
import { ExpenseService } from '@services/expense.service';
import { ExpenseRepository } from '@repositories/expense.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

const prisma = getPrismaClient();
const repository = new ExpenseRepository(prisma);
const service = new ExpenseService(repository);
const controller = new ExpenseController(service);

const createSchema = z.object({
  category: z.string().min(1).max(100),
  description: z.string().optional(),
  amount: z.number().min(0.01),
  expenseDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  vendorName: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial();

router.use(authenticate);

router.get('/summary', controller.summary);
router.post('/', validateRequest(createSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id', validateRequest(updateSchema), controller.update);
router.delete('/:id', controller.delete);

export default router;
