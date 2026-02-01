// src/repositories/automation.repository.ts
// Automation rules data access

import { PrismaClient, Automation, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export interface IAutomationRepository {
  findByTrigger(trigger: string): Promise<Automation[]>;
  findActive(userId: string): Promise<Automation[]>;
}

export class AutomationRepository extends BaseRepository<Automation> implements IAutomationRepository {
  protected modelName = 'automation' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByTrigger(trigger: string): Promise<Automation[]> {
    return this.prisma.automation.findMany({
      where: { trigger, isActive: true },
    });
  }

  async findActive(userId: string): Promise<Automation[]> {
    return this.prisma.automation.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
