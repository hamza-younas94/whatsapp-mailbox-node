// src/repositories/tag.repository.ts
// Tag data access

import { PrismaClient, Tag, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface ITagRepository {
  findByUserId(orgId: string): Promise<Tag[]>;
  findByName(orgId: string, name: string): Promise<Tag | null>;
  addToContact(contactId: string, tagId: string): Promise<void>;
  removeFromContact(contactId: string, tagId: string): Promise<void>;
  getContactTags(contactId: string): Promise<Tag[]>;
}

export class TagRepository extends BaseRepository<Tag> implements ITagRepository {
  protected modelName = 'tag' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(orgId: string): Promise<Tag[]> {
    return this.prisma.tag.findMany({
      where: { orgId },
      include: { _count: { select: { contacts: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findByName(orgId: string, name: string): Promise<Tag | null> {
    return this.prisma.tag.findUnique({
      where: { orgId_name: { orgId, name } },
    });
  }

  async addToContact(contactId: string, tagId: string): Promise<void> {
    if (!contactId || !tagId) {
      throw new Error(`addToContact requires both contactId and tagId (got contactId=${contactId}, tagId=${tagId})`);
    }
    // Idempotent: ignore if the contact already has the tag instead of throwing on the unique constraint.
    await this.prisma.tagOnContact.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      create: { contactId, tagId },
      update: {},
    });
  }

  async removeFromContact(contactId: string, tagId: string): Promise<void> {
    if (!contactId || !tagId) {
      throw new Error(`removeFromContact requires both contactId and tagId (got contactId=${contactId}, tagId=${tagId})`);
    }
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
