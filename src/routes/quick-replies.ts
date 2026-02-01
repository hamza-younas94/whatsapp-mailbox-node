// src/routes/quick-replies.ts
// Quick replies API routes

import { Router } from 'express';
import { QuickReplyController } from '@controllers/quick-reply.controller';
import { QuickReplyService } from '@services/quick-reply.service';
import { QuickReplyRepository } from '@repositories/quick-reply.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();


// Initialize dependencies
  const prisma = getPrismaClient();
const repository = new QuickReplyRepository(prisma);
const service = new QuickReplyService(repository);
const controller = new QuickReplyController(service);

// Validation schemas
const createQuickReplySchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  shortcut: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
});

const searchSchema = z.object({
  q: z.string().min(1),
});

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.post('/', validateRequest(createQuickReplySchema), controller.create);
router.get('/', controller.list);
router.get('/search', validateRequest(searchSchema), controller.search);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;
