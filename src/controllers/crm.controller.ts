// src/controllers/crm.controller.ts
// CRM HTTP handlers

import { Request, Response } from 'express';
import { CRMService } from '@services/crm.service';
import { asyncHandler } from '@middleware/error.middleware';

export class CRMController {
  constructor(private service: CRMService) {}

  createDeal = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const deal = await this.service.createDeal(userId, req.body);

    res.status(201).json({
      success: true,
      data: deal,
    });
  });

  listDeals = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { status, stage } = req.query;

    const deals = await this.service.getDeals(userId, { status, stage });

    res.status(200).json({
      success: true,
      data: deals,
    });
  });

  updateDeal = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deal = await this.service.updateDeal(id, req.body);

    res.status(200).json({
      success: true,
      data: deal,
    });
  });

  moveStage = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { stage } = req.body;

    const deal = await this.service.moveDealToStage(id, stage);

    res.status(200).json({
      success: true,
      data: deal,
    });
  });

  getStats = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const stats = await this.service.getDealStats(userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  });
}
