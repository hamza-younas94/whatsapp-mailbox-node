// src/repositories/segment.repository.ts
// Segment data access

import { PrismaClient, Segment, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface ISegmentRepository {
  findByUserId(userId: string): Promise<Segment[]>;
  evaluateSegment(segmentId: string): Promise<string[]>;
}

export class SegmentRepository extends BaseRepository<Segment> implements ISegmentRepository {
  protected modelName = 'segment' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(userId: string): Promise<Segment[]> {
    return this.prisma.segment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async evaluateSegment(segmentId: string): Promise<string[]> {
    const segment = await this.prisma.segment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) return [];

    const criteria = segment.criteria as any;
    
    // Build dynamic where clause from criteria
    const where: Prisma.ContactWhereInput = {
      userId: segment.userId,
      ...(criteria.tags && { tags: { some: { tag: { name: { in: criteria.tags } } } } }),
      ...(criteria.isBlocked !== undefined && { isBlocked: criteria.isBlocked }),
    };

    const contacts = await this.prisma.contact.findMany({
      where,
      select: { id: true },
    });

    return contacts.map((c) => c.id);
  }
}
