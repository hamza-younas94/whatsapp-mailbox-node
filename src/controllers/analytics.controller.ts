// src/controllers/analytics.controller.ts
// Analytics HTTP handlers

import { Request, Response } from 'express';
import { AnalyticsService } from '@services/analytics.service';
import { asyncHandler } from '@middleware/error.middleware';
import { requireOrgId } from '@utils/auth-helpers';

export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  getStats = asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const { days = '7' } = req.query;

    const stats = await this.service.getStats(orgId, parseInt(days as string) || 7);

    res.status(200).json({
      success: true,
      data: stats,
    });
  });

  getTrends = asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const { days = 7 } = req.query;

    const trends = await this.service.getMessageTrends(orgId, parseInt(days as string));

    res.status(200).json({
      success: true,
      data: trends,
    });
  });

  getCampaigns = asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const campaigns = await this.service.getCampaigns(orgId);

    res.status(200).json({
      success: true,
      data: campaigns,
    });
  });

  getTopContacts = asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const { limit = '10' } = req.query;
    const contacts = await this.service.getTopContacts(orgId, parseInt(limit as string) || 10);

    res.status(200).json({
      success: true,
      data: contacts,
    });
  });

  exportReport = asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const { days = '7' } = req.query;
    const csv = await this.service.exportReport(orgId, parseInt(days as string) || 7);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
    res.status(200).send(csv);
  });
}
