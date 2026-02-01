import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Get all shops for logged-in user
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

// Get products for a shop
router.get('/products/shop/:shopId', authenticate, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { shopId: req.params.shopId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get customers for a shop
router.get('/customers/shop/:shopId', authenticate, async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { shopId: req.params.shopId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: customers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get transactions for a shop
router.get('/transactions/shop/:shopId', authenticate, async (req, res) => {
  try {
    const transactions = await prisma.salesTransaction.findMany({
      where: { shopId: req.params.shopId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: transactions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get analytics for a shop
router.get('/analytics/shop/:shopId', authenticate, async (req, res) => {
  try {
    const [customers, products, transactions] = await Promise.all([
      prisma.customer.count({ where: { shopId: req.params.shopId } }),
      prisma.product.count({ where: { shopId: req.params.shopId } }),
      prisma.salesTransaction.count({ where: { shopId: req.params.shopId } }),
    ]);

    const totalSales = await prisma.salesTransaction.aggregate({
      where: { shopId: req.params.shopId },
      _sum: { finalAmount: true },
    });

    res.json({
      success: true,
      data: {
        totalCustomers: customers,
        totalProducts: products,
        totalOrders: transactions,
        totalSales: totalSales._sum.finalAmount || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create product
router.post('/shop-system/products', authenticate, async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: {
        id: `prod_${Date.now()}`,
        shopId: req.body.shopId,
        name: req.body.name,
        sku: req.body.sku,
        description: req.body.description,
        price: req.body.price,
        cost: req.body.cost || 0,
        stock: req.body.stock,
        lowStockThreshold: req.body.lowStockThreshold || 5,
        unit: req.body.unit || 'pcs',
        isActive: true,
      },
    });
    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create customer
router.post('/shop-system/customers', authenticate, async (req, res) => {
  try {
    const customer = await prisma.customer.create({
      data: {
        id: `cust_${Date.now()}`,
        shopId: req.body.shopId,
        name: req.body.name,
        phone: req.body.phone,
        email: req.body.email,
        address: req.body.address,
        city: req.body.city,
        customerGroup: req.body.customerGroup || 'retail',
        updatedAt: new Date(),
        isActive: true,
      },
    });
    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create transaction
router.post('/shop-system/transactions', authenticate, async (req, res) => {
  try {
    const transaction = await prisma.salesTransaction.create({
      data: {
        id: `txn_${Date.now()}`,
        transactionNumber: `TXN-${Date.now()}`,
        shopId: req.body.shopId,
        customerId: req.body.customerId,
        status: req.body.status || 'CONFIRMED',
        totalAmount: req.body.totalAmount,
        discountAmount: req.body.discountAmount || 0,
        taxAmount: req.body.taxAmount,
        finalAmount: req.body.finalAmount,
        paidAmount: req.body.paidAmount,
        paymentStatus: req.body.paymentStatus,
        paymentMethod: req.body.paymentMethod,
        notes: req.body.notes,
        createdBy: req.user!.id,
        updatedAt: new Date(),
      },
    });
    res.json({ success: true, data: transaction });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
