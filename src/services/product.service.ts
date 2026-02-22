// src/services/product.service.ts
// Product & Inventory business logic

import { Product, InventoryType } from '@prisma/client';
import { ProductRepository } from '@repositories/product.repository';
import { NotFoundError, ConflictError, ValidationError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateProductInput {
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  price?: number;
  cost?: number;
  taxRate?: number;
  unit?: string;
  stockQuantity?: number;
  lowStockAlert?: number;
  isActive?: boolean;
  imageUrl?: string;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  stockAdjustment?: number;
  stockAdjustmentType?: InventoryType;
  stockAdjustmentReason?: string;
}

export class ProductService {
  constructor(private repository: ProductRepository) {}

  async createProduct(userId: string, input: CreateProductInput): Promise<Product> {
    if (input.sku) {
      const existing = await this.repository.findBySku(userId, input.sku);
      if (existing) {
        throw new ConflictError(`Product with SKU '${input.sku}' already exists`);
      }
    }

    const product = await this.repository.create({
      userId,
      ...input,
      stockQuantity: input.stockQuantity || 0,
      lowStockAlert: input.lowStockAlert || 5,
    });

    // Create initial stock transaction if stock > 0
    if (input.stockQuantity && input.stockQuantity > 0) {
      await this.repository.adjustStock(
        product.id,
        userId,
        'IN',
        input.stockQuantity,
        'Initial stock'
      );
    }

    logger.info({ id: product.id, sku: input.sku }, 'Product created');
    return product;
  }

  async getProducts(
    userId: string,
    options: {
      category?: string;
      isActive?: boolean;
      lowStock?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.findByUserId(userId, {
      ...options,
      skip,
      take: limit,
    });

    return {
      items,
      pagination: {
        total,
        page,
        perPage: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProduct(id: string) {
    const product = await this.repository.findByIdWithInventory(id);
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  async updateProduct(id: string, userId: string, input: UpdateProductInput): Promise<Product> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Product');

    // Check SKU uniqueness if changing
    if (input.sku && input.sku !== (existing as any).sku) {
      const duplicate = await this.repository.findBySku(userId, input.sku);
      if (duplicate) throw new ConflictError(`Product with SKU '${input.sku}' already exists`);
    }

    // Handle stock adjustment
    if (input.stockAdjustment !== undefined && input.stockAdjustmentType) {
      await this.repository.adjustStock(
        id,
        userId,
        input.stockAdjustmentType,
        input.stockAdjustment,
        input.stockAdjustmentReason || 'Manual adjustment'
      );
    }

    const { stockAdjustment, stockAdjustmentType, stockAdjustmentReason, ...updateData } = input;
    const product = await this.repository.update(id, updateData);
    logger.info({ id }, 'Product updated');
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Product');
    await this.repository.delete(id);
    logger.info({ id }, 'Product deleted');
  }

  async getInventoryHistory(productId: string, page: number = 1, limit: number = 50) {
    const existing = await this.repository.findById(productId);
    if (!existing) throw new NotFoundError('Product');

    const skip = (page - 1) * limit;
    const { items, total } = await this.repository.getInventoryHistory(productId, skip, limit);

    return {
      items,
      pagination: { total, page, perPage: limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async addInventoryTransaction(
    productId: string,
    userId: string,
    type: InventoryType,
    quantity: number,
    reason?: string
  ) {
    const existing = await this.repository.findById(productId);
    if (!existing) throw new NotFoundError('Product');

    if (quantity <= 0) throw new ValidationError('Quantity must be greater than 0');

    const transaction = await this.repository.adjustStock(productId, userId, type, quantity, reason);
    logger.info({ productId, type, quantity }, 'Inventory transaction created');
    return transaction;
  }
}
