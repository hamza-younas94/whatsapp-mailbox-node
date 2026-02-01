// src/repositories/campaign.repository.ts
// Campaign data access

import { PrismaClient, Campaign, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface ICampaignRepository {
  findByStatus(status: string): Promise<Campaign[]>;
  updateStatus(id: string, status: string): Promise<Campaign>;
  updateStats(id: string, stats: { sentCount?: number; failedCount?: number }): Promise<Campaign>;
}

export class CampaignRepository extends BaseRepository<Campaign> implements ICampaignRepository {
  protected modelName = 'campaign' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByStatus(status: string): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async updateStats(id: string, stats: { sentCount?: number; failedCount?: number }): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(stats.sentCount !== undefined && { sentCount: { increment: stats.sentCount } }),
        ...(stats.failedCount !== undefined && { failedCount: { increment: stats.failedCount } }),
      },
    });
  }
}
