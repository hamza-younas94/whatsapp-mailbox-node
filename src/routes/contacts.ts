// src/routes/contacts.ts
// Contact API routes

import { Router } from 'express';
import { z } from 'zod';
import { ContactController } from '@controllers/contact.controller';
import { ContactService } from '@services/contact.service';
import { ContactRepository } from '@repositories/contact.repository';
import { TagRepository } from '@repositories/tag.repository';
import { authMiddleware, requireRole } from '@middleware/auth.middleware';
import { validate, validateQuery } from '@middleware/validation.middleware';
import getPrismaClient from '@config/database';
import { downloadAvatar } from '@utils/avatar';
import logger from '@utils/logger';

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
    company: z.string().optional(),
    department: z.string().optional(),
  });

  const searchContactsSchema = z.object({
    search: z.string().optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    engagement: z.enum(['high', 'medium', 'low', 'inactive']).optional(),
    contactType: z.enum(['individual', 'business', 'group', 'broadcast']).optional(),
    isBlocked: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['name', 'lastMessageAt', 'engagementScore', 'messageCount']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.coerce.number().min(1).max(1000).optional(),
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

  // Bulk & utility routes (must come before /:contactId to avoid param matching)
  router.get('/duplicates', authMiddleware, controller.findDuplicates);

  // Sync avatars: download CDN URLs to local storage
  router.post('/sync-avatars', authMiddleware, async (req, res, next) => {
    try {
      const orgId = (req as any).user?.orgId;
      if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const contacts = await prisma.contact.findMany({
        where: {
          orgId,
          profilePhotoUrl: { not: null },
          NOT: { profilePhotoUrl: { startsWith: '/' } },
        },
        select: { id: true, chatId: true, profilePhotoUrl: true },
      });

      let fixed = 0;
      for (const c of contacts) {
        if (!c.chatId || !c.profilePhotoUrl) continue;
        const localPath = await downloadAvatar(c.chatId, c.profilePhotoUrl);
        if (localPath) {
          await prisma.contact.update({ where: { id: c.id }, data: { profilePhotoUrl: localPath } });
          fixed++;
        }
      }

      logger.info({ total: contacts.length, fixed }, 'Avatar sync completed');
      res.json({ success: true, data: { total: contacts.length, fixed } });
    } catch (error) {
      next(error);
    }
  });

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

  // Bulk operations
  const bulkTagSchema = z.object({
    contactIds: z.array(z.string()).min(1),
    tagId: z.string().min(1),
  });

  const bulkStageSchema = z.object({
    contactIds: z.array(z.string()).min(1),
    stage: z.string().min(1),
  });

  const bulkDeleteSchema = z.object({
    contactIds: z.array(z.string()).min(1),
  });

  const mergeSchema = z.object({
    primaryId: z.string().min(1),
    secondaryId: z.string().min(1),
  });

  router.post('/bulk-tag', authMiddleware, validate(bulkTagSchema), controller.bulkTag);
  router.post('/bulk-stage', authMiddleware, validate(bulkStageSchema), controller.bulkStage);
  router.post('/bulk-delete', authMiddleware, requireRole('ADMIN', 'MANAGER'), validate(bulkDeleteSchema), controller.bulkDelete);
  router.post('/merge', authMiddleware, requireRole('ADMIN', 'MANAGER'), validate(mergeSchema), controller.mergeContacts);

  // CSV Export
  router.get('/export', authMiddleware, async (req, res) => {
    try {
      const orgId = req.user?.orgId;
      const contacts = await prisma.contact.findMany({
        where: { orgId },
        include: { tags: { include: { tag: true } } },
        orderBy: { name: 'asc' },
      });

      const header = 'Phone,Name,Email,Company,Department,Business Name,Tags\n';
      const escapeCSV = (val?: string | null) => {
        if (!val) return '';
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };
      const rows = contacts.map(c => {
        const tags = (c as any).tags?.map((t: any) => t.tag?.name).filter(Boolean).join(';') || '';
        return [c.phoneNumber, c.name, c.email, c.company, c.department, c.businessName, tags]
          .map(escapeCSV).join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=contacts-${new Date().toISOString().slice(0,10)}.csv`);
      res.send(header + rows);
    } catch (error) {
      logger.error({ error }, 'Contact export failed');
      res.status(500).json({ success: false, error: 'Export failed' });
    }
  });

  // CSV Import
  router.post('/import', authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      const orgId = req.user?.orgId;
      if (!userId || !orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
      const { contacts: rows } = req.body as { contacts: Array<{ phoneNumber: string; name?: string; email?: string; company?: string; department?: string; businessName?: string; tags?: string }> };

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No contacts provided' });
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const row of rows) {
        if (!row.phoneNumber) { skipped++; continue; }
        const phone = row.phoneNumber.replace(/[^\d+]/g, '');
        if (phone.length < 7) { errors.push(`Invalid phone: ${row.phoneNumber}`); skipped++; continue; }

        try {
          // Upsert by phoneNumber + orgId
          await prisma.contact.upsert({
            where: { orgId_phoneNumber: { orgId, phoneNumber: phone } },
            create: {
              orgId,
              userId,
              phoneNumber: phone,
              chatId: phone.replace(/^\+/, '') + '@c.us',
              name: row.name || undefined,
              email: row.email || undefined,
              company: row.company || undefined,
              department: row.department || undefined,
              businessName: row.businessName || undefined,
            },
            update: {
              ...(row.name && { name: row.name }),
              ...(row.email && { email: row.email }),
              ...(row.company && { company: row.company }),
              ...(row.department && { department: row.department }),
              ...(row.businessName && { businessName: row.businessName }),
            },
          });

          // Handle tags
          if (row.tags) {
            const tagNames = row.tags.split(';').map(t => t.trim()).filter(Boolean);
            for (const tagName of tagNames) {
              const tag = await prisma.tag.upsert({
                where: { orgId_name: { orgId, name: tagName } },
                create: { orgId, userId, name: tagName },
                update: {},
              });
              const contact = await prisma.contact.findUnique({ where: { orgId_phoneNumber: { orgId, phoneNumber: phone } } });
              if (contact) {
                await prisma.tagOnContact.upsert({
                  where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
                  create: { contactId: contact.id, tagId: tag.id },
                  update: {},
                });
              }
            }
          }
          imported++;
        } catch (err) {
          errors.push(`Failed: ${row.phoneNumber}`);
          skipped++;
        }
      }

      res.json({ success: true, data: { imported, skipped, errors: errors.slice(0, 20) } });
    } catch (error) {
      logger.error({ error }, 'Contact import failed');
      res.status(500).json({ success: false, error: 'Import failed' });
    }
  });

  return router;
}
