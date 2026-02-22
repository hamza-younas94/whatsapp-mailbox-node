// src/routes/products.ts
// Products & Inventory API routes

import { Router } from 'express';
import { ProductController } from '@controllers/product.controller';
import { ProductService } from '@services/product.service';
import { ProductRepository } from '@repositories/product.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Initialize dependencies
const prisma = getPrismaClient();
const repository = new ProductRepository(prisma);
const service = new ProductService(repository);
const controller = new ProductController(service);

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional(),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  price: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  unit: z.string().max(20).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  lowStockAlert: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().url().optional(),
});

const updateProductSchema = createProductSchema.partial().extend({
  stockAdjustment: z.number().int().optional(),
  stockAdjustmentType: z.enum(['IN', 'OUT', 'ADJUSTMENT']).optional(),
  stockAdjustmentReason: z.string().optional(),
});

const inventorySchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.number().int().min(1),
  reason: z.string().optional(),
});

// Apply authentication
router.use(authenticate);

// Routes
router.post('/', validateRequest(createProductSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id', validateRequest(updateProductSchema), controller.update);
router.delete('/:id', controller.delete);
router.get('/:id/inventory', controller.getInventory);
router.post('/:id/inventory', validateRequest(inventorySchema), controller.addInventory);

export default router;
