// src/services/drip-campaign.service.ts
// Drip campaign automation

import { PrismaClient, DripCampaign, DripCampaignStep } from '@prisma/client';
import { WhatsAppService } from './whatsapp.service';
import logger from '@utils/logger';
import { NotFoundError } from '@utils/errors';

export interface CreateDripCampaignData {
  name: string;
  description?: string;
  triggerType: 'MANUAL' | 'TAG_ADDED' | 'FORM_SUBMITTED';
  triggerValue?: string;
  steps: Array<{
    sequence: number;
    delayHours: number;
    message: string;
    mediaUrl?: string;
    mediaType?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  }>;
}

export interface IDripCampaignService {
  createDripCampaign(userId: string, data: CreateDripCampaignData): Promise<DripCampaign>;
  enrollContact(campaignId: string, contactId: string): Promise<void>;
  processDueSteps(): Promise<void>;
}

export class DripCampaignService implements IDripCampaignService {
  constructor(
    private prisma: PrismaClient,
    private whatsappService: WhatsAppService,
  ) {}

  async createDripCampaign(userId: string, data: CreateDripCampaignData): Promise<DripCampaign> {
    const campaign = await this.prisma.dripCampaign.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        triggerValue: data.triggerValue,
        isActive: true,
        steps: {
          create: data.steps.map((step) => ({
            sequence: step.sequence,
            delayHours: step.delayHours,
            message: step.message,
            mediaUrl: step.mediaUrl,
            mediaType: step.mediaType,
          })),
        },
      },
      include: { steps: true },
    });

    logger.info({ campaignId: campaign.id }, 'Drip campaign created');
    return campaign;
  }

  async enrollContact(campaignId: string, contactId: string): Promise<void> {
    const campaign = await this.prisma.dripCampaign.findUnique({
      where: { id: campaignId },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (!campaign.isActive) {
      throw new Error('Campaign is not active');
    }

    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    // Create enrollment
    await this.prisma.dripEnrollment.create({
      data: {
        campaignId,
        contactId,
        currentStep: 0,
        status: 'ACTIVE',
        enrolledAt: new Date(),
      },
    });

    // Schedule first step
    const firstStep = campaign.steps[0];
    if (firstStep) {
      const sendAt = new Date(Date.now() + firstStep.delayHours * 60 * 60 * 1000);

      await this.prisma.dripScheduledMessage.create({
        data: {
          campaignId,
          stepId: firstStep.id,
          contactId,
          message: firstStep.message,
          mediaUrl: firstStep.mediaUrl,
          mediaType: firstStep.mediaType,
          scheduledFor: sendAt,
          status: 'PENDING',
        },
      });

      logger.info(
        { campaignId, contactId, stepId: firstStep.id, sendAt },
        'First drip step scheduled',
      );
    }
  }

  async processDueSteps(): Promise<void> {
    const now = new Date();

    const dueMessages = await this.prisma.dripScheduledMessage.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: now },
      },
      include: {
        contact: true,
        campaign: { include: { steps: { orderBy: { sequence: 'asc' } } } },
        step: true,
      },
      take: 50, // Process in batches
    });

    for (const scheduled of dueMessages) {
      try {
        // Send message
        await this.whatsappService.sendMessage(
          scheduled.contact.phoneNumber,
          scheduled.message
        );

        // Mark as sent
        await this.prisma.dripScheduledMessage.update({
          where: { id: scheduled.id },
          data: { status: 'SENT', sentAt: new Date() },
        });

        // Update enrollment
        const enrollment = await this.prisma.dripEnrollment.findFirst({
          where: {
            campaignId: scheduled.campaignId,
            contactId: scheduled.contactId,
            status: 'ACTIVE',
          },
        });

        if (enrollment) {
          const currentStepIndex = scheduled.campaign.steps.findIndex((s) => s.id === scheduled.stepId);
          const nextStep = scheduled.campaign.steps[currentStepIndex + 1];

          if (nextStep) {
            // Schedule next step
            const nextSendAt = new Date(Date.now() + nextStep.delayHours * 60 * 60 * 1000);

            await this.prisma.dripScheduledMessage.create({
              data: {
                campaignId: scheduled.campaignId,
                stepId: nextStep.id,
                contactId: scheduled.contactId,
                message: nextStep.message,
                mediaUrl: nextStep.mediaUrl,
                mediaType: nextStep.mediaType,
                scheduledFor: nextSendAt,
                status: 'PENDING',
              },
            });

            await this.prisma.dripEnrollment.update({
              where: { id: enrollment.id },
              data: { currentStep: nextStep.sequence },
            });
          } else {
            // Campaign completed
            await this.prisma.dripEnrollment.update({
              where: { id: enrollment.id },
              data: { status: 'COMPLETED', completedAt: new Date() },
            });

            logger.info(
              { campaignId: scheduled.campaignId, contactId: scheduled.contactId },
              'Drip campaign completed for contact',
            );
          }
        }

        logger.info({ messageId: scheduled.id, contactId: scheduled.contactId }, 'Drip message sent');
      } catch (error) {
        logger.error({ error, messageId: scheduled.id }, 'Failed to send drip message');

        await this.prisma.dripScheduledMessage.update({
          where: { id: scheduled.id },
          data: { status: 'FAILED' },
        });
      }
    }

    if (dueMessages.length > 0) {
      logger.info({ count: dueMessages.length }, 'Processed due drip messages');
    }
  }

  async unenrollContact(campaignId: string, contactId: string): Promise<void> {
    await this.prisma.dripEnrollment.updateMany({
      where: { campaignId, contactId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    // Cancel pending messages
    await this.prisma.dripScheduledMessage.updateMany({
      where: { campaignId, contactId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    logger.info({ campaignId, contactId }, 'Contact unenrolled from drip campaign');
  }
}
