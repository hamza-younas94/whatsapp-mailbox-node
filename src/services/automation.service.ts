// src/services/automation.service.ts
// Automation and workflow engine

import { Automation } from '@prisma/client';
import { AutomationRepository } from '@repositories/automation.repository';
import { MessageService } from './message.service';
import { TagService } from './tag.service';
import { NotFoundError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateAutomationInput {
  name: string;
  trigger: string; // MESSAGE_RECEIVED, CONTACT_ADDED, TAG_APPLIED, etc.
  actions: AutomationAction[];
}

export interface AutomationAction {
  type: 'SEND_MESSAGE' | 'ADD_TAG' | 'REMOVE_TAG' | 'SEND_EMAIL' | 'WEBHOOK' | 'WAIT';
  params: Record<string, any>;
}

export interface IAutomationService {
  createAutomation(userId: string, input: CreateAutomationInput): Promise<Automation>;
  getAutomations(userId: string): Promise<Automation[]>;
  updateAutomation(id: string, data: Partial<Automation>): Promise<Automation>;
  deleteAutomation(id: string): Promise<void>;
  toggleAutomation(id: string, isActive: boolean): Promise<Automation>;
  executeAutomation(automationId: string, context: Record<string, any>): Promise<void>;
  triggerAutomations(trigger: string, context: Record<string, any>): Promise<void>;
}

export class AutomationService implements IAutomationService {
  constructor(
    private repository: AutomationRepository,
    private messageService: MessageService,
    private tagService: TagService,
  ) {}

  async createAutomation(userId: string, input: CreateAutomationInput): Promise<Automation> {
    const automation = await this.repository.create({
      userId,
      name: input.name,
      trigger: input.trigger,
      actions: input.actions,
      isActive: true,
    });

    logger.info({ id: automation.id }, 'Automation created');
    return automation;
  }

  async getAutomations(userId: string): Promise<Automation[]> {
    return this.repository.findActive(userId);
  }

  async updateAutomation(id: string, data: Partial<Automation>): Promise<Automation> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Automation');
    }

    return this.repository.update(id, data);
  }

  async deleteAutomation(id: string): Promise<void> {
    await this.repository.delete(id);
    logger.info({ id }, 'Automation deleted');
  }

  async toggleAutomation(id: string, isActive: boolean): Promise<Automation> {
    return this.repository.update(id, { isActive });
  }

  async executeAutomation(automationId: string, context: Record<string, any>): Promise<void> {
    const automation = await this.repository.findById(automationId);
    if (!automation || !automation.isActive) {
      return;
    }

    const actions = automation.actions as unknown as AutomationAction[];

    for (const action of actions) {
      await this.executeAction(action, context);
    }

    logger.info({ automationId }, 'Automation executed');
  }

  async triggerAutomations(trigger: string, context: Record<string, any>): Promise<void> {
    const automations = await this.repository.findByTrigger(trigger);

    for (const automation of automations) {
      try {
        await this.executeAutomation(automation.id, context);
      } catch (error) {
        logger.error({ automationId: automation.id, error }, 'Automation execution failed');
      }
    }
  }

  private async executeAction(action: AutomationAction, context: Record<string, any>): Promise<void> {
    switch (action.type) {
      case 'SEND_MESSAGE':
        await this.messageService.sendMessage(context.userId, {
          contactId: context.contactId,
          content: action.params.content,
          mediaUrl: action.params.mediaUrl,
        });
        break;

      case 'ADD_TAG':
        await this.tagService.addTagToContact(context.contactId, action.params.tagId);
        break;

      case 'REMOVE_TAG':
        await this.tagService.removeTagFromContact(context.contactId, action.params.tagId);
        break;

      case 'WAIT':
        await new Promise((resolve) => setTimeout(resolve, action.params.delay || 1000));
        break;

      case 'WEBHOOK':
        // Call external webhook
        await fetch(action.params.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(context),
        });
        break;

      default:
        logger.warn({ action: action.type }, 'Unknown action type');
    }
  }
}
