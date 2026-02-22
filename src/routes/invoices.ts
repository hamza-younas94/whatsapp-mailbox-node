// src/routes/invoices.ts
// Invoices & Payments API routes

import { Router } from 'express';
import { InvoiceController } from '@controllers/invoice.controller';
import { InvoiceService } from '@services/invoice.service';
import { InvoiceRepository } from '@repositories/invoice.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Initialize dependencies
const prisma = getPrismaClient();
const repository = new InvoiceRepository(prisma);
const service = new InvoiceService(repository);
const controller = new InvoiceController(service);

// Validation schemas
const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().min(0.01),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
});

const createInvoiceSchema = z.object({
  contactId: z.string().min(1),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
});

const updateInvoiceSchema = createInvoiceSchema.partial();

const paymentSchema = z.object({
  amount: z.number().min(0.01),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'EASYPAISA', 'JAZZCASH']).optional(),
  paymentDate: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

// Apply authentication
router.use(authenticate);

// Routes
router.post('/', validateRequest(createInvoiceSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id', validateRequest(updateInvoiceSchema), controller.update);
router.delete('/:id', controller.delete);
router.post('/:id/payments', validateRequest(paymentSchema), controller.recordPayment);
router.get('/:id/payments', controller.getPayments);

export default router;
