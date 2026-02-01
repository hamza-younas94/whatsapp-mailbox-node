// src/routes/analytics.ts
// Analytics API routes

import { Router } from 'express';
import { AnalyticsController } from '@controllers/analytics.controller';
import { AnalyticsService } from '@services/analytics.service';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest, validateQuery } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Initialize dependencies
const prisma = getPrismaClient();
const service = new AnalyticsService(prisma);
const controller = new AnalyticsController(service);

// Validation schemas
const statsSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const trendsSchema = z.object({
  days: z.string().regex(/^\d+$/).optional(),
});

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.get('/stats', controller.getStats);
router.get('/overview', controller.getStats);
router.get('/trends', validateQuery(trendsSchema), controller.getTrends);
router.get('/campaigns', controller.getCampaigns);
router.get('/top-contacts', controller.getTopContacts);
router.get('/export', controller.exportReport);

export default router;
