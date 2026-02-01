// src/services/shop.service.ts
// Shop and invoicing service

import { PrismaClient, Shop, Product, Order, Invoice, Payment } from '@prisma/client';
import logger from '@utils/logger';

export class ShopService {
  constructor(private prisma: PrismaClient) {}

  // ============================================
  // SHOP MANAGEMENT
  // ============================================

  async createShop(userId: string, data: {
    name: string;
    description?: string;
    type?: 'PHYSICAL' | 'ONLINE' | 'BOTH';
    currency?: string;
    taxRate?: number;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  }): Promise<Shop> {
    return this.prisma.shop.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async getShops(userId: string): Promise<Shop[]> {
    return this.prisma.shop.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getShop(id: string): Promise<Shop | null> {
    return this.prisma.shop.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            orders: true,
            invoices: true,
          },
        },
      },
    });
  }

  async updateShop(id: string, data: Partial<Shop>): Promise<Shop> {
    const { id: _id, userId, createdAt, updatedAt, metadata, ...updateData } = data;
    return this.prisma.shop.update({
      where: { id },
      data: {
        ...updateData,
        ...(metadata && { metadata }),
      },
    });
  }

  async deleteShop(id: string): Promise<void> {
    await this.prisma.shop.delete({
      where: { id },
    });
  }

  // ============================================
  // PRODUCT MANAGEMENT
  // ============================================

  async createProduct(shopId: string, data: {
    sku?: string;
    name: string;
    description?: string;
    category?: string;
    price: number;
    cost?: number;
    stock?: number;
    lowStockThreshold?: number;
    imageUrl?: string;
  }): Promise<Product> {
    return this.prisma.product.create({
      data: {
        shopId,
        ...data,
      },
    });
  }

  async getProducts(shopId: string, filters?: {
    category?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        shopId,
        ...(filters?.category && { category: filters.category }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search } },
            { description: { contains: filters.search } },
            { sku: { contains: filters.search } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProduct(id: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { id },
    });
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const { id: _id, shopId, createdAt, updatedAt, metadata, ...updateData } = data;
    return this.prisma.product.update({
      where: { id },
      data: {
        ...updateData,
        ...(metadata && { metadata }),
      },
    });
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data: {
        stock: {
          increment: quantity,
        },
      },
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await this.prisma.product.delete({
      where: { id },
    });
  }

  // ============================================
  // ORDER MANAGEMENT
  // ============================================

  async createOrder(shopId: string, contactId: string, data: {
    items: Array<{
      productId?: string;
      name: string;
      description?: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
    }>;
    notes?: string;
    shippingAddress?: string;
    paymentMethod?: string;
    discount?: number;
    shipping?: number;
  }): Promise<Order> {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new Error('Shop not found');

    // Generate order number
    const orderCount = await this.prisma.order.count({ where: { shopId } });
    const orderNumber = `ORD-${String(orderCount + 1).padStart(6, '0')}`;

    // Calculate totals
    let subtotal = 0;
    const processedItems = data.items.map((item) => {
      const itemTotal = item.quantity * item.unitPrice - (item.discount || 0);
      subtotal += itemTotal;
      return {
        ...item,
        total: itemTotal,
      };
    });

    const tax = subtotal * (shop.taxRate || 0);
    const total = subtotal + tax - (data.discount || 0) + (data.shipping || 0);

    // Create order with items
    return this.prisma.order.create({
      data: {
        shopId,
        contactId,
        orderNumber,
        subtotal,
        tax,
        discount: data.discount || 0,
        shipping: data.shipping || 0,
        total,
        notes: data.notes,
        shippingAddress: data.shippingAddress,
        paymentMethod: data.paymentMethod,
        items: {
          create: processedItems,
        },
      },
      include: {
        items: true,
        contact: true,
      },
    });
  }

  async getOrders(shopId: string, filters?: {
    status?: string;
    contactId?: string;
    paymentStatus?: string;
  }): Promise<Order[]> {
    return this.prisma.order.findMany({
      where: {
        shopId,
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.contactId && { contactId: filters.contactId }),
        ...(filters?.paymentStatus && { paymentStatus: filters.paymentStatus as any }),
      },
      include: {
        items: true,
        contact: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrder(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        contact: true,
        invoices: true,
        payments: true,
      },
    });
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async updatePaymentStatus(id: string, paymentStatus: string): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data: { paymentStatus: paymentStatus as any },
    });
  }

  // ============================================
  // INVOICE MANAGEMENT
  // ============================================

  async createInvoice(shopId: string, contactId: string, data: {
    orderId?: string;
    items: Array<{
      productId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
    }>;
    dueDate?: Date;
    notes?: string;
    terms?: string;
    discount?: number;
  }): Promise<Invoice> {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new Error('Shop not found');

    // Generate invoice number
    const invoiceCount = await this.prisma.invoice.count({ where: { shopId } });
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Calculate totals
    let subtotal = 0;
    const processedItems = data.items.map((item) => {
      const itemTotal = item.quantity * item.unitPrice - (item.discount || 0);
      subtotal += itemTotal;
      return {
        ...item,
        total: itemTotal,
      };
    });

    const tax = subtotal * (shop.taxRate || 0);
    const total = subtotal + tax - (data.discount || 0);

    return this.prisma.invoice.create({
      data: {
        shopId,
        contactId,
        orderId: data.orderId,
        invoiceNumber,
        subtotal,
        tax,
        discount: data.discount || 0,
        total,
        dueDate: data.dueDate,
        notes: data.notes,
        terms: data.terms,
        items: {
          create: processedItems,
        },
      },
      include: {
        items: true,
        contact: true,
      },
    });
  }

  async getInvoices(shopId: string, filters?: {
    status?: string;
    contactId?: string;
  }): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: {
        shopId,
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.contactId && { contactId: filters.contactId }),
      },
      include: {
        items: true,
        contact: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        contact: true,
        order: true,
        payments: true,
      },
    });
  }

  async updateInvoiceStatus(id: string, status: string): Promise<Invoice> {
    const data: any = { status: status as any };
    if (status === 'PAID') {
      data.paidDate = new Date();
    }
    return this.prisma.invoice.update({
      where: { id },
      data,
    });
  }

  async sendInvoice(id: string): Promise<Invoice> {
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'SENT' },
    });
  }

  // ============================================
  // PAYMENT MANAGEMENT
  // ============================================

  async recordPayment(shopId: string, data: {
    invoiceId?: string;
    orderId?: string;
    contactId: string;
    amount: number;
    method: string;
    reference?: string;
    notes?: string;
    paymentDate?: Date;
  }): Promise<Payment> {
    const payment = await this.prisma.payment.create({
      data: {
        shopId,
        ...data,
        method: data.method as any,
      },
    });

    // Update invoice if specified
    if (data.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: data.invoiceId },
      });

      if (invoice) {
        const newAmountPaid = invoice.amountPaid + data.amount;
        const newStatus =
          newAmountPaid >= invoice.total
            ? 'PAID'
            : newAmountPaid > 0
            ? 'SENT' // Keep as sent if partially paid
            : invoice.status;

        await this.prisma.invoice.update({
          where: { id: data.invoiceId },
          data: {
            amountPaid: newAmountPaid,
            status: newStatus as any,
            ...(newStatus === 'PAID' && { paidDate: new Date() }),
          },
        });
      }
    }

    // Update order if specified
    if (data.orderId) {
      await this.prisma.order.update({
        where: { id: data.orderId },
        data: { paymentStatus: 'PAID' as any },
      });
    }

    return payment;
  }

  async getPayments(shopId: string, filters?: {
    invoiceId?: string;
    orderId?: string;
    contactId?: string;
  }): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: {
        shopId,
        ...filters,
      },
      include: {
        contact: true,
        invoice: true,
        order: true,
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getShopStats(shopId: string) {
    const [totalRevenue, totalOrders, pendingInvoices, lowStockProducts] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { shopId },
        _sum: { amount: true },
      }),
      this.prisma.order.count({ where: { shopId } }),
      this.prisma.invoice.count({
        where: {
          shopId,
          status: { in: ['SENT', 'OVERDUE'] },
        },
      }),
      this.prisma.product.count({
        where: {
          shopId,
          isActive: true,
          stock: { lte: this.prisma.product.fields.lowStockThreshold },
        },
      }),
    ]);

    return {
      totalRevenue: totalRevenue._sum.amount || 0,
      totalOrders,
      pendingInvoices,
      lowStockProducts,
    };
  }
}
