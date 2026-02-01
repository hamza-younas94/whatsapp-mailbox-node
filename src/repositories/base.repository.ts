// src/repositories/base.repository.ts
// Abstract base repository implementing Repository pattern
// Principle: Abstraction, Dependency Inversion (SOLID)

import { PrismaClient } from '@prisma/client';
import logger from '@utils/logger';

export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(skip?: number, take?: number): Promise<T[]>;
  create(data: unknown): Promise<T>;
  update(id: string, data: unknown): Promise<T>;
  delete(id: string): Promise<T>;
}

export abstract class BaseRepository<T> implements IRepository<T> {
  protected abstract modelName: keyof PrismaClient;

  constructor(protected prisma: PrismaClient) {}

  protected get model(): any {
    return this.prisma[this.modelName];
  }

  async findById(id: string): Promise<T | null> {
    try {
      return await this.model.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error({ id, error }, `Failed to find ${String(this.modelName)}`);
      throw error;
    }
  }

  async findAll(skip: number = 0, take: number = 10): Promise<T[]> {
    try {
      return await this.model.findMany({
        skip,
        take: Math.min(take, 100), // Max 100 items per query
      });
    } catch (error) {
      logger.error({ error }, `Failed to find all ${String(this.modelName)}`);
      throw error;
    }
  }

  async create(data: unknown): Promise<T> {
    try {
      return await this.model.create({
        data,
      });
    } catch (error) {
      logger.error({ data, error }, `Failed to create ${String(this.modelName)}`);
      throw error;
    }
  }

  async update(id: string, data: unknown): Promise<T> {
    try {
      return await this.model.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error({ id, data, error }, `Failed to update ${String(this.modelName)}`);
      throw error;
    }
  }

  async delete(id: string): Promise<T> {
    try {
      return await this.model.delete({
        where: { id },
      });
    } catch (error) {
      logger.error({ id, error }, `Failed to delete ${String(this.modelName)}`);
      throw error;
    }
  }

  async count(where?: unknown): Promise<number> {
    try {
      return await this.model.count({ where });
    } catch (error) {
      logger.error({ error }, `Failed to count ${String(this.modelName)}`);
      throw error;
    }
  }
}
