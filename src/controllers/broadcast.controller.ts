// src/controllers/broadcast.controller.ts
// Broadcast campaign HTTP handlers

import { Request, Response } from 'express';
import { BroadcastService } from '@services/broadcast.service';
import { asyncHandler } from '@middleware/error.middleware';

export class BroadcastController {
  constructor(private service: BroadcastService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const broadcast = await this.service.createBroadcast(userId, req.body);

    res.status(201).json({
      success: true,
      data: broadcast,
    });
  });

  list = asyncHandler(async (_req: Request, res: Response) => {
    const broadcasts = await this.service.getBroadcasts();

    res.status(200).json({
      success: true,
      data: broadcasts,
    });
  });

  send = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.service.sendBroadcast(id);

    res.status(200).json({
      success: true,
      message: 'Broadcast sent',
    });
  });

  schedule = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { scheduleTime } = req.body;

    const broadcast = await this.service.scheduleBroadcast(id, new Date(scheduleTime));

    res.status(200).json({
      success: true,
      data: broadcast,
    });
  });

  cancel = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const broadcast = await this.service.cancelBroadcast(id);

    res.status(200).json({
      success: true,
      data: broadcast,
    });
  });
}
