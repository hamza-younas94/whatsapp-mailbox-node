// src/routes/automations.ts
// Automations API routes

import { Router } from 'express';
import { AutomationController } from '@controllers/automation.controller';
import { AutomationService } from '@services/automation.service';
import { AutomationRepository } from '@repositories/automation.repository';
import { WhatsAppService } from '@services/whatsapp.service';
import { TagService } from '@services/tag.service';
import { TagRepository } from '@repositories/tag.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();


// Initialize dependencies
  const prisma = getPrismaClient();
const automationRepo = new AutomationRepository(prisma);
const tagRepo = new TagRepository(prisma);
const whatsappService = new WhatsAppService();
const tagService = new TagService(tagRepo);
const service = new AutomationService(automationRepo, {} as any, tagService);
const controller = new AutomationController(service);

// Validation schemas
// Support both simple format (from legacy UI) and complex format
const createAutomationSchema = z.object({
  name: z.string().min(1).max(100),
  // Accept both triggerType (enum) and trigger (string) for backward compatibility
  triggerType: z.enum(['MESSAGE_RECEIVED', 'KEYWORD', 'TAG_ADDED', 'SCHEDULE']).optional(),
  trigger: z.string().optional(),
  triggerValue: z.string().optional(),
  conditions: z.record(z.any()).optional(),
  // Accept both array format and object format for actions
  actions: z.union([
    z.array(
      z.object({
        type: z.enum(['SEND_MESSAGE', 'ADD_TAG', 'REMOVE_TAG', 'WAIT', 'WEBHOOK']),
        value: z.string().optional(),
        delay: z.number().optional(),
      }),
    ),
    z.record(z.any()) // Legacy object format: {message: '...', tagId: '...'}
  ]).optional(),
  action: z.string().optional(), // Legacy single action field
  delay: z.number().optional(),
  isActive: z.boolean().default(true),
  message: z.string().optional(), // Direct message field for simple format
});

const toggleSchema = z.object({
  isActive: z.boolean(),
});

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.post('/', validateRequest(createAutomationSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const automation = await getPrismaClient().automation.findFirst({
      where: { id, userId }
    });
    
    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation not found' });
    }
    
    res.json({ success: true, data: automation });
  } catch (error) {
    next(error);
  }
});
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
router.patch('/:id/toggle', validateRequest(toggleSchema), controller.toggle);

// Enroll contact in automation (manual trigger)
router.post('/:id/enroll', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { contactId } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    if (!contactId) {
      return res.status(400).json({ success: false, error: 'contactId is required' });
    }
    
    // Verify automation exists and belongs to user
    const prisma = getPrismaClient();
    const automation = await prisma.automation.findFirst({
      where: { id, userId, isActive: true }
    });
    
    if (!automation) {
      return res.status(404).json({ success: false, error: 'Active automation not found' });
    }
    
    // Execute the automation for this contact
    await service.executeAutomation(id, { contactId, userId });
    
    res.json({ success: true, message: 'Contact enrolled in automation' });
  } catch (error) {
    next(error);
  }
});

export default router;
