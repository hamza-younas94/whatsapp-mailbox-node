// src/repositories/expense.repository.ts
// Expense data access

import { PrismaClient, Expense } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class ExpenseRepository extends BaseRepository<Expense> {
  protected modelName = 'expense' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(
    userId: string,
    options: {
      category?: string;
      paymentMethod?: string;
      startDate?: Date;
      endDate?: Date;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<{ items: Expense[]; total: number }> {
    const where: any = { userId };

    if (options.category) where.category = options.category;
    if (options.paymentMethod) where.paymentMethod = options.paymentMethod;
    if (options.startDate || options.endDate) {
      where.expenseDate = {};
      if (options.startDate) where.expenseDate.gte = options.startDate;
      if (options.endDate) where.expenseDate.lte = options.endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip: options.skip || 0,
        take: Math.min(options.take || 20, 100),
        orderBy: { expenseDate: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { items, total };
  }

  async getSummary(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { userId };
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = startDate;
      if (endDate) where.expenseDate.lte = endDate;
    }

    const expenses = await this.prisma.expense.findMany({ where });

    const byCategory: Record<string, number> = {};
    let totalAmount = 0;

    for (const expense of expenses) {
      const cat = expense.category || 'Uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + expense.amount;
      totalAmount += expense.amount;
    }

    return {
      totalAmount,
      count: expenses.length,
      byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })),
    };
  }
}
