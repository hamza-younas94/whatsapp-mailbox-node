// src/routes/shops.ts
// Shop and invoicing API routes

import { Router, Request, Response, NextFunction } from 'express';
import { ShopService } from '@services/shop.service';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';
import { asyncHandler } from '@middleware/error.middleware';

const router = Router();

// Initialize service
const prisma = getPrismaClient();
const shopService = new ShopService(prisma);

// Validation schemas
const createShopSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['PHYSICAL', 'ONLINE', 'BOTH']).default('PHYSICAL'),
  currency: z.string().default('USD'),
  taxRate: z.number().min(0).max(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
});

const createProductSchema = z.object({
  shopId: z.string().cuid(),
  sku: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.number().min(0),
  cost: z.number().min(0).optional(),
  stock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(10),
  imageUrl: z.string().url().optional(),
});

const createOrderSchema = z.object({
  shopId: z.string().cuid(),
  contactId: z.string().cuid(),
  items: z.array(z.object({
    productId: z.string().cuid().optional(),
    name: z.string(),
    description: z.string().optional(),
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).default(0),
  })),
  notes: z.string().optional(),
  shippingAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
  discount: z.number().min(0).default(0),
  shipping: z.number().min(0).default(0),
});

const createInvoiceSchema = z.object({
  shopId: z.string().cuid(),
  contactId: z.string().cuid(),
  orderId: z.string().cuid().optional(),
  items: z.array(z.object({
    productId: z.string().cuid().optional(),
    description: z.string(),
    quantity: z.number().int().min(1),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).default(0),
  })),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  discount: z.number().min(0).default(0),
});

const recordPaymentSchema = z.object({
  shopId: z.string().cuid(),
  invoiceId: z.string().cuid().optional(),
  orderId: z.string().cuid().optional(),
  contactId: z.string().cuid(),
  amount: z.number().min(0),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CRYPTO', 'OTHER']),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paymentDate: z.string().datetime().optional(),
});

// Apply authentication to all routes
router.use(authenticate);

// ============================================
// SHOP ROUTES
// ============================================

router.post('/shops', validateRequest(createShopSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const shop = await shopService.createShop(userId, req.body);
  res.status(201).json({ success: true, data: shop });
}));

router.get('/shops', asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const shops = await shopService.getShops(userId);
  res.json({ success: true, data: shops });
}));

router.get('/shops/:id', asyncHandler(async (req: Request, res: Response) => {
  const shop = await shopService.getShop(req.params.id);
  if (!shop) {
    return res.status(404).json({ success: false, error: 'Shop not found' });
  }
  res.json({ success: true, data: shop });
}));

router.put('/shops/:id', asyncHandler(async (req: Request, res: Response) => {
  const shop = await shopService.updateShop(req.params.id, req.body);
  res.json({ success: true, data: shop });
}));

router.delete('/shops/:id', asyncHandler(async (req: Request, res: Response) => {
  await shopService.deleteShop(req.params.id);
  res.json({ success: true, message: 'Shop deleted' });
}));

router.get('/shops/:id/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = await shopService.getShopStats(req.params.id);
  res.json({ success: true, data: stats });
}));

// ============================================
// PRODUCT ROUTES
// ============================================

router.post('/products', validateRequest(createProductSchema), asyncHandler(async (req: Request, res: Response) => {
  const { shopId, ...data } = req.body;
  const product = await shopService.createProduct(shopId, data);
  res.status(201).json({ success: true, data: product });
}));

router.get('/products', asyncHandler(async (req: Request, res: Response) => {
  const { shopId, category, isActive, search } = req.query;
  const products = await shopService.getProducts(shopId as string, {
    category: category as string,
    isActive: isActive === 'true',
    search: search as string,
  });
  res.json({ success: true, data: products });
}));

router.get('/products/:id', asyncHandler(async (req: Request, res: Response) => {
  const product = await shopService.getProduct(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, data: product });
}));

router.put('/products/:id', asyncHandler(async (req: Request, res: Response) => {
  const product = await shopService.updateProduct(req.params.id, req.body);
  res.json({ success: true, data: product });
}));

router.patch('/products/:id/stock', asyncHandler(async (req: Request, res: Response) => {
  const { quantity } = req.body;
  const product = await shopService.updateStock(req.params.id, quantity);
  res.json({ success: true, data: product });
}));

router.delete('/products/:id', asyncHandler(async (req: Request, res: Response) => {
  await shopService.deleteProduct(req.params.id);
  res.json({ success: true, message: 'Product deleted' });
}));

// ============================================
// ORDER ROUTES
// ============================================

router.post('/orders', validateRequest(createOrderSchema), asyncHandler(async (req: Request, res: Response) => {
  const { shopId, contactId, ...data } = req.body;
  const order = await shopService.createOrder(shopId, contactId, data);
  res.status(201).json({ success: true, data: order });
}));

router.get('/orders', asyncHandler(async (req: Request, res: Response) => {
  const { shopId, status, contactId, paymentStatus } = req.query;
  const orders = await shopService.getOrders(shopId as string, {
    status: status as string,
    contactId: contactId as string,
    paymentStatus: paymentStatus as string,
  });
  res.json({ success: true, data: orders });
}));

router.get('/orders/:id', asyncHandler(async (req: Request, res: Response) => {
  const order = await shopService.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  res.json({ success: true, data: order });
}));

router.patch('/orders/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const order = await shopService.updateOrderStatus(req.params.id, status);
  res.json({ success: true, data: order });
}));

router.patch('/orders/:id/payment-status', asyncHandler(async (req: Request, res: Response) => {
  const { paymentStatus } = req.body;
  const order = await shopService.updatePaymentStatus(req.params.id, paymentStatus);
  res.json({ success: true, data: order });
}));

// ============================================
// INVOICE ROUTES
// ============================================

router.post('/invoices', validateRequest(createInvoiceSchema), asyncHandler(async (req: Request, res: Response) => {
  const { shopId, contactId, ...data } = req.body;
  const invoice = await shopService.createInvoice(shopId, contactId, {
    ...data,
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
  });
  res.status(201).json({ success: true, data: invoice });
}));

router.get('/invoices', asyncHandler(async (req: Request, res: Response) => {
  const { shopId, status, contactId } = req.query;
  const invoices = await shopService.getInvoices(shopId as string, {
    status: status as string,
    contactId: contactId as string,
  });
  res.json({ success: true, data: invoices });
}));

router.get('/invoices/:id', asyncHandler(async (req: Request, res: Response) => {
  const invoice = await shopService.getInvoice(req.params.id);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }
  res.json({ success: true, data: invoice });
}));

router.patch('/invoices/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;
  const invoice = await shopService.updateInvoiceStatus(req.params.id, status);
  res.json({ success: true, data: invoice });
}));

router.post('/invoices/:id/send', asyncHandler(async (req: Request, res: Response) => {
  const invoice = await shopService.sendInvoice(req.params.id);
  res.json({ success: true, data: invoice });
}));

// ============================================
// PAYMENT ROUTES
// ============================================

router.post('/payments', validateRequest(recordPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const { shopId, ...data } = req.body;
  const payment = await shopService.recordPayment(shopId, {
    ...data,
    paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined,
  });
  res.status(201).json({ success: true, data: payment });
}));

router.get('/payments', asyncHandler(async (req: Request, res: Response) => {
  const { shopId, invoiceId, orderId, contactId } = req.query;
  const payments = await shopService.getPayments(shopId as string, {
    invoiceId: invoiceId as string,
    orderId: orderId as string,
    contactId: contactId as string,
  });
  res.json({ success: true, data: payments });
}));

export default router;
