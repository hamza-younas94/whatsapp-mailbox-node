// src/routes/auto-tag-rules.ts
// Auto-Tag Rules API routes

import { Router } from 'express';
import { AutoTagRuleController } from '@controllers/auto-tag-rule.controller';
import { AutoTagRuleService } from '@services/auto-tag-rule.service';
import { AutoTagRuleRepository } from '@repositories/auto-tag-rule.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

const prisma = getPrismaClient();
const repository = new AutoTagRuleRepository(prisma);
const service = new AutoTagRuleService(repository);
const controller = new AutoTagRuleController(service);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  conditions: z.array(z.object({
    type: z.string(),
    operator: z.string().optional(),
    value: z.any(),
  })).min(1),
  tagId: z.string().min(1),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

router.use(authenticate);

router.post('/', validateRequest(createSchema), controller.create);
router.get('/', controller.list);
router.put('/:id', validateRequest(updateSchema), controller.update);
router.delete('/:id', controller.delete);
router.post('/:id/execute', controller.execute);

export default router;
