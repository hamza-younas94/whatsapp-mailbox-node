// src/controllers/note.controller.ts
// Note HTTP handlers

import { Request, Response } from 'express';
import { NoteService } from '@services/note.service';
import { asyncHandler } from '@middleware/error.middleware';

export class NoteController {
  constructor(private service: NoteService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const note = await this.service.createNote(userId, req.body);

    res.status(201).json({
      success: true,
      data: note,
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const { contactId } = req.params;
    const notes = await this.service.getNotes(contactId);

    res.status(200).json({
      success: true,
      data: notes,
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const note = await this.service.updateNote(id, req.body);

    res.status(200).json({
      success: true,
      data: note,
    });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.service.deleteNote(id);

    res.status(200).json({
      success: true,
      message: 'Note deleted',
    });
  });
}
