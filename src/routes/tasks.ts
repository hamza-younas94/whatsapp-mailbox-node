// src/routes/tasks.ts
// Tasks API routes

import { Router } from 'express';
import { TaskController } from '@controllers/task.controller';
import { TaskService } from '@services/task.service';
import { TaskRepository } from '@repositories/task.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

const prisma = getPrismaClient();
const repository = new TaskRepository(prisma);
const service = new TaskService(repository);
const controller = new TaskController(service);

const createSchema = z.object({
  contactId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['TASK_LOW', 'TASK_MEDIUM', 'TASK_HIGH', 'TASK_URGENT']).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['TASK_LOW', 'TASK_MEDIUM', 'TASK_HIGH', 'TASK_URGENT']).optional(),
  status: z.enum(['TASK_PENDING', 'TASK_IN_PROGRESS', 'TASK_COMPLETED', 'TASK_CANCELLED']).optional(),
  contactId: z.string().optional(),
});

router.use(authenticate);

router.post('/', validateRequest(createSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id', validateRequest(updateSchema), controller.update);
router.delete('/:id', controller.delete);

export default router;
