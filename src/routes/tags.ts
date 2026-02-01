// src/routes/tags.ts
// Tags API routes

import { Router } from 'express';
import { TagController } from '@controllers/tag.controller';
import { TagService } from '@services/tag.service';
import { TagRepository } from '@repositories/tag.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();


// Initialize dependencies
  const prisma = getPrismaClient();
const repository = new TagRepository(prisma);
const service = new TagService(repository);
const controller = new TagController(service);

// Validation schemas
// Accept both color names (blue, green, red, etc.) and hex codes
const validColors = ['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'orange', 'gray', 'cyan', 'indigo', 'teal'];
const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().refine(
    (val) => validColors.includes(val) || /^#[0-9A-Fa-f]{6}$/.test(val),
    { message: 'Color must be a valid color name or hex code' }
  ).optional(),
  description: z.string().max(255).optional(),
});

const addTagToContactSchema = z.object({
  contactId: z.string().cuid(),
  tagId: z.string().cuid(),
});

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.post('/', validateRequest(createTagSchema), controller.create);
router.get('/', controller.list);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
router.post('/contacts', validateRequest(addTagToContactSchema), controller.addToContact);
router.delete('/contacts/:contactId/:tagId', controller.removeFromContact);

export default router;
