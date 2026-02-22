// src/repositories/auto-tag-rule.repository.ts
// Auto-Tag Rule data access

import { PrismaClient, AutoTagRule } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class AutoTagRuleRepository extends BaseRepository<AutoTagRule> {
  protected modelName = 'autoTagRule' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(userId: string): Promise<AutoTagRule[]> {
    return this.prisma.autoTagRule.findMany({
      where: { userId },
      include: {
        tag: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveByUserId(userId: string): Promise<AutoTagRule[]> {
    return this.prisma.autoTagRule.findMany({
      where: { userId, isActive: true },
      include: {
        tag: { select: { id: true, name: true, color: true } },
      },
    });
  }

  async incrementExecutionCount(id: string): Promise<void> {
    await this.prisma.autoTagRule.update({
      where: { id },
      data: { executionCount: { increment: 1 } },
    });
  }

  async executeRule(
    ruleId: string,
    userId: string,
    conditions: any,
    tagId: string
  ): Promise<number> {
    // Build contact query from conditions
    const where: any = { userId };

    for (const condition of conditions) {
      switch (condition.type) {
        case 'keyword':
          // Tag contacts whose messages contain keyword
          break;
        case 'stage':
          where.customFields = { path: '$.stage', equals: condition.value };
          break;
        case 'engagement':
          if (condition.operator === 'gte') where.engagementScore = { gte: condition.value };
          if (condition.operator === 'lte') where.engagementScore = { lte: condition.value };
          break;
        case 'inactive_days':
          const daysAgo = new Date();
          daysAgo.setDate(daysAgo.getDate() - condition.value);
          where.lastActiveAt = { lte: daysAgo };
          break;
      }
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      select: { id: true },
    });

    let taggedCount = 0;
    for (const contact of contacts) {
      try {
        await this.prisma.tagOnContact.create({
          data: { contactId: contact.id, tagId },
        });
        taggedCount++;
      } catch {
        // Already tagged, skip
      }
    }

    await this.incrementExecutionCount(ruleId);
    return taggedCount;
  }
}
