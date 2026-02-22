// src/repositories/appointment.repository.ts
// Appointment data access

import { PrismaClient, Appointment, AppointmentStatus } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class AppointmentRepository extends BaseRepository<Appointment> {
  protected modelName = 'appointment' as const;

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async findByUserId(
    userId: string,
    options: {
      status?: AppointmentStatus;
      contactId?: string;
      startDate?: Date;
      endDate?: Date;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<{ items: Appointment[]; total: number }> {
    const where: any = { userId };

    if (options.status) where.status = options.status;
    if (options.contactId) where.contactId = options.contactId;
    if (options.startDate || options.endDate) {
      where.appointmentDate = {};
      if (options.startDate) where.appointmentDate.gte = options.startDate;
      if (options.endDate) where.appointmentDate.lte = options.endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          contact: { select: { id: true, name: true, phoneNumber: true } },
        },
        skip: options.skip || 0,
        take: Math.min(options.take || 20, 100),
        orderBy: { appointmentDate: 'asc' },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items, total };
  }

  async findByIdWithContact(id: string) {
    return this.prisma.appointment.findUnique({
      where: { id },
      include: {
        contact: { select: { id: true, name: true, phoneNumber: true, email: true } },
      },
    });
  }
}
