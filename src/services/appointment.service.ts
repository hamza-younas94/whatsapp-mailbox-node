// src/services/appointment.service.ts
// Appointment business logic

import { Appointment, AppointmentStatus } from '@prisma/client';
import { AppointmentRepository } from '@repositories/appointment.repository';
import { NotFoundError } from '@utils/errors';
import logger from '@utils/logger';

export interface CreateAppointmentInput {
  contactId: string;
  title: string;
  description?: string;
  appointmentDate: string;
  duration?: number;
  location?: string;
  notes?: string;
}

export class AppointmentService {
  constructor(private repository: AppointmentRepository) {}

  async createAppointment(userId: string, input: CreateAppointmentInput): Promise<Appointment> {
    const appointment = await this.repository.create({
      userId,
      contactId: input.contactId,
      title: input.title,
      description: input.description,
      appointmentDate: new Date(input.appointmentDate),
      duration: input.duration || 30,
      location: input.location,
      notes: input.notes,
    });
    logger.info({ id: appointment.id }, 'Appointment created');
    return appointment;
  }

  async getAppointments(
    userId: string,
    options: { status?: string; contactId?: string; startDate?: string; endDate?: string; page?: number; limit?: number } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.findByUserId(userId, {
      status: options.status as AppointmentStatus,
      contactId: options.contactId,
      startDate: options.startDate ? new Date(options.startDate) : undefined,
      endDate: options.endDate ? new Date(options.endDate) : undefined,
      skip,
      take: limit,
    });

    return { items, pagination: { total, page, perPage: limit, totalPages: Math.ceil(total / limit) } };
  }

  async getAppointment(id: string) {
    const appointment = await this.repository.findByIdWithContact(id);
    if (!appointment) throw new NotFoundError('Appointment');
    return appointment;
  }

  async updateAppointment(id: string, data: Partial<{
    title: string; description: string; appointmentDate: string; duration: number;
    status: AppointmentStatus; location: string; notes: string;
  }>): Promise<Appointment> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Appointment');

    const updateData: any = { ...data };
    if (data.appointmentDate) updateData.appointmentDate = new Date(data.appointmentDate);

    const appointment = await this.repository.update(id, updateData);
    logger.info({ id }, 'Appointment updated');
    return appointment;
  }

  async deleteAppointment(id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Appointment');
    await this.repository.delete(id);
    logger.info({ id }, 'Appointment deleted');
  }
}
