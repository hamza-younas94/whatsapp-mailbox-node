// src/services/scheduled-message.service.ts
// Scheduled message management with queue

import { Message, PrismaClient } from '@prisma/client';
import { MessageRepository } from '@repositories/message.repository';
import { WhatsAppService } from './whatsapp.service';
import { NotFoundError } from '@utils/errors';
import logger from '@utils/logger';

export interface ScheduleMessageInput {
  contactId: string;
  content: string;
  mediaUrl?: string;
  scheduledAt: Date;
}

export interface IScheduledMessageService {
  scheduleMessage(userId: string, input: ScheduleMessageInput): Promise<Message>;
  getScheduledMessages(userId: string): Promise<Message[]>;
  cancelScheduledMessage(messageId: string): Promise<void>;
  processDueMessages(): Promise<void>;
}

export class ScheduledMessageService implements IScheduledMessageService {
  constructor(
    private messageRepository: MessageRepository,
    private whatsAppService: WhatsAppService,
    private prisma: PrismaClient
  ) {}

  async scheduleMessage(userId: string, input: ScheduleMessageInput): Promise<Message> {
    if (input.scheduledAt <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    const message = await this.messageRepository.create({
      userId,
      contactId: input.contactId,
      conversationId: input.contactId, // Simplified
      content: input.content,
      messageType: 'TEXT',
      direction: 'OUTGOING',
      status: 'PENDING',
      scheduledAt: input.scheduledAt,
      mediaUrl: input.mediaUrl,
    } as any);

    logger.info({ id: message.id, scheduledAt: input.scheduledAt }, 'Message scheduled');
    return message;
  }

  async getScheduledMessages(userId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: {
        userId,
        status: 'PENDING',
        scheduledAt: { not: null },
      },
      orderBy: { scheduledAt: 'asc' },
    } as any);
  }

  async cancelScheduledMessage(messageId: string): Promise<void> {
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundError('Message');
    }

    if (message.status !== 'PENDING') {
      throw new Error('Can only cancel pending messages');
    }

    await this.messageRepository.delete(messageId);
    logger.info({ messageId }, 'Scheduled message cancelled');
  }

  async processDueMessages(): Promise<void> {
    const now = new Date();

    // Find messages that are due
    const dueMessages = await this.prisma.message.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
      take: 100, // Process 100 at a time
    } as any);

    for (const message of dueMessages) {
      try {
        // Send via WhatsApp
        const result = await this.whatsAppService.sendMessage(
          message.contactId,
          message.content || '',
          message.mediaUrl || undefined,
        );

        // Update message status
        await this.messageRepository.update(message.id, {
          status: 'SENT',
          waMessageId: result.messageId,
          sendAt: new Date(),
        });

        logger.info({ messageId: message.id }, 'Scheduled message sent');
      } catch (error) {
        logger.error({ messageId: message.id, error }, 'Failed to send scheduled message');
        await this.messageRepository.update(message.id, { status: 'FAILED' });
      }
    }
  }
}
