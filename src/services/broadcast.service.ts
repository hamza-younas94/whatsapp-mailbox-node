// src/services/broadcast.service.ts
// Broadcast campaign logic

import { Campaign } from '@prisma/client';
import { CampaignRepository } from '@repositories/campaign.repository';
import { SegmentRepository } from '@repositories/segment.repository';
import { MessageService } from './message.service';
import { NotFoundError, ValidationError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateBroadcastInput {
  name: string;
  content: string;
  mediaUrl?: string;
  recipients?: string[]; // Contact IDs
  segmentId?: string;
  scheduleTime?: Date;
}

export interface IBroadcastService {
  createBroadcast(userId: string, input: CreateBroadcastInput): Promise<Campaign>;
  getBroadcasts(): Promise<Campaign[]>;
  sendBroadcast(campaignId: string): Promise<void>;
  scheduleBroadcast(campaignId: string, scheduleTime: Date): Promise<Campaign>;
  cancelBroadcast(campaignId: string): Promise<Campaign>;
}

export class BroadcastService implements IBroadcastService {
  constructor(
    private campaignRepository: CampaignRepository,
    private segmentRepository: SegmentRepository,
    private messageService: MessageService,
  ) {}

  async createBroadcast(userId: string, input: CreateBroadcastInput): Promise<Campaign> {
    try {
      // Get recipient list
      let recipientIds: string[] = [];

      if (input.segmentId) {
        recipientIds = await this.segmentRepository.evaluateSegment(input.segmentId);
      } else if (input.recipients) {
        recipientIds = input.recipients;
      } else {
        throw new ValidationError('Either recipients or segmentId is required');
      }

      const campaign = await this.campaignRepository.create({
        name: input.name,
        type: 'BROADCAST',
        status: input.scheduleTime ? 'SCHEDULED' : 'DRAFT',
        content: input.content,
        mediaUrl: input.mediaUrl,
        scheduleTime: input.scheduleTime,
        recipientCount: recipientIds.length,
        metadata: { recipientIds, userId },
      });

      logger.info({ id: campaign.id, recipients: recipientIds.length }, 'Broadcast created');

      // If no schedule time, send immediately
      if (!input.scheduleTime) {
        await this.sendBroadcast(campaign.id);
      }

      return campaign;
    } catch (error) {
      logger.error({ input, error }, 'Failed to create broadcast');
      throw error;
    }
  }

  async getBroadcasts(): Promise<Campaign[]> {
    return this.campaignRepository.findAll();
  }

  async sendBroadcast(campaignId: string): Promise<void> {
    try {
      const campaign = await this.campaignRepository.findById(campaignId);
      if (!campaign) {
        throw new NotFoundError('Campaign');
      }

      // Update status to RUNNING
      await this.campaignRepository.updateStatus(campaignId, 'RUNNING');

      const metadata = campaign.metadata as any;
      const recipientIds: string[] = metadata.recipientIds || [];
      const userId: string = metadata.userId;

      logger.info({ campaignId, recipients: recipientIds.length }, 'Starting broadcast');

      // Send messages in batches
      const batchSize = 50;
      for (let i = 0; i < recipientIds.length; i += batchSize) {
        const batch = recipientIds.slice(i, i + batchSize);

        const results = await Promise.allSettled(
          batch.map((contactId) =>
            this.messageService.sendMessage(userId, {
              contactId,
              content: campaign.content || '',
              mediaUrl: campaign.mediaUrl || undefined,
            }),
          ),
        );

        // Update stats
        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failCount = results.filter((r) => r.status === 'rejected').length;

        await this.campaignRepository.updateStats(campaignId, {
          sentCount: successCount,
          failedCount: failCount,
        });

        // Rate limiting: Wait 1 second between batches
        if (i + batchSize < recipientIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Mark as completed
      await this.campaignRepository.update(campaignId, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      logger.info({ campaignId }, 'Broadcast completed');
    } catch (error) {
      logger.error({ campaignId, error }, 'Broadcast failed');
      await this.campaignRepository.updateStatus(campaignId, 'FAILED');
      throw error;
    }
  }

  async scheduleBroadcast(campaignId: string, scheduleTime: Date): Promise<Campaign> {
    return this.campaignRepository.update(campaignId, {
      scheduleTime,
      status: 'SCHEDULED',
    });
  }

  async cancelBroadcast(campaignId: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new NotFoundError('Campaign');
    }

    if (campaign.status === 'RUNNING') {
      throw new ValidationError('Cannot cancel running campaign');
    }

    return this.campaignRepository.updateStatus(campaignId, 'DRAFT');
  }
}
