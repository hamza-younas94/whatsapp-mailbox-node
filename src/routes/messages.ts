// src/routes/messages.ts
// Message API routes

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { MessageController } from '@controllers/message.controller';
import { MessageService } from '@services/message.service';
import { MessageRepository } from '@repositories/message.repository';
import { ContactRepository } from '@repositories/contact.repository';
import { ConversationRepository } from '@repositories/conversation.repository';
import { WhatsAppService } from '@services/whatsapp.service';
import { authMiddleware } from '@middleware/auth.middleware';
import { validate, validateQuery } from '@middleware/validation.middleware';
import getPrismaClient from '@config/database';

export function createMessageRoutes(): Router {
  const router = Router();

  const prisma = getPrismaClient();
  const messageRepository = new MessageRepository(prisma);
  const contactRepository = new ContactRepository(prisma);
  const conversationRepository = new ConversationRepository(prisma);
  const whatsAppService = new WhatsAppService();
  const messageService = new MessageService(messageRepository, whatsAppService, contactRepository, conversationRepository);
  const controller = new MessageController(messageService);

  // Validation schemas
  const sendMessageSchema = z.object({
    contactId: z.string().min(1).optional(), // CUID format, not UUID
    phoneNumber: z.string().min(10).max(20).optional(), // More flexible: accept any phone format, normalize in service
    content: z.string().max(4096).optional(),
    mediaUrl: z.string().min(1).optional(), // Accept relative paths like /uploads/media/file.jpg
  }).refine((data) => data.contactId || data.phoneNumber, {
    message: 'Either contactId or phoneNumber is required',
  }).refine((data) => data.content || data.mediaUrl, {
    message: 'Either content or mediaUrl is required',
  });

  const getMessagesSchema = z.object({
    limit: z.coerce.number().min(1).max(100).optional(),
    offset: z.coerce.number().min(0).optional(),
    search: z.string().optional(),
  });

  const listMessagesSchema = z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    search: z.string().optional(),
    direction: z.enum(['inbound', 'outbound']).optional(),
    status: z.enum(['sent', 'delivered', 'read', 'failed', 'pending']).optional(),
  });

  // Routes
  router.get(
    '/',
    authMiddleware,
    validateQuery(listMessagesSchema),
    controller.listMessages,
  );

  router.post(
    '/',
    authMiddleware,
    validate(sendMessageSchema),
    controller.sendMessage,
  );

  router.get(
    '/conversation/:conversationId',
    authMiddleware,
    validateQuery(getMessagesSchema),
    controller.getMessages,
  );

  router.get(
    '/contact/:contactId',
    authMiddleware,
    validateQuery(getMessagesSchema),
    controller.getMessagesByContact,
  );

  router.put(
    '/:messageId/read',
    authMiddleware,
    controller.markAsRead,
  );

  router.post(
    '/:messageId/reaction',
    authMiddleware,
    validate(z.object({
      emoji: z.union([z.string().max(10), z.null()]).optional().transform((val) => val ?? ''),
    })),
    controller.sendReaction,
  );

  router.delete(
    '/:messageId',
    authMiddleware,
    controller.deleteMessage,
  );

  // Webhook endpoint (no auth required)
  router.post('/webhook', controller.webhookReceive);

  // Conversation assignment
  router.patch('/conversations/:id/assign', authMiddleware, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const { assignedToId } = req.body;

      const conversation = await prisma.conversation.findFirst({ where: { id, userId } });
      if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });

      const updated = await prisma.conversation.update({
        where: { id },
        data: { assignedToId: assignedToId || null },
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
