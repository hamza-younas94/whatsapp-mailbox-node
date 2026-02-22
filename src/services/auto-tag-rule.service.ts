// src/services/auto-tag-rule.service.ts
// Auto-Tag Rule business logic

import { AutoTagRule } from '@prisma/client';
import { AutoTagRuleRepository } from '@repositories/auto-tag-rule.repository';
import { NotFoundError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateAutoTagRuleInput {
  name: string;
  description?: string;
  conditions: any[];
  tagId: string;
  isActive?: boolean;
}

export class AutoTagRuleService {
  constructor(private repository: AutoTagRuleRepository) {}

  async createRule(userId: string, input: CreateAutoTagRuleInput): Promise<AutoTagRule> {
    const rule = await this.repository.create({
      userId,
      name: input.name,
      description: input.description,
      conditions: input.conditions,
      tagId: input.tagId,
      isActive: input.isActive !== undefined ? input.isActive : true,
    });
    logger.info({ id: rule.id, name: input.name }, 'Auto-tag rule created');
    return rule;
  }

  async getRules(userId: string): Promise<AutoTagRule[]> {
    return this.repository.findByUserId(userId);
  }

  async updateRule(id: string, data: Partial<CreateAutoTagRuleInput>): Promise<AutoTagRule> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Auto-tag rule');
    const rule = await this.repository.update(id, data);
    logger.info({ id }, 'Auto-tag rule updated');
    return rule;
  }

  async deleteRule(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Auto-tag rule');
    await this.repository.delete(id);
    logger.info({ id }, 'Auto-tag rule deleted');
  }

  async executeRule(id: string, userId: string): Promise<{ taggedCount: number }> {
    const rule = await this.repository.findById(id) as AutoTagRule | null;
    if (!rule) throw new NotFoundError('Auto-tag rule');

    const conditions = rule.conditions as any[];
    const taggedCount = await this.repository.executeRule(id, userId, conditions, rule.tagId);
    logger.info({ id, taggedCount }, 'Auto-tag rule executed');
    return { taggedCount };
  }
}
