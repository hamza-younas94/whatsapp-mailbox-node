// src/controllers/expense.controller.ts
// Expense HTTP handlers

import { Request, Response } from 'express';
import { ExpenseService } from '@services/expense.service';
import { asyncHandler } from '@middleware/error.middleware';

export class ExpenseController {
  constructor(private service: ExpenseService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const expense = await this.service.createExpense(userId, req.body);
    res.status(201).json({ success: true, data: expense });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { category, paymentMethod, startDate, endDate, page, limit } = req.query;
    const result = await this.service.getExpenses(userId, {
      category: category as string, paymentMethod: paymentMethod as string,
      startDate: startDate as string, endDate: endDate as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const expense = await this.service.getExpense(req.params.id);
    res.status(200).json({ success: true, data: expense });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const expense = await this.service.updateExpense(req.params.id, req.body);
    res.status(200).json({ success: true, data: expense });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.deleteExpense(req.params.id);
    res.status(200).json({ success: true, message: 'Expense deleted' });
  });

  summary = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;
    const summary = await this.service.getSummary(userId, startDate as string, endDate as string);
    res.status(200).json({ success: true, data: summary });
  });
}
