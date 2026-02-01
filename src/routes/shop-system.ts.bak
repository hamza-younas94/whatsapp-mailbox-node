import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// ============================================
// SHOPS
// ============================================

// Create shop
router.post('/shops', authenticate, async (req, res) => {
  try {
    const { name, description, type, currency, taxRate, address, phone, email, website } = req.body;
    
    const shop = await prisma.shop.create({
      data: {
        userId: req.user!.id,
        name,
        description,
        type: type || 'PHYSICAL',
        currency: currency || 'PKR',
        taxRate: taxRate || 0,
        address,
        phone,
        email,
        website,
        isActive: true,
      },
    });

    res.json({ success: true, data: shop });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's shops
router.get('/shops', authenticate, async (req, res) => {
  try {
    const shops = await prisma.shop.findMany({
      where: { userId: req.user!.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: shops });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get shop by ID
router.get('/shops/:id', authenticate, async (req, res) => {
  try {
    const shop = await prisma.shop.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    res.json({ success: true, data: shop });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update shop
router.put('/shops/:id', authenticate, async (req, res) => {
  try {
    const shop = await prisma.shop.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json({ success: true, data: shop });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CUSTOMERS
// ============================================

// Create customer
router.post('/customers', authenticate, async (req, res) => {
  try {
    const { shopId, name, phone, email, address, city, customerGroup, contactId } = req.body;

    const customer = await prisma.customer.create({
      data: {
        shopId,
        name,
        phone,
        email,
        address,
        city,
        customerGroup: customerGroup || 'retail',
        contactId,
      },
    });

    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get customers by shop
router.get('/customers/shop/:shopId', authenticate, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { shopId: req.params.shopId, isActive: true },
      include: {
        contact: {
          select: { id: true, name: true, phoneNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get customer by ID
router.get('/customers/:id', authenticate, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        contact: true,
        _count: {
          select: {
            salesTransactions: true,
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRODUCTS
// ============================================

// Get products by shop
router.get('/products/shop/:shopId', authenticate, async (req, res) => {
  try {
    const { category, search } = req.query;
    
    const where: any = { shopId: req.params.shopId, isActive: true };
    
    if (category) {
      where.categoryId = category;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { sku: { contains: search as string } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create product
router.post('/products', authenticate, async (req, res) => {
  try {
    const { shopId, categoryId, name, description, sku, price, cost, stock, lowStockThreshold, unit } = req.body;

    const product = await prisma.product.create({
      data: {
        shopId,
        categoryId,
        name,
        description,
        sku,
        price,
        cost,
        stock: stock || 0,
        lowStockThreshold,
        unit,
      },
    });

    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update product
router.put('/products/:id', authenticate, async (req, res) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CATEGORIES
// ============================================

// Get categories by shop
router.get('/categories/shop/:shopId', authenticate, async (req, res) => {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { shopId: req.params.shopId, isActive: true },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create category
router.post('/categories', authenticate, async (req, res) => {
  try {
    const { shopId, name, description, parentId } = req.body;

    const category = await prisma.productCategory.create({
      data: {
        shopId,
        name,
        description,
        parentId,
      },
    });

    res.json({ success: true, data: category });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SALES TRANSACTIONS
// ============================================

// Create transaction
router.post('/transactions', authenticate, async (req, res) => {
  try {
    const { shopId, customerId, items, discountAmount, taxAmount, notes, deliveryAddress } = req.body;

    // Calculate totals
    let totalAmount = 0;
    items.forEach((item: any) => {
      totalAmount += item.quantity * item.unitPrice - (item.discount || 0);
    });

    const finalAmount = totalAmount - (discountAmount || 0) + (taxAmount || 0);

    // Generate transaction number
    const count = await prisma.salesTransaction.count({ where: { shopId } });
    const transactionNumber = `TXN-${String(count + 1).padStart(6, '0')}`;

    const transaction = await prisma.salesTransaction.create({
      data: {
        shopId,
        customerId,
        transactionNumber,
        totalAmount,
        discountAmount: discountAmount || 0,
        taxAmount: taxAmount || 0,
        finalAmount,
        status: 'CONFIRMED',
        notes,
        deliveryAddress,
        createdBy: req.user!.id,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            taxRate: item.taxRate || 0,
            totalPrice: item.quantity * item.unitPrice - (item.discount || 0),
          })),
        },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
        customer: { select: { name: true, phone: true } },
      },
    });

    // Update product stock
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });

      // Record stock movement
      await prisma.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'SALE',
          quantity: -item.quantity,
          reference: transactionNumber,
          createdBy: req.user!.id,
        },
      });
    }

    // Update customer stats
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalPurchases: { increment: finalAmount },
        totalOrders: { increment: 1 },
        lastPurchaseAt: new Date(),
      },
    });

    res.json({ success: true, data: transaction });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get transactions by shop
router.get('/transactions/shop/:shopId', authenticate, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const where: any = { shopId: req.params.shopId };
    
    if (status) {
      where.status = status;
    }
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const transactions = await prisma.salesTransaction.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: transactions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get transaction by ID
router.get('/transactions/:id', authenticate, async (req, res) => {
  try {
    const transaction = await prisma.salesTransaction.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    res.json({ success: true, data: transaction });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update transaction status
router.put('/transactions/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    const transaction = await prisma.salesTransaction.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({ success: true, data: transaction });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ANALYTICS
// ============================================

// Shop analytics
router.get('/analytics/shop/:shopId', authenticate, async (req, res) => {
  try {
    const shopId = req.params.shopId;

    // Get total sales
    const salesStats = await prisma.salesTransaction.aggregate({
      where: { shopId, status: { not: 'CANCELLED' } },
      _sum: { finalAmount: true },
      _count: true,
    });

    // Get product count
    const productCount = await prisma.product.count({
      where: { shopId, isActive: true },
    });

    // Get customer count
    const customerCount = await prisma.customer.count({
      where: { shopId, isActive: true },
    });

    // Get low stock products
    const lowStockProducts = await prisma.product.findMany({
      where: {
        shopId,
        isActive: true,
        lowStockThreshold: { not: null },
        stock: { lte: prisma.product.fields.lowStockThreshold },
      },
      select: { id: true, name: true, stock: true, lowStockThreshold: true },
      take: 10,
    });

    res.json({
      success: true,
      data: {
        totalSales: salesStats._sum.finalAmount || 0,
        totalOrders: salesStats._count || 0,
        totalProducts: productCount,
        totalCustomers: customerCount,
        lowStockProducts,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
