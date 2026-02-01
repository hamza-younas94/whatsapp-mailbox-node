// src/controllers/segment.controller.ts
// Segment HTTP handlers

import { Request, Response } from 'express';
import { SegmentService } from '@services/segment.service';
import { asyncHandler } from '@middleware/error.middleware';

export class SegmentController {
  constructor(private service: SegmentService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const segment = await this.service.createSegment(userId, req.body);

    res.status(201).json({
      success: true,
      data: segment,
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const segments = await this.service.getSegments(userId);

    res.status(200).json({
      success: true,
      data: segments,
    });
  });

  getContacts = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const contacts = await this.service.getSegmentContacts(id);

    res.status(200).json({
      success: true,
      data: contacts,
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const segment = await this.service.updateSegment(id, req.body);

    res.status(200).json({
      success: true,
      data: segment,
    });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.service.deleteSegment(id);

    res.status(200).json({
      success: true,
      message: 'Segment deleted',
    });
  });
}
