// src/repositories/tag.repository.ts
// Tag data access

import { PrismaClient, Tag, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface ITagRepository {
  findByUserId(userId: string): Promise<Tag[]>;
  findByName(userId: string, name: string): Promise<Tag | null>;
  addToContact(contactId: string, tagId: string): Promise<void>;
  removeFromContact(contactId: string, tagId: string): Promise<void>;
  getContactTags(contactId: string): Promise<Tag[]>;
}

export class TagRepository extends BaseRepository<Tag> implements ITagRepository {
  protected modelName = 'tag' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(userId: string): Promise<Tag[]> {
    return this.prisma.tag.findMany({
      where: { userId },
      include: { _count: { select: { contacts: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findByName(userId: string, name: string): Promise<Tag | null> {
    return this.prisma.tag.findUnique({
      where: { userId_name: { userId, name } },
    });
  }

  async addToContact(contactId: string, tagId: string): Promise<void> {
    await this.prisma.tagOnContact.create({
      data: { contactId, tagId },
    });
  }

  async removeFromContact(contactId: string, tagId: string): Promise<void> {
    await this.prisma.tagOnContact.delete({
      where: { contactId_tagId: { contactId, tagId } },
    });
  }

  async getContactTags(contactId: string): Promise<Tag[]> {
    const tags = await this.prisma.tagOnContact.findMany({
      where: { contactId },
      include: { tag: true },
    });
    return tags.map((t) => t.tag);
  }
}
