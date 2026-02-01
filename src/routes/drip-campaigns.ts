// src/routes/drip-campaigns.ts
// Drip Campaigns API Routes

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, DripTriggerType } from '@prisma/client';
import { authenticate } from '@middleware/auth.middleware';
import logger from '@utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Apply auth middleware to all routes
router.use(authenticate);

// Helper to get user ID from request
function getUserId(req: Request): string | null {
  return req.user?.id || req.user?.userId || null;
}

// Get all drip campaigns
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const campaigns = await prisma.dripCampaign.findMany({
      where: { userId },
      include: {
        steps: {
          orderBy: { sequence: 'asc' }
        },
        _count: {
          select: { enrollments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add computed fields
    const campaignsWithStats = campaigns.map(campaign => ({
      ...campaign,
      enrollmentCount: campaign._count.enrollments,
      messagesSent: 0 // TODO: Calculate from dripScheduledMessages
    }));

    res.json({ success: true, data: campaignsWithStats });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch drip campaigns');
    next(error);
  }
});

// Get single drip campaign
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const campaign = await prisma.dripCampaign.findFirst({
      where: { id, userId },
      include: {
        steps: {
          orderBy: { sequence: 'asc' }
        },
        enrollments: {
          include: {
            contact: true
          },
          take: 50
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch drip campaign');
    next(error);
  }
});

// Create drip campaign
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { name, description, trigger, status, steps } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    // Map trigger to triggerType
    const triggerTypeMap: Record<string, DripTriggerType> = {
      'CONTACT_CREATED': DripTriggerType.MANUAL,
      'TAG_ADDED': DripTriggerType.TAG_ADDED,
      'SEGMENT_JOINED': DripTriggerType.MANUAL,
      'MANUAL': DripTriggerType.MANUAL
    };

    const campaign = await prisma.dripCampaign.create({
      data: {
        userId,
        name,
        description,
        triggerType: triggerTypeMap[trigger] || DripTriggerType.MANUAL,
        triggerValue: trigger,
        isActive: status === 'ACTIVE',
        steps: {
          create: (steps || []).map((step: any, index: number) => ({
            sequence: step.order || index + 1,
            delayHours: calculateDelayHours(step.delayValue, step.delayUnit),
            message: step.content || '',
            mediaType: step.messageType === 'IMAGE' ? 'IMAGE' : undefined
          }))
        }
      },
      include: { steps: true }
    });

    logger.info({ campaignId: campaign.id, userId }, 'Drip campaign created');
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    logger.error({ error }, 'Failed to create drip campaign');
    next(error);
  }
});

// Update drip campaign
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const existing = await prisma.dripCampaign.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const { name, description, trigger, status, steps } = req.body;

    // Delete existing steps and recreate
    await prisma.dripCampaignStep.deleteMany({
      where: { campaignId: id }
    });

    const triggerTypeMap: Record<string, DripTriggerType> = {
      'CONTACT_CREATED': DripTriggerType.MANUAL,
      'TAG_ADDED': DripTriggerType.TAG_ADDED,
      'SEGMENT_JOINED': DripTriggerType.MANUAL,
      'MANUAL': DripTriggerType.MANUAL
    };

    const campaign = await prisma.dripCampaign.update({
      where: { id },
      data: {
        name,
        description,
        triggerType: triggerTypeMap[trigger] || existing.triggerType,
        triggerValue: trigger,
        isActive: status === 'ACTIVE',
        steps: {
          create: (steps || []).map((step: any, index: number) => ({
            sequence: step.order || index + 1,
            delayHours: calculateDelayHours(step.delayValue, step.delayUnit),
            message: step.content || '',
            mediaType: step.messageType === 'IMAGE' ? 'IMAGE' : undefined
          }))
        }
      },
      include: { steps: true }
    });

    logger.info({ campaignId: id }, 'Drip campaign updated');
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error({ error }, 'Failed to update drip campaign');
    next(error);
  }
});

// Delete drip campaign
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const existing = await prisma.dripCampaign.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    await prisma.dripCampaign.delete({ where: { id } });

    logger.info({ campaignId: id }, 'Drip campaign deleted');
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    logger.error({ error }, 'Failed to delete drip campaign');
    next(error);
  }
});

// Pause campaign
router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const campaign = await prisma.dripCampaign.updateMany({
      where: { id, userId },
      data: { isActive: false }
    });

    if (campaign.count === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, message: 'Campaign paused' });
  } catch (error) {
    logger.error({ error }, 'Failed to pause campaign');
    next(error);
  }
});

// Activate campaign
router.post('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const campaign = await prisma.dripCampaign.updateMany({
      where: { id, userId },
      data: { isActive: true }
    });

    if (campaign.count === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, message: 'Campaign activated' });
  } catch (error) {
    logger.error({ error }, 'Failed to activate campaign');
    next(error);
  }
});

// Get campaign enrollments
router.get('/:id/enrollments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify campaign belongs to user
    const campaign = await prisma.dripCampaign.findFirst({
      where: { id, userId },
      include: { steps: true }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const enrollments = await prisma.dripEnrollment.findMany({
      where: { campaignId: id },
      include: {
        contact: true
      },
      orderBy: { enrolledAt: 'desc' }
    });

    const enrollmentsWithProgress = enrollments.map(e => ({
      ...e,
      totalSteps: campaign.steps.length
    }));

    res.json({ success: true, data: enrollmentsWithProgress });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch enrollments');
    next(error);
  }
});

// Enroll contact in campaign
router.post('/:id/enroll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { contactId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify campaign belongs to user
    const campaign = await prisma.dripCampaign.findFirst({
      where: { id, userId, isActive: true },
      include: { steps: { orderBy: { sequence: 'asc' } } }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Active campaign not found' });
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.dripEnrollment.findFirst({
      where: { campaignId: id, contactId, status: 'ACTIVE' }
    });

    if (existingEnrollment) {
      return res.status(400).json({ success: false, error: 'Contact already enrolled' });
    }

    // Create enrollment
    const enrollment = await prisma.dripEnrollment.create({
      data: {
        campaignId: id,
        contactId,
        currentStep: 0,
        status: 'ACTIVE',
        enrolledAt: new Date()
      }
    });

    // Schedule first step if exists
    const firstStep = campaign.steps[0];
    if (firstStep) {
      const sendAt = new Date(Date.now() + firstStep.delayHours * 60 * 60 * 1000);

      await prisma.dripScheduledMessage.create({
        data: {
          campaignId: id,
          stepId: firstStep.id,
          contactId,
          message: firstStep.message,
          mediaUrl: firstStep.mediaUrl || undefined,
          mediaType: firstStep.mediaType || undefined,
          scheduledFor: sendAt,
          status: 'PENDING'
        }
      });
    }

    logger.info({ campaignId: id, contactId }, 'Contact enrolled in drip campaign');
    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    logger.error({ error }, 'Failed to enroll contact');
    next(error);
  }
});

// Helper function to calculate delay in hours
function calculateDelayHours(value: number, unit: string): number {
  switch (unit) {
    case 'MINUTES':
      return value / 60;
    case 'HOURS':
      return value;
    case 'DAYS':
      return value * 24;
    default:
      return value;
  }
}

export default router;
