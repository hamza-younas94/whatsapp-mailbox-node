// src/controllers/customer-subscription.controller.ts
// Customer Subscription HTTP handlers

import { Request, Response } from 'express';
import { CustomerSubscriptionService } from '@services/customer-subscription.service';
import { asyncHandler } from '@middleware/error.middleware';

export class CustomerSubscriptionController {
  constructor(private service: CustomerSubscriptionService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const subscription = await this.service.createSubscription(userId, req.body);
    res.status(201).json({ success: true, data: subscription });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { status, contactId, billingCycle, page, limit } = req.query;
    const result = await this.service.getSubscriptions(userId, {
      status: status as string, contactId: contactId as string,
      billingCycle: billingCycle as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const subscription = await this.service.getSubscription(req.params.id);
    res.status(200).json({ success: true, data: subscription });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const subscription = await this.service.updateSubscription(req.params.id, req.body);
    res.status(200).json({ success: true, data: subscription });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.deleteSubscription(req.params.id);
    res.status(200).json({ success: true, message: 'Subscription deleted' });
  });
}
