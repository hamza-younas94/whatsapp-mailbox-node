// src/controllers/analytics.controller.ts
// Analytics HTTP handlers

import { Request, Response } from 'express';
import { AnalyticsService } from '@services/analytics.service';
import { asyncHandler } from '@middleware/error.middleware';

export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  getStats = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;

    const stats = await this.service.getStats(
      userId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined,
    );

    res.status(200).json({
      success: true,
      data: stats,
    });
  });

  getTrends = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { days = 7 } = req.query;

    const trends = await this.service.getMessageTrends(userId, parseInt(days as string));

    res.status(200).json({
      success: true,
      data: trends,
    });
  });

  getCampaigns = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: [],
    });
  });

  getTopContacts = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: [],
    });
  });

  exportReport = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
    res.status(200).send('Date,Sent,Received\n');
  });
}
