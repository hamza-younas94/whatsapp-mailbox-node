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

// Dashboard summary — server-aggregated stats
router.get('/dashboard-summary', async (req, res) => {
  try {
    const orgId = req.user!.orgId;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      newContactsThisWeek,
      activeBroadcasts,
      activeDripEnrollments,
      openTickets,
      lowStockProducts,
      monthPayments,
      monthExpenses,
      totalPayments,
      unpaidInvoices,
    ] = await Promise.all([
      prisma.contact.count({ where: { orgId, createdAt: { gte: weekAgo } } }),
      prisma.broadcast.count({ where: { orgId, status: { in: ['SENDING', 'SCHEDULED'] } } }),
      prisma.dripEnrollment.count({ where: { status: 'ACTIVE', campaign: { orgId } } }),
      prisma.serviceTicket.count({ where: { orgId, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } } }),
      prisma.product.count({ where: { orgId, isActive: true, stockQuantity: { lte: prisma.product.fields.lowStockAlert as any } } }).catch(() =>
        // fallback: raw query if field comparison not supported
        prisma.$queryRaw`SELECT COUNT(*) as cnt FROM Product WHERE orgId = ${orgId} AND isActive = 1 AND stockQuantity <= lowStockAlert`.then((r: any) => Number(r[0]?.cnt || 0))
      ),
      prisma.payment.aggregate({ where: { invoice: { orgId }, paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { orgId, expenseDate: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { invoice: { orgId } }, _sum: { amount: true } }),
      prisma.invoice.aggregate({ where: { orgId, status: { in: ['SENT', 'OVERDUE'] } }, _sum: { totalAmount: true } }),
    ]);

    res.json({
      success: true,
      data: {
        newContactsThisWeek,
        activeBroadcasts,
        activeDripEnrollments,
        openTickets,
        lowStockProducts,
        monthRevenue: monthPayments._sum?.amount || 0,
        monthExpenses: monthExpenses._sum?.amount || 0,
        totalRevenue: totalPayments._sum?.amount || 0,
        outstandingAmount: unpaidInvoices._sum.totalAmount || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load dashboard summary' });
  }
});

// Routes
router.get('/stats', controller.getStats);
router.get('/overview', controller.getStats);
router.get('/trends', validateQuery(trendsSchema), controller.getTrends);
router.get('/campaigns', controller.getCampaigns);
router.get('/top-contacts', controller.getTopContacts);
router.get('/export', controller.exportReport);

export default router;
