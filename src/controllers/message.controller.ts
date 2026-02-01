// src/controllers/message.controller.ts
// Message HTTP request handlers

import { Request, Response } from 'express';
import { MessageService } from '@services/message.service';
import { asyncHandler } from '@middleware/error.middleware';
import logger from '@utils/logger';
import { requireUserId } from '@utils/auth-helpers';

interface CreateMessageInput {
  phoneNumber?: string;
  contactId?: string;
  content: string;
  messageType?: string;
  mediaUrl?: string;
  mediaType?: string;
}

export class MessageController {
  constructor(private messageService: MessageService) {}

  listMessages = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { page = 1, limit = 20, search, direction, status } = req.query;

    const filters = {
      query: search as string | undefined,
      direction: direction as string | undefined,
      status: status as string | undefined,
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
    };

    const result = await this.messageService.listMessages(userId, filters);

    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  });

  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const { contactId, phoneNumber, content, mediaUrl } = req.body;
    const userId = requireUserId(req);

    const input: CreateMessageInput = {
      phoneNumber,
      contactId,
      content,
      mediaUrl,
    };

    const message = await this.messageService.sendMessage(userId, input as any);

    res.status(201).json({
      success: true,
      data: message,
    });
  });

  getMessages = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user!.id;

    const result = await this.messageService.getMessages(
      userId,
      conversationId,
      parseInt(limit as string),
      parseInt(offset as string),
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  getMessagesByContact = asyncHandler(async (req: Request, res: Response) => {
    const { contactId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = requireUserId(req);

    const result = await this.messageService.getMessagesByContact(
      userId,
      contactId,
      parseInt(limit as string),
      parseInt(offset as string),
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const { messageId } = req.params;

    const message = await this.messageService.markAsRead(messageId);

    res.status(200).json({
      success: true,
      data: message,
    });
  });

  sendReaction = asyncHandler(async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = requireUserId(req);

    const safeEmoji = typeof emoji === 'string' ? emoji : '';
    await this.messageService.sendReaction(userId, messageId, safeEmoji);

    res.status(200).json({
      success: true,
      message: 'Reaction sent',
    });
  });

  deleteMessage = asyncHandler(async (req: Request, res: Response) => {
    const { messageId } = req.params;

    await this.messageService.deleteMessage(messageId);

    res.status(200).json({
      success: true,
      message: 'Message deleted',
    });
  });

  webhookReceive = asyncHandler(async (req: Request, res: Response) => {
    // WhatsApp webhook handler
    const payload = req.body;

    logger.info({ payload }, 'Received webhook');

    // Verify webhook signature
    // ... verification logic

    // Process message
    if (payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const message = payload.entry[0].changes[0].value.messages[0];
      // Handle message...
    }

    res.status(200).json({ success: true });
  });
}
