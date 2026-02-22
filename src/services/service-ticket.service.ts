// src/services/service-ticket.service.ts
// Service Ticket business logic

import { ServiceTicket, TicketStatus, TicketPriority, TicketUpdateType } from '@prisma/client';
import { ServiceTicketRepository } from '@repositories/service-ticket.repository';
import { NotFoundError, ValidationError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateTicketInput {
  contactId: string;
  title: string;
  description?: string;
  category?: string;
  priority?: TicketPriority;
  deviceType?: string;
  deviceModel?: string;
  serialNumber?: string;
  problemDescription?: string;
  estimatedCost?: number;
  estimatedCompletionDate?: string;
  assignedTo?: string;
}

export interface AddTicketUpdateInput {
  updateType?: TicketUpdateType;
  content?: string;
}

export interface AddPartInput {
  productId?: string;
  partName: string;
  quantity: number;
  cost: number;
  price: number;
}

export class ServiceTicketService {
  constructor(private repository: ServiceTicketRepository) {}

  async createTicket(userId: string, input: CreateTicketInput): Promise<ServiceTicket> {
    const ticketNumber = await this.repository.getNextTicketNumber(userId);

    const ticket = await this.repository.create({
      userId,
      contactId: input.contactId,
      ticketNumber,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority || 'MEDIUM',
      deviceType: input.deviceType,
      deviceModel: input.deviceModel,
      serialNumber: input.serialNumber,
      problemDescription: input.problemDescription,
      estimatedCost: input.estimatedCost,
      estimatedCompletionDate: input.estimatedCompletionDate
        ? new Date(input.estimatedCompletionDate)
        : undefined,
      assignedTo: input.assignedTo,
    });

    logger.info({ id: ticket.id, ticketNumber }, 'Service ticket created');
    return ticket;
  }

  async getTickets(
    userId: string,
    options: {
      status?: string;
      priority?: string;
      category?: string;
      contactId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.findByUserId(userId, {
      status: options.status as TicketStatus,
      priority: options.priority as TicketPriority,
      category: options.category,
      contactId: options.contactId,
      search: options.search,
      skip,
      take: limit,
    });

    return {
      items,
      pagination: { total, page, perPage: limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTicket(id: string) {
    const ticket = await this.repository.findByIdWithDetails(id);
    if (!ticket) throw new NotFoundError('Service ticket');
    return ticket;
  }

  async updateTicket(
    id: string,
    userId: string,
    data: Partial<{
      status: TicketStatus;
      priority: TicketPriority;
      category: string;
      diagnosisNotes: string;
      estimatedCost: number;
      actualCost: number;
      estimatedCompletionDate: string;
      actualCompletionDate: string;
      assignedTo: string;
      notes: string;
    }>
  ): Promise<ServiceTicket> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Service ticket');

    const updateData: any = { ...data };
    if (data.estimatedCompletionDate) updateData.estimatedCompletionDate = new Date(data.estimatedCompletionDate);
    if (data.actualCompletionDate) updateData.actualCompletionDate = new Date(data.actualCompletionDate);

    // Log status change
    if (data.status && data.status !== (existing as any).status) {
      await this.repository.addUpdate({
        ticketId: id,
        userId,
        updateType: 'STATUS_CHANGE',
        content: `Status changed from ${(existing as any).status} to ${data.status}`,
        oldStatus: (existing as any).status,
        newStatus: data.status,
      });
    }

    // Log notes as update
    if (data.notes) {
      await this.repository.addUpdate({
        ticketId: id,
        userId,
        updateType: 'NOTE',
        content: data.notes,
      });
      delete updateData.notes;
    }

    const ticket = await this.repository.update(id, updateData);
    logger.info({ id, status: data.status }, 'Service ticket updated');
    return ticket;
  }

  async addUpdate(ticketId: string, userId: string, input: AddTicketUpdateInput) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Service ticket');

    const update = await this.repository.addUpdate({
      ticketId,
      userId,
      updateType: input.updateType || 'NOTE',
      content: input.content,
    });

    logger.info({ ticketId, updateType: input.updateType }, 'Ticket update added');
    return update;
  }

  async addPart(ticketId: string, input: AddPartInput) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Service ticket');

    const part = await this.repository.addPart({
      ticketId,
      productId: input.productId,
      partName: input.partName,
      quantity: input.quantity,
      cost: input.cost,
      price: input.price,
    });

    logger.info({ ticketId, partName: input.partName }, 'Service part added');
    return part;
  }

  async updatePart(ticketId: string, partId: string, data: { status?: string; quantity?: number; cost?: number; price?: number }) {
    const ticket = await this.repository.findById(ticketId);
    if (!ticket) throw new NotFoundError('Service ticket');

    const part = await this.repository.updatePart(partId, data);
    logger.info({ ticketId, partId }, 'Service part updated');
    return part;
  }
}
