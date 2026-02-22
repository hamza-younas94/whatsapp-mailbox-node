// src/repositories/invoice.repository.ts
// Invoice & Payment data access

import { PrismaClient, Invoice, Payment, InvoiceStatus } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class InvoiceRepository extends BaseRepository<Invoice> {
  protected modelName = 'invoice' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(
    userId: string,
    options: {
      status?: InvoiceStatus;
      contactId?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<{ items: Invoice[]; total: number }> {
    const where: any = { userId };

    if (options.status) where.status = options.status;
    if (options.contactId) where.contactId = options.contactId;
    if (options.startDate || options.endDate) {
      where.invoiceDate = {};
      if (options.startDate) where.invoiceDate.gte = options.startDate;
      if (options.endDate) where.invoiceDate.lte = options.endDate;
    }
    if (options.search) {
      where.OR = [
        { invoiceNumber: { contains: options.search } },
        { notes: { contains: options.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          contact: { select: { id: true, name: true, phoneNumber: true, email: true } },
          _count: { select: { items: true, payments: true } },
        },
        skip: options.skip || 0,
        take: Math.min(options.take || 20, 100),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdWithDetails(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, name: true, phoneNumber: true, email: true, company: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
          orderBy: { createdAt: 'asc' },
        },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
  }

  async getNextInvoiceNumber(userId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${dateStr}-`;

    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { userId, invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
    });

    if (lastInvoice) {
      const lastNum = parseInt(lastInvoice.invoiceNumber.slice(-4));
      return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  async createWithItems(
    data: any,
    items: any[]
  ): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({ data });

      if (items.length > 0) {
        await tx.invoiceItem.createMany({
          data: items.map((item) => ({
            ...item,
            invoiceId: invoice.id,
          })),
        });
      }

      return tx.invoice.findUnique({
        where: { id: invoice.id },
        include: { items: true, contact: true },
      }) as Promise<Invoice>;
    });
  }

  async updateWithItems(id: string, data: any, items?: any[]): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id }, data });

      if (items) {
        // Delete existing items and recreate
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        if (items.length > 0) {
          await tx.invoiceItem.createMany({
            data: items.map((item) => ({ ...item, invoiceId: id })),
          });
        }
      }

      return tx.invoice.findUnique({
        where: { id },
        include: { items: true, contact: true, payments: true },
      }) as Promise<Invoice>;
    });
  }

  async addPayment(data: any): Promise<Payment> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data });

      // Update invoice paid/balance amounts
      const invoice = await tx.invoice.findUnique({
        where: { id: data.invoiceId },
        include: { payments: true },
      });

      if (invoice) {
        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0) + data.amount;
        const balance = invoice.totalAmount - totalPaid;

        let status: InvoiceStatus = invoice.status;
        if (balance <= 0) status = 'PAID';
        else if (totalPaid > 0) status = 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: { id: data.invoiceId },
          data: { paidAmount: totalPaid, balanceAmount: Math.max(0, balance), status },
        });
      }

      return payment;
    });
  }

  async getPayments(invoiceId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paymentDate: 'desc' },
    });
  }
}
