// src/controllers/tag.controller.ts
// Tag HTTP handlers

import { Request, Response } from 'express';
import { TagService } from '@services/tag.service';
import { asyncHandler } from '@middleware/error.middleware';

export class TagController {
  constructor(private service: TagService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const tag = await this.service.createTag(userId, req.body);

    res.status(201).json({
      success: true,
      data: tag,
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const tags = await this.service.getTags(userId);

    res.status(200).json({
      success: true,
      data: tags,
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const tag = await this.service.updateTag(id, req.body);

    res.status(200).json({
      success: true,
      data: tag,
    });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.service.deleteTag(id);

    res.status(200).json({
      success: true,
      message: 'Tag deleted',
    });
  });

  addToContact = asyncHandler(async (req: Request, res: Response) => {
    const { contactId, tagId } = req.body;
    await this.service.addTagToContact(contactId, tagId);

    res.status(200).json({
      success: true,
      message: 'Tag added to contact',
    });
  });

  removeFromContact = asyncHandler(async (req: Request, res: Response) => {
    const { contactId, tagId } = req.params;
    await this.service.removeTagFromContact(contactId, tagId);

    res.status(200).json({
      success: true,
      message: 'Tag removed from contact',
    });
  });
}
