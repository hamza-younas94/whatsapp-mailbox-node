// src/services/expense.service.ts
// Expense business logic

import { Expense } from '@prisma/client';
import { ExpenseRepository } from '@repositories/expense.repository';
import { NotFoundError, ValidationError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateExpenseInput {
  category: string;
  description?: string;
  amount: number;
  expenseDate?: string;
  paymentMethod?: string;
  vendorName?: string;
  receiptUrl?: string;
  notes?: string;
}

export class ExpenseService {
  constructor(private repository: ExpenseRepository) {}

  async createExpense(userId: string, input: CreateExpenseInput): Promise<Expense> {
    if (input.amount <= 0) throw new ValidationError('Amount must be greater than 0');

    const expense = await this.repository.create({
      userId,
      category: input.category,
      description: input.description,
      amount: input.amount,
      expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
      paymentMethod: input.paymentMethod,
      vendorName: input.vendorName,
      receiptUrl: input.receiptUrl,
      notes: input.notes,
    });
    logger.info({ id: expense.id, amount: input.amount }, 'Expense created');
    return expense;
  }

  async getExpenses(
    userId: string,
    options: { category?: string; paymentMethod?: string; startDate?: string; endDate?: string; page?: number; limit?: number } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.findByUserId(userId, {
      category: options.category,
      paymentMethod: options.paymentMethod,
      startDate: options.startDate ? new Date(options.startDate) : undefined,
      endDate: options.endDate ? new Date(options.endDate) : undefined,
      skip,
      take: limit,
    });

    return { items, pagination: { total, page, perPage: limit, totalPages: Math.ceil(total / limit) } };
  }

  async getExpense(id: string) {
    const expense = await this.repository.findById(id);
    if (!expense) throw new NotFoundError('Expense');
    return expense;
  }

  async updateExpense(id: string, data: Partial<CreateExpenseInput>): Promise<Expense> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Expense');

    const updateData: any = { ...data };
    if (data.expenseDate) updateData.expenseDate = new Date(data.expenseDate);

    const expense = await this.repository.update(id, updateData);
    logger.info({ id }, 'Expense updated');
    return expense;
  }

  async deleteExpense(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Expense');
    await this.repository.delete(id);
    logger.info({ id }, 'Expense deleted');
  }

  async getSummary(userId: string, startDate?: string, endDate?: string) {
    return this.repository.getSummary(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
  }
}
