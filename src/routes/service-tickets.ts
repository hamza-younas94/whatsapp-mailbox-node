// src/routes/service-tickets.ts
// Service Tickets API routes

import { Router } from 'express';
import { ServiceTicketController } from '@controllers/service-ticket.controller';
import { ServiceTicketService } from '@services/service-ticket.service';
import { ServiceTicketRepository } from '@repositories/service-ticket.repository';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Initialize dependencies
const prisma = getPrismaClient();
const repository = new ServiceTicketRepository(prisma);
const service = new ServiceTicketService(repository);
const controller = new ServiceTicketController(service);

// Validation schemas
const createTicketSchema = z.object({
  contactId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  deviceType: z.string().optional(),
  deviceModel: z.string().optional(),
  serialNumber: z.string().optional(),
  problemDescription: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
  estimatedCompletionDate: z.string().optional(),
  assignedTo: z.string().optional(),
});

const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_PARTS', 'TESTING', 'TICKET_COMPLETED', 'TICKET_CANCELLED', 'ON_HOLD']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().optional(),
  diagnosisNotes: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
  actualCost: z.number().min(0).optional(),
  estimatedCompletionDate: z.string().optional(),
  actualCompletionDate: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
});

const ticketUpdateSchema = z.object({
  updateType: z.enum(['NOTE', 'STATUS_CHANGE', 'PARTS_ADDED', 'DIAGNOSIS', 'CUSTOMER_CONTACT']).optional(),
  content: z.string().optional(),
});

const addPartSchema = z.object({
  productId: z.string().optional(),
  partName: z.string().min(1),
  quantity: z.number().int().min(1),
  cost: z.number().min(0),
  price: z.number().min(0),
});

const updatePartSchema = z.object({
  status: z.enum(['REQUIRED', 'ORDERED', 'RECEIVED', 'INSTALLED']).optional(),
  quantity: z.number().int().min(1).optional(),
  cost: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
});

// Apply authentication
router.use(authenticate);

// Routes
router.post('/', validateRequest(createTicketSchema), controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id', validateRequest(updateTicketSchema), controller.update);
router.post('/:id/updates', validateRequest(ticketUpdateSchema), controller.addUpdate);
router.post('/:id/parts', validateRequest(addPartSchema), controller.addPart);
router.put('/:id/parts/:partId', validateRequest(updatePartSchema), controller.updatePart);

export default router;
