// src/controllers/invoice.controller.ts
// Invoice HTTP handlers

import { Request, Response } from 'express';
import { InvoiceService } from '@services/invoice.service';
import { asyncHandler } from '@middleware/error.middleware';
import { requireOrgId } from '@utils/auth-helpers';

export class InvoiceController {
  constructor(private service: InvoiceService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const orgId = requireOrgId(req);
    const invoice = await this.service.createInvoice(orgId, userId, req.body);
    res.status(201).json({ success: true, data: invoice });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const { status, contactId, startDate, endDate, search, page, limit } = req.query;

    const result = await this.service.getInvoices(orgId, {
      status: status as string,
      contactId: contactId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const invoice = await this.service.getInvoice(req.params.id);
    res.status(200).json({ success: true, data: invoice });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const invoice = await this.service.updateInvoice(req.params.id, req.body);
    res.status(200).json({ success: true, data: invoice });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.deleteInvoice(req.params.id);
    res.status(200).json({ success: true, message: 'Invoice deleted' });
  });

  recordPayment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const orgId = requireOrgId(req);
    const payment = await this.service.recordPayment(req.params.id, userId, req.body);
    res.status(201).json({ success: true, data: payment });
  });

  getPayments = asyncHandler(async (req: Request, res: Response) => {
    const payments = await this.service.getPayments(req.params.id);
    res.status(200).json({ success: true, data: payments });
  });
}
