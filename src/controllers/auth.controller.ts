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
      await prisma.activityLog.create({
        data: {
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
    res.status(200).json({
      success: true,
      data: req.user,
    });
  });
}
