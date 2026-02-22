// src/controllers/order.controller.ts
// Order HTTP handlers

import { Request, Response } from 'express';
import { OrderService } from '@services/order.service';
import { asyncHandler } from '@middleware/error.middleware';

export class OrderController {
  constructor(private service: OrderService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const order = await this.service.createOrder(userId, req.body);
    res.status(201).json({ success: true, data: order });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { status, orderType, contactId, startDate, endDate, page, limit } = req.query;

    const result = await this.service.getOrders(userId, {
      status: status as string,
      orderType: orderType as string,
      contactId: contactId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.service.getOrder(req.params.id);
    res.status(200).json({ success: true, data: order });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const order = await this.service.updateOrder(req.params.id, req.body);
    res.status(200).json({ success: true, data: order });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.deleteOrder(req.params.id);
    res.status(200).json({ success: true, message: 'Order deleted' });
  });
}
