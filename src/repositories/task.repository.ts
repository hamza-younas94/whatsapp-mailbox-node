// src/repositories/task.repository.ts
// Task data access

import { PrismaClient, Task, TaskStatus, TaskPriority } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class TaskRepository extends BaseRepository<Task> {
  protected modelName = 'task' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(
    userId: string,
    options: {
      status?: TaskStatus;
      priority?: TaskPriority;
      contactId?: string;
      dueBefore?: Date;
      dueAfter?: Date;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<{ items: Task[]; total: number }> {
    const where: any = { userId };

    if (options.status) where.status = options.status;
    if (options.priority) where.priority = options.priority;
    if (options.contactId) where.contactId = options.contactId;
    if (options.dueBefore || options.dueAfter) {
      where.dueDate = {};
      if (options.dueBefore) where.dueDate.lte = options.dueBefore;
      if (options.dueAfter) where.dueDate.gte = options.dueAfter;
    }

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          contact: { select: { id: true, name: true, phoneNumber: true } },
        },
        skip: options.skip || 0,
        take: Math.min(options.take || 20, 100),
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      }),
      this.prisma.task.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdWithContact(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, name: true, phoneNumber: true, email: true } },
      },
    });
  }
}
