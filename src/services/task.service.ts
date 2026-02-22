// src/services/task.service.ts
// Task business logic

import { Task, TaskStatus, TaskPriority } from '@prisma/client';
import { TaskRepository } from '@repositories/task.repository';
import { NotFoundError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateTaskInput {
  contactId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: TaskPriority;
}

export class TaskService {
  constructor(private repository: TaskRepository) {}

  async createTask(userId: string, input: CreateTaskInput): Promise<Task> {
    const task = await this.repository.create({
      userId,
      contactId: input.contactId || undefined,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      priority: input.priority || 'TASK_MEDIUM',
    });
    logger.info({ id: task.id, title: input.title }, 'Task created');
    return task;
  }

  async getTasks(
    userId: string,
    options: { status?: string; priority?: string; contactId?: string; dueBefore?: string; dueAfter?: string; page?: number; limit?: number } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.findByUserId(userId, {
      status: options.status as TaskStatus,
      priority: options.priority as TaskPriority,
      contactId: options.contactId,
      dueBefore: options.dueBefore ? new Date(options.dueBefore) : undefined,
      dueAfter: options.dueAfter ? new Date(options.dueAfter) : undefined,
      skip,
      take: limit,
    });

    return { items, pagination: { total, page, perPage: limit, totalPages: Math.ceil(total / limit) } };
  }

  async getTask(id: string) {
    const task = await this.repository.findByIdWithContact(id);
    if (!task) throw new NotFoundError('Task');
    return task;
  }

  async updateTask(id: string, data: Partial<{
    title: string; description: string; dueDate: string; priority: TaskPriority;
    status: TaskStatus; contactId: string;
  }>): Promise<Task> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Task');

    const updateData: any = { ...data };
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
    if (data.status === 'TASK_COMPLETED') updateData.completedAt = new Date();

    const task = await this.repository.update(id, updateData);
    logger.info({ id, status: data.status }, 'Task updated');
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Task');
    await this.repository.delete(id);
    logger.info({ id }, 'Task deleted');
  }
}
