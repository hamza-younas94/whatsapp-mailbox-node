// src/routes/orders.ts
// Orders API routes

import { Router } from 'express';
import { OrderController } from '@controllers/order.controller';
import { OrderService } from '@services/order.service';
import { OrderRepository } from '@repositories/order.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Initialize dependencies
const prisma = getPrismaClient();
const repository = new OrderRepository(prisma);
const service = new OrderService(repository);
const controller = new OrderController(service);

// Validation schemas
const orderItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  specialInstructions: z.string().optional(),
});

const createOrderSchema = z.object({
  contactId: z.string().min(1),
  orderType: z.enum(['DELIVERY', 'PICKUP', 'DINE_IN']).optional(),
  deliveryAddress: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  estimatedDeliveryTime: z.string().optional(),
  deliveryFee: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  paymentStatus: z.enum(['ORDER_PAYMENT_PENDING', 'PAID', 'COD']).optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
});

const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['ORDER_PAYMENT_PENDING', 'PAID', 'COD']).optional(),
  deliveryAddress: z.string().optional(),
  deliveryInstructions: z.string().optional(),
  estimatedDeliveryTime: z.string().optional(),
  actualDeliveryTime: z.string().optional(),
  notes: z.string().optional(),
});

// Apply authentication
router.use(authenticate);

// Routes
router.post('/', validateRequest(createOrderSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id', validateRequest(updateOrderSchema), controller.update);
router.delete('/:id', controller.delete);

export default router;
