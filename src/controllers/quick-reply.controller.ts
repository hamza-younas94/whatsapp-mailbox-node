// src/controllers/quick-reply.controller.ts
// Quick reply HTTP handlers

import { Request, Response } from 'express';
import { QuickReplyService } from '@services/quick-reply.service';
import { asyncHandler } from '@middleware/error.middleware';

export class QuickReplyController {
  constructor(private service: QuickReplyService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const quickReply = await this.service.createQuickReply(userId, req.body);

    res.status(201).json({
      success: true,
      data: quickReply,
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const quickReplies = await this.service.getQuickReplies(userId);

    res.status(200).json({
      success: true,
      data: quickReplies,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const quickReply = await this.service.getQuickReplyById(id);

    res.status(200).json({
      success: true,
      data: quickReply,
    });
  });

  search = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { q } = req.query;

    const results = await this.service.searchQuickReplies(userId, q as string);

    res.status(200).json({
      success: true,
      data: results,
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const quickReply = await this.service.updateQuickReply(id, req.body);

    res.status(200).json({
      success: true,
      data: quickReply,
    });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.service.deleteQuickReply(id);

    res.status(200).json({
      success: true,
      message: 'Quick reply deleted',
    });
  });
}
