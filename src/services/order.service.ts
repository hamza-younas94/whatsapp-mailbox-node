// src/services/order.service.ts
// Order business logic

import { Order, OrderStatus, OrderType } from '@prisma/client';
import { OrderRepository } from '@repositories/order.repository';
import { NotFoundError, ValidationError } from '@utils/errors';
import logger from '@utils/logger';

export interface OrderItemInput {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  specialInstructions?: string;
}

export interface CreateOrderInput {
  contactId: string;
  orderType?: OrderType;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  estimatedDeliveryTime?: string;
  deliveryFee?: number;
  discountAmount?: number;
  paymentStatus?: string;
  notes?: string;
  items: OrderItemInput[];
}

export class OrderService {
  constructor(private repository: OrderRepository) {}

  async createOrder(userId: string, input: CreateOrderInput): Promise<Order> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Order must have at least one item');
    }

    const orderNumber = await this.repository.getNextOrderNumber(userId);

    let subtotal = 0;
    let taxAmount = 0;
    const items = input.items.map((item) => {
      const total = item.quantity * item.unitPrice;
      subtotal += total;
      return {
        productId: item.productId || undefined,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: total,
        specialInstructions: item.specialInstructions,
      };
    });

    const deliveryFee = input.deliveryFee || 0;
    const discountAmount = input.discountAmount || 0;
    const totalAmount = subtotal + deliveryFee + taxAmount - discountAmount;

    const orderData = {
      userId,
      contactId: input.contactId,
      orderNumber,
      orderType: input.orderType || 'DELIVERY',
      subtotal,
      deliveryFee,
      taxAmount,
      discountAmount,
      totalAmount,
      deliveryAddress: input.deliveryAddress,
      deliveryInstructions: input.deliveryInstructions,
      estimatedDeliveryTime: input.estimatedDeliveryTime
        ? new Date(input.estimatedDeliveryTime)
        : undefined,
      paymentStatus: (input.paymentStatus as any) || 'ORDER_PAYMENT_PENDING',
      notes: input.notes,
    };

    const order = await this.repository.createWithItemsAndStockDeduction(
      orderData,
      items,
      userId
    );
    logger.info({ id: order.id, orderNumber }, 'Order created with stock deduction');
    return order;
  }

  async getOrders(
    userId: string,
    options: {
      status?: string;
      orderType?: string;
      contactId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.findByUserId(userId, {
      status: options.status as OrderStatus,
      orderType: options.orderType as OrderType,
      contactId: options.contactId,
      startDate: options.startDate ? new Date(options.startDate) : undefined,
      endDate: options.endDate ? new Date(options.endDate) : undefined,
      skip,
      take: limit,
    });

    return {
      items,
      pagination: { total, page, perPage: limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrder(id: string) {
    const order = await this.repository.findByIdWithDetails(id);
    if (!order) throw new NotFoundError('Order');
    return order;
  }

  async updateOrder(id: string, data: Partial<{
    status: OrderStatus;
    paymentStatus: string;
    deliveryAddress: string;
    deliveryInstructions: string;
    estimatedDeliveryTime: string;
    actualDeliveryTime: string;
    notes: string;
  }>): Promise<Order> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Order');

    const updateData: any = { ...data };
    if (data.estimatedDeliveryTime) updateData.estimatedDeliveryTime = new Date(data.estimatedDeliveryTime);
    if (data.actualDeliveryTime) updateData.actualDeliveryTime = new Date(data.actualDeliveryTime);

    const order = await this.repository.update(id, updateData);
    logger.info({ id, status: data.status }, 'Order updated');
    return order;
  }

  async deleteOrder(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Order');
    await this.repository.delete(id);
    logger.info({ id }, 'Order deleted');
  }
}
