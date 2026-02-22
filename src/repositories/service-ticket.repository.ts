// src/repositories/service-ticket.repository.ts
// Service Ticket data access

import { PrismaClient, ServiceTicket, TicketStatus, TicketPriority, TicketUpdateType } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class ServiceTicketRepository extends BaseRepository<ServiceTicket> {
  protected modelName = 'serviceTicket' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(
    userId: string,
    options: {
      status?: TicketStatus;
      priority?: TicketPriority;
      category?: string;
      contactId?: string;
      search?: string;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<{ items: ServiceTicket[]; total: number }> {
    const where: any = { userId };

    if (options.status) where.status = options.status;
    if (options.priority) where.priority = options.priority;
    if (options.category) where.category = options.category;
    if (options.contactId) where.contactId = options.contactId;
    if (options.search) {
      where.OR = [
        { ticketNumber: { contains: options.search } },
        { title: { contains: options.search } },
        { description: { contains: options.search } },
        { serialNumber: { contains: options.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.serviceTicket.findMany({
        where,
        include: {
          contact: { select: { id: true, name: true, phoneNumber: true } },
          _count: { select: { updates: true, parts: true } },
        },
        skip: options.skip || 0,
        take: Math.min(options.take || 20, 100),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.serviceTicket.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdWithDetails(id: string) {
    return this.prisma.serviceTicket.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, name: true, phoneNumber: true, email: true } },
        updates: { orderBy: { createdAt: 'desc' } },
        parts: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });
  }

  async getNextTicketNumber(userId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `TKT-${dateStr}-`;

    const lastTicket = await this.prisma.serviceTicket.findFirst({
      where: { userId, ticketNumber: { startsWith: prefix } },
      orderBy: { ticketNumber: 'desc' },
    });

    if (lastTicket) {
      const lastNum = parseInt(lastTicket.ticketNumber.slice(-4));
      return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  async addUpdate(data: {
    ticketId: string;
    userId: string;
    updateType: TicketUpdateType;
    content?: string;
    oldStatus?: string;
    newStatus?: string;
  }) {
    return this.prisma.ticketUpdate.create({ data });
  }

  async addPart(data: {
    ticketId: string;
    productId?: string;
    partName: string;
    quantity: number;
    cost: number;
    price: number;
    status?: string;
  }) {
    return this.prisma.servicePart.create({ data: data as any });
  }

  async updatePart(partId: string, data: any) {
    return this.prisma.servicePart.update({ where: { id: partId }, data });
  }
}
