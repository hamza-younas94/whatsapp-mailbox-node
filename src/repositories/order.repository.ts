// src/repositories/order.repository.ts
// Order data access

import { PrismaClient, Order, OrderStatus, OrderType, InventoryType } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class OrderRepository extends BaseRepository<Order> {
  protected modelName = 'order' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(
    userId: string,
    options: {
      status?: OrderStatus;
      orderType?: OrderType;
      startDate?: Date;
      endDate?: Date;
      contactId?: string;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<{ items: Order[]; total: number }> {
    const where: any = { userId };

    if (options.status) where.status = options.status;
    if (options.orderType) where.orderType = options.orderType;
    if (options.contactId) where.contactId = options.contactId;
    if (options.startDate || options.endDate) {
      where.orderDate = {};
      if (options.startDate) where.orderDate.gte = options.startDate;
      if (options.endDate) where.orderDate.lte = options.endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          contact: { select: { id: true, name: true, phoneNumber: true } },
          _count: { select: { items: true } },
        },
        skip: options.skip || 0,
        take: Math.min(options.take || 20, 100),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdWithDetails(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, name: true, phoneNumber: true, email: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async getNextOrderNumber(userId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `ORD-${dateStr}-`;

    const lastOrder = await this.prisma.order.findFirst({
      where: { userId, orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
    });

    if (lastOrder) {
      const lastNum = parseInt(lastOrder.orderNumber.slice(-4));
      return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  async createWithItemsAndStockDeduction(
    data: any,
    items: any[],
    userId: string
  ): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({ data });

      for (const item of items) {
        await tx.orderItem.create({
          data: { ...item, orderId: order.id },
        });

        // Deduct stock if product linked
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            const newStock = Math.max(0, product.stockQuantity - item.quantity);
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: newStock },
            });

            await tx.inventoryTransaction.create({
              data: {
                userId,
                productId: item.productId,
                type: 'OUT' as InventoryType,
                quantity: item.quantity,
                reason: `Order ${order.orderNumber}`,
                referenceId: order.id,
                referenceType: 'ORDER',
              },
            });
          }
        }
      }

      return tx.order.findUnique({
        where: { id: order.id },
        include: { items: true, contact: true },
      }) as Promise<Order>;
    });
  }
}
