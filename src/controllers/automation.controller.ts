// src/controllers/automation.controller.ts
// Automation HTTP handlers

import { Request, Response } from 'express';
import { AutomationService } from '@services/automation.service';
import { asyncHandler } from '@middleware/error.middleware';

export class AutomationController {
  constructor(private service: AutomationService) {}

  // Normalize input to handle both simple and complex formats
  private normalizeInput(body: any) {
    const { name, trigger, triggerType, action, actions, conditions, delay, isActive, message } = body;
    
    // Map frontend trigger values to backend format
    const triggerMap: Record<string, string> = {
      'message_received': 'MESSAGE_RECEIVED',
      'contact_added': 'CONTACT_ADDED',
      'tag_added': 'TAG_ADDED',
      'keyword': 'KEYWORD',
    };

    // Map frontend action values to backend format
    const actionMap: Record<string, string> = {
      'send_message': 'SEND_MESSAGE',
      'add_tag': 'ADD_TAG',
      'send_email': 'SEND_EMAIL',
      'assign_agent': 'ASSIGN_AGENT',
    };

    // Normalize trigger
    const normalizedTrigger = triggerType || triggerMap[trigger?.toLowerCase()] || trigger?.toUpperCase() || 'MESSAGE_RECEIVED';

    // Normalize actions - convert simple format to array format
    let normalizedActions: any[] = [];
    
    if (Array.isArray(actions)) {
      normalizedActions = actions;
    } else if (action) {
      // Simple format: single action with optional message/tagId
      const actionType = actionMap[action?.toLowerCase()] || action?.toUpperCase() || 'SEND_MESSAGE';
      const actionParams: any = {};
      
      if (actions?.message || message) {
        actionParams.message = actions?.message || message;
      }
      if (actions?.tagId) {
        actionParams.tagId = actions.tagId;
      }
      
      normalizedActions = [{
        type: actionType,
        value: actions?.message || message || '',
        delay: delay || 0,
        params: actionParams,
      }];
    }

    return {
      name,
      trigger: normalizedTrigger,
      actions: normalizedActions,
      conditions: conditions || {},
      isActive: isActive !== undefined ? isActive : true,
    };
  }

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const normalizedInput = this.normalizeInput(req.body);
    const automation = await this.service.createAutomation(userId, normalizedInput);

    res.status(201).json({
      success: true,
      data: automation,
    });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const automations = await this.service.getAutomations(userId);

    res.status(200).json({
      success: true,
      data: automations,
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const automation = await this.service.updateAutomation(id, req.body);

    res.status(200).json({
      success: true,
      data: automation,
    });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.service.deleteAutomation(id);

    res.status(200).json({
      success: true,
      message: 'Automation deleted',
    });
  });

  toggle = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;

    const automation = await this.service.toggleAutomation(id, isActive);

    res.status(200).json({
      success: true,
      data: automation,
    });
  });
}
