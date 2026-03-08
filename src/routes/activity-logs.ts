// src/routes/activity-logs.ts
// Activity Log API routes

import { Router } from 'express';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';

const router = Router();
const prisma = getPrismaClient();

router.use(authenticate);

// List activity logs for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { action, page = '1', limit = '50', startDate, endDate } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId };
    if (action) where.action = action as string;
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
    const userId = req.user!.id;
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const where = { userId, action: 'LOGIN' as const };

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
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
