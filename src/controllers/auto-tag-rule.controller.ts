// src/controllers/auto-tag-rule.controller.ts
// Auto-Tag Rule HTTP handlers

import { Request, Response } from 'express';
import { AutoTagRuleService } from '@services/auto-tag-rule.service';
import { asyncHandler } from '@middleware/error.middleware';

export class AutoTagRuleController {
  constructor(private service: AutoTagRuleService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const rule = await this.service.createRule(userId, req.body);
    res.status(201).json({ success: true, data: rule });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const rules = await this.service.getRules(userId);
    res.status(200).json({ success: true, data: rules });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const rule = await this.service.updateRule(req.params.id, req.body);
    res.status(200).json({ success: true, data: rule });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.deleteRule(req.params.id);
    res.status(200).json({ success: true, message: 'Auto-tag rule deleted' });
  });

  execute = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const result = await this.service.executeRule(req.params.id, userId);
    res.status(200).json({ success: true, data: result });
  });
}
