// src/routes/contacts.ts
// Contact API routes

import { Router } from 'express';
import { z } from 'zod';
import { ContactController } from '@controllers/contact.controller';
import { ContactService } from '@services/contact.service';
import { ContactRepository } from '@repositories/contact.repository';
import { TagRepository } from '@repositories/tag.repository';
import { authMiddleware } from '@middleware/auth.middleware';
import { validate, validateQuery } from '@middleware/validation.middleware';
import getPrismaClient from '@config/database';

export function createContactRoutes(): Router {
  const router = Router();

  const prisma = getPrismaClient();
  const contactRepository = new ContactRepository(prisma);
  const tagRepository = new TagRepository(prisma);
  const contactService = new ContactService(contactRepository, tagRepository);
  const controller = new ContactController(contactService);

  // Validation schemas
  const createContactSchema = z.object({
    phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/),
    name: z.string().optional(),
    email: z.string().email().optional(),
    tags: z.array(z.string()).optional(),
  });

  const updateContactSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
  });

  const searchContactsSchema = z.object({
    search: z.string().optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    engagement: z.enum(['high', 'medium', 'low', 'inactive']).optional(),
    contactType: z.enum(['individual', 'business', 'group', 'broadcast']).optional(),
    isBlocked: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['name', 'lastMessageAt', 'engagementScore', 'messageCount']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    offset: z.coerce.number().min(0).optional(),
    page: z.coerce.number().min(1).optional(),
  });

  // Routes
  router.get(
    '/',
    authMiddleware,
    validateQuery(searchContactsSchema),
    controller.searchContacts,
  );

  router.post(
    '/',
    authMiddleware,
    validate(createContactSchema),
    controller.createContact,
  );

  router.get(
    '/search',
    authMiddleware,
    validateQuery(searchContactsSchema),
    controller.searchContacts,
  );

  router.get(
    '/:contactId',
    authMiddleware,
    controller.getContact,
  );

  router.put(
    '/:contactId',
    authMiddleware,
    validate(updateContactSchema),
    controller.updateContact,
  );

  router.delete(
    '/:contactId',
    authMiddleware,
    controller.deleteContact,
  );

  router.post(
    '/:contactId/block',
    authMiddleware,
    controller.blockContact,
  );

  return router;
}
