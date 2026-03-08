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
import PDFDocument from 'pdfkit';
import logger from '@utils/logger';
import { whatsappWebService } from '@services/whatsapp-web.service';
import { MessageDirection, MessageStatus, MessageType } from '@prisma/client';

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

// PDF Download
router.get('/:id/pdf', async (req, res) => {
  try {
    const userId = req.user!.id;
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId },
      include: {
        items: true,
        contact: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
    doc.fontSize(10).font('Helvetica').text(`#${invoice.invoiceNumber}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}`, { align: 'right' });
    if (invoice.dueDate) {
      doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, { align: 'right' });
    }
    doc.text(`Status: ${invoice.status}`, { align: 'right' });

    // Bill To
    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Bill To:');
    doc.fontSize(10).font('Helvetica');
    doc.text(invoice.contact?.name || invoice.contact?.businessName || 'Unknown');
    if (invoice.contact?.phoneNumber) doc.text(invoice.contact.phoneNumber);
    if (invoice.contact?.email) doc.text(invoice.contact.email);
    if (invoice.contact?.company) doc.text(invoice.contact.company);

    // Items table
    doc.moveDown(1.5);
    const tableTop = doc.y;
    const colX = { desc: 50, qty: 320, price: 380, total: 460 };

    // Table header
    doc.fontSize(9).font('Helvetica-Bold');
    doc.rect(50, tableTop - 5, 500, 20).fill('#f3f4f6');
    doc.fillColor('#000');
    doc.text('Description', colX.desc, tableTop);
    doc.text('Qty', colX.qty, tableTop, { width: 50, align: 'right' });
    doc.text('Price', colX.price, tableTop, { width: 70, align: 'right' });
    doc.text('Total', colX.total, tableTop, { width: 80, align: 'right' });

    // Table rows
    doc.font('Helvetica').fontSize(9);
    let y = tableTop + 22;
    for (const item of invoice.items) {
      if (y > 700) { doc.addPage(); y = 50; }
      doc.text(item.description, colX.desc, y, { width: 260 });
      doc.text(String(item.quantity), colX.qty, y, { width: 50, align: 'right' });
      doc.text(item.unitPrice.toFixed(2), colX.price, y, { width: 70, align: 'right' });
      doc.text(item.totalAmount.toFixed(2), colX.total, y, { width: 80, align: 'right' });
      y += 18;
    }

    // Totals
    y += 10;
    doc.moveTo(380, y).lineTo(540, y).stroke();
    y += 8;
    doc.font('Helvetica').fontSize(10);
    doc.text('Subtotal:', 380, y); doc.text(invoice.subtotal.toFixed(2), 460, y, { width: 80, align: 'right' });
    y += 16;
    if (invoice.taxAmount > 0) {
      doc.text('Tax:', 380, y); doc.text(invoice.taxAmount.toFixed(2), 460, y, { width: 80, align: 'right' });
      y += 16;
    }
    if (invoice.discountAmount > 0) {
      doc.text('Discount:', 380, y); doc.text(`-${invoice.discountAmount.toFixed(2)}`, 460, y, { width: 80, align: 'right' });
      y += 16;
    }
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total:', 380, y); doc.text(invoice.totalAmount.toFixed(2), 460, y, { width: 80, align: 'right' });
    y += 20;
    if (invoice.paidAmount > 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#16a34a');
      doc.text('Paid:', 380, y); doc.text(invoice.paidAmount.toFixed(2), 460, y, { width: 80, align: 'right' });
      y += 16;
      doc.fillColor('#000');
      doc.font('Helvetica-Bold');
      doc.text('Balance:', 380, y); doc.text(invoice.balanceAmount.toFixed(2), 460, y, { width: 80, align: 'right' });
    }

    // Notes
    if (invoice.notes) {
      doc.moveDown(2);
      doc.font('Helvetica-Bold').fontSize(10).text('Notes:');
      doc.font('Helvetica').fontSize(9).text(invoice.notes);
    }
    if (invoice.terms) {
      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(10).text('Terms & Conditions:');
      doc.font('Helvetica').fontSize(9).text(invoice.terms);
    }

    doc.end();
  } catch (error) {
    logger.error({ error, invoiceId: req.params.id }, 'PDF generation failed');
    res.status(500).json({ success: false, error: 'PDF generation failed' });
  }
});

// Send Invoice via WhatsApp (PDF + caption)
router.post('/:id/send', async (req, res) => {
  try {
    const userId = req.user!.id;
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, userId },
      include: {
        items: true,
        contact: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    if (!invoice.contact?.chatId && !invoice.contact?.phoneNumber) {
      return res.status(400).json({ success: false, error: 'Contact has no phone number or chat ID' });
    }

    // Get active WhatsApp session
    const sessions = whatsappWebService.getUserSessions(userId);
    const activeSession = sessions.find((s) => s.status === 'READY' || s.status === 'AUTHENTICATED');
    if (!activeSession) {
      return res.status(400).json({ success: false, error: 'WhatsApp is not connected. Please scan QR code.' });
    }

    // Build formatted caption
    const itemLines = invoice.items.map(
      (item) => `  • ${item.description} — ${item.quantity} × $${item.unitPrice.toFixed(2)} = $${item.totalAmount.toFixed(2)}`
    ).join('\n');

    const caption = [
      `📄 *Invoice #${invoice.invoiceNumber}*`,
      '',
      `*Amount:* $${invoice.totalAmount.toFixed(2)}`,
      invoice.dueDate ? `*Due Date:* ${new Date(invoice.dueDate).toLocaleDateString()}` : null,
      invoice.paidAmount > 0 ? `*Paid:* $${invoice.paidAmount.toFixed(2)}` : null,
      invoice.balanceAmount > 0 && invoice.paidAmount > 0 ? `*Balance:* $${invoice.balanceAmount.toFixed(2)}` : null,
      '',
      '*Items:*',
      itemLines,
      '',
      invoice.notes ? `_${invoice.notes}_` : null,
      '',
      'Thank you for your business! 🙏',
    ].filter(Boolean).join('\n');

    // Generate PDF to buffer
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Same PDF layout as the download endpoint
      doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
      doc.fontSize(10).font('Helvetica').text(`#${invoice.invoiceNumber}`, { align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}`, { align: 'right' });
      if (invoice.dueDate) {
        doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, { align: 'right' });
      }
      doc.text(`Status: ${invoice.status}`, { align: 'right' });

      doc.moveDown(1.5);
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:');
      doc.fontSize(10).font('Helvetica');
      doc.text(invoice.contact?.name || invoice.contact?.businessName || 'Unknown');
      if (invoice.contact?.phoneNumber) doc.text(invoice.contact.phoneNumber);
      if (invoice.contact?.email) doc.text(invoice.contact.email);
      if (invoice.contact?.company) doc.text(invoice.contact.company);

      doc.moveDown(1.5);
      const tableTop = doc.y;
      const colX = { desc: 50, qty: 320, price: 380, total: 460 };

      doc.fontSize(9).font('Helvetica-Bold');
      doc.rect(50, tableTop - 5, 500, 20).fill('#f3f4f6');
      doc.fillColor('#000');
      doc.text('Description', colX.desc, tableTop);
      doc.text('Qty', colX.qty, tableTop, { width: 50, align: 'right' });
      doc.text('Price', colX.price, tableTop, { width: 70, align: 'right' });
      doc.text('Total', colX.total, tableTop, { width: 80, align: 'right' });

      doc.font('Helvetica').fontSize(9);
      let y = tableTop + 22;
      for (const item of invoice.items) {
        if (y > 700) { doc.addPage(); y = 50; }
        doc.text(item.description, colX.desc, y, { width: 260 });
        doc.text(String(item.quantity), colX.qty, y, { width: 50, align: 'right' });
        doc.text(item.unitPrice.toFixed(2), colX.price, y, { width: 70, align: 'right' });
        doc.text(item.totalAmount.toFixed(2), colX.total, y, { width: 80, align: 'right' });
        y += 18;
      }

      y += 10;
      doc.moveTo(380, y).lineTo(540, y).stroke();
      y += 8;
      doc.font('Helvetica').fontSize(10);
      doc.text('Subtotal:', 380, y); doc.text(invoice.subtotal.toFixed(2), 460, y, { width: 80, align: 'right' });
      y += 16;
      if (invoice.taxAmount > 0) {
        doc.text('Tax:', 380, y); doc.text(invoice.taxAmount.toFixed(2), 460, y, { width: 80, align: 'right' });
        y += 16;
      }
      if (invoice.discountAmount > 0) {
        doc.text('Discount:', 380, y); doc.text(`-${invoice.discountAmount.toFixed(2)}`, 460, y, { width: 80, align: 'right' });
        y += 16;
      }
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Total:', 380, y); doc.text(invoice.totalAmount.toFixed(2), 460, y, { width: 80, align: 'right' });
      y += 20;
      if (invoice.paidAmount > 0) {
        doc.font('Helvetica').fontSize(10).fillColor('#16a34a');
        doc.text('Paid:', 380, y); doc.text(invoice.paidAmount.toFixed(2), 460, y, { width: 80, align: 'right' });
        y += 16;
        doc.fillColor('#000');
        doc.font('Helvetica-Bold');
        doc.text('Balance:', 380, y); doc.text(invoice.balanceAmount.toFixed(2), 460, y, { width: 80, align: 'right' });
      }

      if (invoice.notes) {
        doc.moveDown(2);
        doc.font('Helvetica-Bold').fontSize(10).text('Notes:');
        doc.font('Helvetica').fontSize(9).text(invoice.notes);
      }
      if (invoice.terms) {
        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(10).text('Terms & Conditions:');
        doc.font('Helvetica').fontSize(9).text(invoice.terms);
      }

      doc.end();
    });

    // Send via WhatsApp
    const chatId = invoice.contact!.chatId || `${invoice.contact!.phoneNumber}@c.us`;
    const { MessageMedia } = await import('whatsapp-web.js');
    const media = new MessageMedia(
      'application/pdf',
      pdfBuffer.toString('base64'),
      `${invoice.invoiceNumber}.pdf`,
    );

    const waMessage = await activeSession.client.sendMessage(chatId, media, { caption });

    // Save message in conversation history
    const conversation = await prisma.conversation.findFirst({
      where: { userId, contactId: invoice.contactId },
    }) || await prisma.conversation.create({
      data: { userId, contactId: invoice.contactId },
    });

    await prisma.message.create({
      data: {
        userId,
        contactId: invoice.contactId,
        conversationId: conversation.id,
        waMessageId: waMessage?.id?.id || waMessage?.id?._serialized || null,
        content: caption,
        messageType: MessageType.DOCUMENT,
        direction: MessageDirection.OUTGOING,
        status: MessageStatus.SENT,
        mediaType: 'application/pdf',
        mediaFileName: `${invoice.invoiceNumber}.pdf`,
      },
    });

    // Update invoice status to SENT if currently DRAFT
    if (invoice.status === 'DRAFT') {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'SENT' },
      });
    }

    logger.info({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, chatId }, 'Invoice sent via WhatsApp');

    res.status(200).json({
      success: true,
      message: `Invoice ${invoice.invoiceNumber} sent to ${invoice.contact?.name || invoice.contact?.phoneNumber}`,
    });
  } catch (error: any) {
    logger.error({ error, invoiceId: req.params.id }, 'Failed to send invoice via WhatsApp');
    res.status(500).json({ success: false, error: error.message || 'Failed to send invoice' });
  }
});

export default router;
