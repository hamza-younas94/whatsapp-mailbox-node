// src/controllers/task.controller.ts
// Task HTTP handlers

import { Request, Response } from 'express';
import { TaskService } from '@services/task.service';
import { asyncHandler } from '@middleware/error.middleware';

export class TaskController {
  constructor(private service: TaskService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const task = await this.service.createTask(userId, req.body);
    res.status(201).json({ success: true, data: task });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { status, priority, contactId, dueBefore, dueAfter, page, limit } = req.query;
    const result = await this.service.getTasks(userId, {
      status: status as string, priority: priority as string,
      contactId: contactId as string,
      dueBefore: dueBefore as string, dueAfter: dueAfter as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const task = await this.service.getTask(req.params.id);
    res.status(200).json({ success: true, data: task });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const task = await this.service.updateTask(req.params.id, req.body);
    res.status(200).json({ success: true, data: task });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.deleteTask(req.params.id);
    res.status(200).json({ success: true, message: 'Task deleted' });
  });
}
