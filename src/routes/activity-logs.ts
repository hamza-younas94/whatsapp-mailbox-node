// src/routes/activity-logs.ts
// Activity Log API routes

import { Router } from 'express';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';

const router = Router();
const prisma = getPrismaClient();

router.use(authenticate);

// List activity logs for current org
router.get('/', async (req, res) => {
  try {
    const orgId = req.user!.orgId;
    const { action, userId, page = '1', limit = '50', startDate, endDate } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { orgId };
    if (action) where.action = action as string;
    if (userId) where.userId = userId as string;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      success: true,
      items,
      pagination: { total, page: pageNum, perPage: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get login-specific logs
router.get('/logins', async (req, res) => {
  try {
    const orgId = req.user!.orgId;
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const where = { orgId, action: 'LOGIN' as const };

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      success: true,
      items,
      pagination: { total, page: pageNum, perPage: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
