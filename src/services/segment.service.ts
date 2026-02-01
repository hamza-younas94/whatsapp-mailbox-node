// src/services/segment.service.ts
// Contact segmentation logic

import { Segment } from '@prisma/client';
import { SegmentRepository } from '@repositories/segment.repository';
import { NotFoundError, ConflictError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateSegmentInput {
  name: string;
  criteria: Record<string, any>;
}

export interface ISegmentService {
  createSegment(userId: string, input: CreateSegmentInput): Promise<Segment>;
  getSegments(userId: string): Promise<Segment[]>;
  updateSegment(id: string, data: Partial<Segment>): Promise<Segment>;
  deleteSegment(id: string): Promise<void>;
  evaluateSegment(segmentId: string): Promise<string[]>;
}

export class SegmentService implements ISegmentService {
  constructor(private repository: SegmentRepository) {}

  async createSegment(userId: string, input: CreateSegmentInput): Promise<Segment> {
    try {
      const segment = await this.repository.create({
        userId,
        name: input.name,
        criteria: input.criteria,
      });

      logger.info({ id: segment.id }, 'Segment created');
      return segment;
    } catch (error) {
      logger.error({ input, error }, 'Failed to create segment');
      throw error;
    }
  }

  async getSegments(userId: string): Promise<Segment[]> {
    return this.repository.findByUserId(userId);
  }

  async updateSegment(id: string, data: Partial<Segment>): Promise<Segment> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError('Segment');
    }

    return this.repository.update(id, data);
  }

  async deleteSegment(id: string): Promise<void> {
    await this.repository.delete(id);
    logger.info({ id }, 'Segment deleted');
  }

  async getSegmentContacts(segmentId: string): Promise<any[]> {
    return this.evaluateSegment(segmentId).then(ids => ids.map(id => ({ id })));
  }

  async evaluateSegment(segmentId: string): Promise<string[]> {
    return this.repository.evaluateSegment(segmentId);
  }
}
