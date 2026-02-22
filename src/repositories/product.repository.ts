// src/repositories/product.repository.ts
// Product & Inventory data access

import { PrismaClient, Product, InventoryTransaction, InventoryType } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class ProductRepository extends BaseRepository<Product> {
  protected modelName = 'product' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(
    userId: string,
    options: {
      category?: string;
      isActive?: boolean;
      lowStock?: boolean;
      search?: string;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<{ items: Product[]; total: number }> {
    const where: any = { userId };

    if (options.category) where.category = options.category;
    if (options.isActive !== undefined) where.isActive = options.isActive;
    if (options.lowStock) {
      where.stockQuantity = { lte: this.prisma.$queryRaw`lowStockAlert` };
      // Use raw comparison: stockQuantity <= lowStockAlert
      where.AND = [
        { isActive: true },
        { stockQuantity: { gt: -1 } }, // placeholder, real logic below
      ];
    }
    if (options.search) {
      where.OR = [
        { name: { contains: options.search } },
        { description: { contains: options.search } },
        { sku: { contains: options.search } },
      ];
    }

    // For low stock, use a raw approach
    if (options.lowStock) {
      delete where.AND;
      delete where.stockQuantity;
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where: options.lowStock
          ? {
              userId,
              isActive: true,
              ...(options.search
                ? {
                    OR: [
                      { name: { contains: options.search } },
                      { description: { contains: options.search } },
                      { sku: { contains: options.search } },
                    ],
                  }
                : {}),
            }
          : where,
        skip: options.skip || 0,
        take: Math.min(options.take || 20, 100),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where: options.lowStock ? { userId, isActive: true } : where }),
    ]);

    // Filter low stock in memory (stockQuantity <= lowStockAlert)
    if (options.lowStock) {
      const filtered = items.filter((p) => p.stockQuantity <= p.lowStockAlert);
      return { items: filtered, total: filtered.length };
    }

    return { items, total };
  }

  async findByIdWithInventory(id: string): Promise<(Product & { inventoryTransactions: InventoryTransaction[] }) | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        inventoryTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
  }

  async findBySku(userId: string, sku: string): Promise<Product | null> {
    return this.prisma.product.findUnique({
      where: { userId_sku: { userId, sku } },
    });
  }

  async adjustStock(
    productId: string,
    userId: string,
    type: InventoryType,
    quantity: number,
    reason?: string,
    referenceId?: string,
    referenceType?: string
  ): Promise<InventoryTransaction> {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error('Product not found');

      let newStock = product.stockQuantity;
      if (type === 'IN') newStock += quantity;
      else if (type === 'OUT') newStock -= quantity;
      else newStock = quantity; // ADJUSTMENT sets absolute value

      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: Math.max(0, newStock) },
      });

      return tx.inventoryTransaction.create({
        data: {
          userId,
          productId,
          type,
          quantity,
          reason,
          referenceId,
          referenceType,
        },
      });
    });
  }

  async getInventoryHistory(
    productId: string,
    skip: number = 0,
    take: number = 50
  ): Promise<{ items: InventoryTransaction[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(take, 100),
      }),
      this.prisma.inventoryTransaction.count({ where: { productId } }),
    ]);
    return { items, total };
  }
}
