// src/controllers/auth.controller.ts
// Authentication HTTP handlers

import { Request, Response } from 'express';
import { AuthService } from '@services/auth.service';
import { asyncHandler } from '@middleware/error.middleware';
import getPrismaClient from '@config/database';
import logger from '@utils/logger';

export class AuthController {
  constructor(private service: AuthService) {}

  private async logActivity(userId: string, action: 'LOGIN' | 'LOGOUT', req: Request) {
    try {
      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { orgId: true } });
      if (!user?.orgId) return;
      await prisma.activityLog.create({
        data: {
          orgId: user.orgId,
          userId,
          action,
          ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: { email: req.body?.email },
        },
      });
    } catch (err) {
      logger.error({ err, userId, action }, 'Failed to log activity');
    }
  }

  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.register(req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.login(req.body);

    // Log successful login
    if (result.user?.id) {
      this.logActivity(result.user.id, 'LOGIN', req);
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const result = await this.service.refreshToken(refreshToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId || req.user!.id },
      select: { id: true, name: true, email: true, username: true, role: true, orgId: true, isActive: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({
      success: true,
      data: user,
    });
  });
}
