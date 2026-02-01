// src/services/tag.service.ts
// Tag management business logic

import { Tag } from '@prisma/client';
import { TagRepository } from '@repositories/tag.repository';
import { NotFoundError, ConflictError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface ITagService {
  createTag(userId: string, input: CreateTagInput): Promise<Tag>;
  getTags(userId: string): Promise<Tag[]>;
  updateTag(id: string, data: Partial<Tag>): Promise<Tag>;
  deleteTag(id: string): Promise<void>;
  addTagToContact(contactId: string, tagId: string): Promise<void>;
  removeTagFromContact(contactId: string, tagId: string): Promise<void>;
  getContactTags(contactId: string): Promise<Tag[]>;
}

export class TagService implements ITagService {
  constructor(private repository: TagRepository) {}

  async createTag(userId: string, input: CreateTagInput): Promise<Tag> {
    try {
      // Check for duplicate name
      const existing = await this.repository.findByName(userId, input.name);
      if (existing) {
        throw new ConflictError(`Tag '${input.name}' already exists`);
      }

      const tag = await this.repository.create({
        userId,
        name: input.name,
        color: input.color || '#3B82F6',
      });

      logger.info({ id: tag.id }, 'Tag created');
      return tag;
    } catch (error) {
      logger.error({ input, error }, 'Failed to create tag');
      throw error;
    }
  }

  async getTags(userId: string): Promise<Tag[]> {
    return this.repository.findByUserId(userId);
  }

  async updateTag(id: string, data: Partial<Tag>): Promise<Tag> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Tag');
    }

    return this.repository.update(id, data);
  }

  async deleteTag(id: string): Promise<void> {
    await this.repository.delete(id);
    logger.info({ id }, 'Tag deleted');
  }

  async addTagToContact(contactId: string, tagId: string): Promise<void> {
    try {
      await this.repository.addToContact(contactId, tagId);
      logger.info({ contactId, tagId }, 'Tag added to contact');
    } catch (error) {
      logger.error({ contactId, tagId, error }, 'Failed to add tag to contact');
      throw error;
    }
  }

  async removeTagFromContact(contactId: string, tagId: string): Promise<void> {
    await this.repository.removeFromContact(contactId, tagId);
    logger.info({ contactId, tagId }, 'Tag removed from contact');
  }

  async getContactTags(contactId: string): Promise<Tag[]> {
    return this.repository.getContactTags(contactId);
  }
}
