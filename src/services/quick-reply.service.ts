// src/services/quick-reply.service.ts
// Quick reply business logic

import { QuickReply } from '@prisma/client';
import { QuickReplyRepository } from '@repositories/quick-reply.repository';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateQuickReplyInput {
  title: string;
  content: string;
  category?: string;
  shortcut?: string;
}

export interface IQuickReplyService {
  createQuickReply(userId: string, input: CreateQuickReplyInput): Promise<QuickReply>;
  getQuickReplies(userId: string): Promise<QuickReply[]>;
  getQuickReplyById(id: string): Promise<QuickReply>;
  searchQuickReplies(userId: string, query: string): Promise<QuickReply[]>;
  updateQuickReply(id: string, data: Partial<QuickReply>): Promise<QuickReply>;
  deleteQuickReply(id: string): Promise<void>;
}

export class QuickReplyService implements IQuickReplyService {
  constructor(private repository: QuickReplyRepository) {}

  async createQuickReply(userId: string, input: CreateQuickReplyInput): Promise<QuickReply> {
    try {
      // Validate required fields
      if (!input.title || !input.content) {
        throw new ValidationError('Title and content are required');
      }

      // Validate shortcut uniqueness if provided
      if (input.shortcut) {
        const existing = await this.repository.findByShortcut(userId, input.shortcut);
        if (existing) {
          throw new ConflictError(`Shortcut '${input.shortcut}' already exists`);
        }
      }

      const quickReply = await this.repository.create({
        userId,
        title: input.title,
        content: input.content,
        category: input.category || null,
        shortcut: input.shortcut || null,
      } as any);

      logger.info({ id: quickReply.id }, 'Quick reply created');
      return quickReply;
    } catch (error) {
      logger.error({ input, error }, 'Failed to create quick reply');
      throw error;
    }
  }

  async getQuickReplies(userId: string): Promise<QuickReply[]> {
    return this.repository.findByUserId(userId);
  }

  async getQuickReplyById(id: string): Promise<QuickReply> {
    const quickReply = await this.repository.findById(id);
    if (!quickReply) {
      throw new NotFoundError('Quick reply');
    }
    return quickReply;
  }

  async searchQuickReplies(userId: string, query: string): Promise<QuickReply[]> {
    return this.repository.search(userId, query);
  }

  async updateQuickReply(id: string, data: Partial<QuickReply>): Promise<QuickReply> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Quick reply');
    }

    return this.repository.update(id, data);
  }

  async deleteQuickReply(id: string): Promise<void> {
    await this.repository.delete(id);
    logger.info({ id }, 'Quick reply deleted');
  }
}
