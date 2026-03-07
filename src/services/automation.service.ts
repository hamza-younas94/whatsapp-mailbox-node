// src/services/automation.service.ts
// Automation and workflow engine

import { Automation } from '@prisma/client';
import { AutomationRepository } from '@repositories/automation.repository';
import { ContactRepository } from '@repositories/contact.repository';
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
  type: 'SEND_MESSAGE' | 'ADD_TAG' | 'REMOVE_TAG' | 'SEND_EMAIL' | 'WEBHOOK' | 'WAIT' | 'FORWARD_MESSAGE';
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

// Anti-spam rate limiter for message forwarding
class ForwardRateLimiter {
  private targetCounts = new Map<string, { count: number; resetAt: number }>();
  private globalCount = { count: 0, resetAt: 0 };
  private contentHashes = new Map<string, number>(); // hash -> timestamp

  // Max 5 forwards to same target per 10 minutes
  checkTargetLimit(targetId: string): boolean {
    const now = Date.now();
    const entry = this.targetCounts.get(targetId);
    if (!entry || now > entry.resetAt) {
      this.targetCounts.set(targetId, { count: 1, resetAt: now + 600_000 });
      return true;
    }
    if (entry.count >= 5) return false;
    entry.count++;
    return true;
  }

  // Max 20 forwards per minute globally
  checkGlobalLimit(): boolean {
    const now = Date.now();
    if (now > this.globalCount.resetAt) {
      this.globalCount = { count: 1, resetAt: now + 60_000 };
      return true;
    }
    if (this.globalCount.count >= 20) return false;
    this.globalCount.count++;
    return true;
  }

  // Skip if same content forwarded in last 5 minutes
  checkContentDuplicate(content: string, targetId: string): boolean {
    const hash = `${targetId}:${this.simpleHash(content)}`;
    const now = Date.now();
    const lastSent = this.contentHashes.get(hash);
    if (lastSent && now - lastSent < 300_000) return false;
    this.contentHashes.set(hash, now);
    // Cleanup old entries periodically
    if (this.contentHashes.size > 1000) {
      for (const [k, v] of this.contentHashes) {
        if (now - v > 300_000) this.contentHashes.delete(k);
      }
    }
    return true;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }
}

export class AutomationService implements IAutomationService {
  private forwardLimiter = new ForwardRateLimiter();

  constructor(
    private repository: AutomationRepository,
    private messageService: MessageService,
    private tagService: TagService,
    private contactRepository?: ContactRepository,
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

    const raw = automation.actions as any;

    // Handle both array format and single object format
    let actions: AutomationAction[];
    if (Array.isArray(raw)) {
      actions = raw;
    } else if (raw && typeof raw === 'object' && raw.type) {
      // Single action object (e.g., {type: 'FORWARD_MESSAGE', targets: [...]})
      actions = [{ type: raw.type, params: raw }];
    } else if (raw && typeof raw === 'object' && raw.message) {
      // Legacy format: {message: '...'}
      actions = [{ type: 'SEND_MESSAGE', params: { content: raw.message } }];
    } else {
      actions = [];
    }

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

      case 'FORWARD_MESSAGE': {
        const messageContent = context.messageContent || context.body || '';
        const mediaUrl = context.mediaUrl;

        // 1. Keyword filtering — skip if message doesn't match any keyword prefix
        const keywords: string[] = action.params.keywords || [];
        if (keywords.length > 0) {
          const lowerBody = messageContent.toLowerCase().trim();
          const matched = keywords.some((kw: string) => lowerBody.startsWith(kw.toLowerCase().trim()));
          if (!matched) {
            logger.debug({ keywords }, 'FORWARD_MESSAGE: No keyword match, skipping');
            break;
          }
        }

        // 2. Resolve targets: explicit contacts + tag-based contacts
        let targets: string[] = action.params.targets || [];
        const targetTags: string[] = action.params.targetTags || [];
        if (targetTags.length > 0 && this.contactRepository) {
          try {
            const result = await this.contactRepository.search(context.userId, {
              tags: targetTags,
              limit: 500,
            });
            const tagContactIds = result.data.map((c: any) => c.id);
            const allIds = new Set([...targets, ...tagContactIds]);
            allIds.delete(context.contactId); // Don't forward back to sender
            targets = Array.from(allIds);
            logger.info({ tagCount: targetTags.length, resolvedCount: targets.length }, 'FORWARD_MESSAGE: Resolved tag targets');
          } catch (err) {
            logger.error({ err }, 'FORWARD_MESSAGE: Failed to resolve tag targets');
          }
        }

        const prefix = action.params.prefix || '';
        const includeMedia = action.params.includeMedia !== false;

        if (!messageContent && !mediaUrl) {
          logger.warn('FORWARD_MESSAGE: No content to forward');
          break;
        }

        const forwardContent = prefix
          ? `${prefix}\n${messageContent}`
          : messageContent;

        for (const targetContactId of targets) {
          // Anti-spam checks
          if (!this.forwardLimiter.checkGlobalLimit()) {
            logger.warn('FORWARD_MESSAGE: Global rate limit reached');
            break;
          }
          if (!this.forwardLimiter.checkTargetLimit(targetContactId)) {
            logger.warn({ targetContactId }, 'FORWARD_MESSAGE: Target rate limit reached');
            continue;
          }
          if (messageContent && !this.forwardLimiter.checkContentDuplicate(messageContent, targetContactId)) {
            logger.warn({ targetContactId }, 'FORWARD_MESSAGE: Duplicate content skipped');
            continue;
          }

          try {
            await this.messageService.sendMessage(context.userId, {
              contactId: targetContactId,
              content: forwardContent,
              mediaUrl: includeMedia ? mediaUrl : undefined,
            });
            logger.info({ targetContactId }, 'Message forwarded');
          } catch (err) {
            logger.error({ targetContactId, err }, 'FORWARD_MESSAGE: Failed to forward');
          }
        }
        break;
      }

      default:
        logger.warn({ action: action.type }, 'Unknown action type');
    }
  }
}
