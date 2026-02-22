// src/controllers/appointment.controller.ts
// Appointment HTTP handlers

import { Request, Response } from 'express';
import { AppointmentService } from '@services/appointment.service';
import { asyncHandler } from '@middleware/error.middleware';

export class AppointmentController {
  constructor(private service: AppointmentService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const appointment = await this.service.createAppointment(userId, req.body);
    res.status(201).json({ success: true, data: appointment });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { status, contactId, startDate, endDate, page, limit } = req.query;
    const result = await this.service.getAppointments(userId, {
      status: status as string, contactId: contactId as string,
      startDate: startDate as string, endDate: endDate as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const appointment = await this.service.getAppointment(req.params.id);
    res.status(200).json({ success: true, data: appointment });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const appointment = await this.service.updateAppointment(req.params.id, req.body);
    res.status(200).json({ success: true, data: appointment });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.deleteAppointment(req.params.id);
    res.status(200).json({ success: true, message: 'Appointment deleted' });
  });
}
