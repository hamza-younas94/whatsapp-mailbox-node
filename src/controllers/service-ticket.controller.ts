// src/controllers/service-ticket.controller.ts
// Service Ticket HTTP handlers

import { Request, Response } from 'express';
import { ServiceTicketService } from '@services/service-ticket.service';
import { asyncHandler } from '@middleware/error.middleware';

export class ServiceTicketController {
  constructor(private service: ServiceTicketService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const ticket = await this.service.createTicket(userId, req.body);
    res.status(201).json({ success: true, data: ticket });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { status, priority, category, contactId, search, page, limit } = req.query;

    const result = await this.service.getTickets(userId, {
      status: status as string,
      priority: priority as string,
      category: category as string,
      contactId: contactId as string,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const ticket = await this.service.getTicket(req.params.id);
    res.status(200).json({ success: true, data: ticket });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const ticket = await this.service.updateTicket(req.params.id, userId, req.body);
    res.status(200).json({ success: true, data: ticket });
  });

  addUpdate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const update = await this.service.addUpdate(req.params.id, userId, req.body);
    res.status(201).json({ success: true, data: update });
  });

  addPart = asyncHandler(async (req: Request, res: Response) => {
    const part = await this.service.addPart(req.params.id, req.body);
    res.status(201).json({ success: true, data: part });
  });

  updatePart = asyncHandler(async (req: Request, res: Response) => {
    const part = await this.service.updatePart(req.params.id, req.params.partId, req.body);
    res.status(200).json({ success: true, data: part });
  });
}
