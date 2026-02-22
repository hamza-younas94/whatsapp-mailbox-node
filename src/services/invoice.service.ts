// src/services/invoice.service.ts
// Invoice & Payment business logic

import { Invoice, InvoiceStatus, PaymentMethod } from '@prisma/client';
import { InvoiceRepository } from '@repositories/invoice.repository';
import { NotFoundError, ValidationError } from '@utils/errors';
import logger from '@utils/logger';

export interface InvoiceItemInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discountAmount?: number;
}

export interface CreateInvoiceInput {
  contactId: string;
  invoiceDate?: string;
  dueDate?: string;
  notes?: string;
  terms?: string;
  items: InvoiceItemInput[];
}

export interface RecordPaymentInput {
  amount: number;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  referenceNumber?: string;
  notes?: string;
}

export class InvoiceService {
  constructor(private repository: InvoiceRepository) {}

  private calculateItemTotal(item: InvoiceItemInput): number {
    const lineTotal = item.quantity * item.unitPrice;
    const tax = lineTotal * ((item.taxRate || 0) / 100);
    return lineTotal + tax - (item.discountAmount || 0);
  }

  private calculateInvoiceTotals(items: InvoiceItemInput[]) {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    for (const item of items) {
      const lineTotal = item.quantity * item.unitPrice;
      subtotal += lineTotal;
      taxAmount += lineTotal * ((item.taxRate || 0) / 100);
      discountAmount += item.discountAmount || 0;
    }

    const totalAmount = subtotal + taxAmount - discountAmount;
    return { subtotal, taxAmount, discountAmount, totalAmount };
  }

  async createInvoice(userId: string, input: CreateInvoiceInput): Promise<Invoice> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Invoice must have at least one item');
    }

    const invoiceNumber = await this.repository.getNextInvoiceNumber(userId);
    const totals = this.calculateInvoiceTotals(input.items);

    const invoiceData = {
      userId,
      contactId: input.contactId,
      invoiceNumber,
      invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      status: 'DRAFT' as InvoiceStatus,
      ...totals,
      balanceAmount: totals.totalAmount,
      paidAmount: 0,
      notes: input.notes,
      terms: input.terms,
    };

    const items = input.items.map((item) => ({
      productId: item.productId || undefined,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate || 0,
      discountAmount: item.discountAmount || 0,
      totalAmount: this.calculateItemTotal(item),
    }));

    const invoice = await this.repository.createWithItems(invoiceData, items);
    logger.info({ id: invoice.id, invoiceNumber }, 'Invoice created');
    return invoice;
  }

  async getInvoices(
    userId: string,
    options: {
      status?: string;
      contactId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.findByUserId(userId, {
      status: options.status as InvoiceStatus,
      contactId: options.contactId,
      startDate: options.startDate ? new Date(options.startDate) : undefined,
      endDate: options.endDate ? new Date(options.endDate) : undefined,
      search: options.search,
      skip,
      take: limit,
    });

    return {
      items,
      pagination: { total, page, perPage: limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getInvoice(id: string) {
    const invoice = await this.repository.findByIdWithDetails(id);
    if (!invoice) throw new NotFoundError('Invoice');
    return invoice;
  }

  async updateInvoice(id: string, input: Partial<CreateInvoiceInput>): Promise<Invoice> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Invoice');

    const updateData: any = {};
    if (input.contactId) updateData.contactId = input.contactId;
    if (input.invoiceDate) updateData.invoiceDate = new Date(input.invoiceDate);
    if (input.dueDate) updateData.dueDate = new Date(input.dueDate);
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.terms !== undefined) updateData.terms = input.terms;

    let items: any[] | undefined;
    if (input.items) {
      const totals = this.calculateInvoiceTotals(input.items);
      Object.assign(updateData, totals);
      updateData.balanceAmount = totals.totalAmount - (existing as any).paidAmount;

      items = input.items.map((item) => ({
        productId: item.productId || undefined,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 0,
        discountAmount: item.discountAmount || 0,
        totalAmount: this.calculateItemTotal(item),
      }));
    }

    const invoice = await this.repository.updateWithItems(id, updateData, items);
    logger.info({ id }, 'Invoice updated');
    return invoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Invoice');
    await this.repository.delete(id);
    logger.info({ id }, 'Invoice deleted');
  }

  async recordPayment(invoiceId: string, userId: string, input: RecordPaymentInput) {
    const invoice = await this.repository.findById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice');

    if (input.amount <= 0) throw new ValidationError('Payment amount must be greater than 0');

    const payment = await this.repository.addPayment({
      userId,
      invoiceId,
      contactId: (invoice as any).contactId,
      amount: input.amount,
      paymentMethod: input.paymentMethod || 'CASH',
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
      referenceNumber: input.referenceNumber,
      notes: input.notes,
    });

    logger.info({ invoiceId, amount: input.amount }, 'Payment recorded');
    return payment;
  }

  async getPayments(invoiceId: string) {
    const invoice = await this.repository.findById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice');
    return this.repository.getPayments(invoiceId);
  }
}
