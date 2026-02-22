// src/routes/customer-subscriptions.ts
// Customer Subscriptions API routes

import { Router } from 'express';
import { CustomerSubscriptionController } from '@controllers/customer-subscription.controller';
import { CustomerSubscriptionService } from '@services/customer-subscription.service';
import { CustomerSubscriptionRepository } from '@repositories/customer-subscription.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

const prisma = getPrismaClient();
const repository = new CustomerSubscriptionRepository(prisma);
const service = new CustomerSubscriptionService(repository);
const controller = new CustomerSubscriptionController(service);

const createSchema = z.object({
  contactId: z.string().min(1),
  planName: z.string().min(1).max(100),
  description: z.string().optional(),
  billingCycle: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  amount: z.number().min(0.01),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  nextBillingDate: z.string().optional(),
  autoRenew: z.boolean().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  planName: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  billingCycle: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  amount: z.number().min(0.01).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'SUB_CANCELLED', 'EXPIRED']).optional(),
  endDate: z.string().optional(),
  nextBillingDate: z.string().optional(),
  autoRenew: z.boolean().optional(),
  notes: z.string().optional(),
});

router.use(authenticate);

router.post('/', validateRequest(createSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id', validateRequest(updateSchema), controller.update);
router.delete('/:id', controller.delete);

export default router;
