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

export default router;
