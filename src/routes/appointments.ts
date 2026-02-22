// src/routes/appointments.ts
// Appointments API routes

import { Router } from 'express';
import { AppointmentController } from '@controllers/appointment.controller';
import { AppointmentService } from '@services/appointment.service';
import { AppointmentRepository } from '@repositories/appointment.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

const prisma = getPrismaClient();
const repository = new AppointmentRepository(prisma);
const service = new AppointmentService(repository);
const controller = new AppointmentController(service);

const createSchema = z.object({
  contactId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  appointmentDate: z.string().min(1),
  duration: z.number().int().min(1).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  appointmentDate: z.string().optional(),
  duration: z.number().int().min(1).optional(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'APPOINTMENT_COMPLETED', 'APPOINTMENT_CANCELLED', 'NO_SHOW']).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

router.use(authenticate);

router.post('/', validateRequest(createSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id', validateRequest(updateSchema), controller.update);
router.delete('/:id', controller.delete);

export default router;
