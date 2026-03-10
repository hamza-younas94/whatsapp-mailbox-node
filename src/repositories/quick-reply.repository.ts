// src/repositories/quick-reply.repository.ts
// Quick reply data access

import { PrismaClient, QuickReply, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface IQuickReplyRepository {
  findByUserId(orgId: string): Promise<QuickReply[]>;
  findByShortcut(orgId: string, shortcut: string): Promise<QuickReply | null>;
  search(orgId: string, query: string): Promise<QuickReply[]>;
  findActiveByUserId(orgId: string): Promise<QuickReply[]>;
}

export class QuickReplyRepository extends BaseRepository<QuickReply> implements IQuickReplyRepository {
  protected modelName = 'quickReply' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(orgId: string): Promise<QuickReply[]> {
    return this.prisma.quickReply.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveByUserId(orgId: string): Promise<QuickReply[]> {
    return this.prisma.quickReply.findMany({
      where: {
        orgId,
        isActive: true,
      },
      orderBy: { usageCount: 'desc' }, // Order by most used first
    });
  }

  async findByShortcut(orgId: string, shortcut: string): Promise<QuickReply | null> {
    return this.prisma.quickReply.findFirst({
      where: { orgId, shortcut },
    });
  }

  async search(orgId: string, query: string): Promise<QuickReply[]> {
    return this.prisma.quickReply.findMany({
      where: {
        orgId,
        OR: [
          { title: { contains: query } },
          { content: { contains: query } },
        ],
      },
      take: 20,
    });
  }
}
