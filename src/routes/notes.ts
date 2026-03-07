// src/routes/notes.ts
// Notes API routes

import { Router, Request, Response, NextFunction } from 'express';
import { NoteController } from '@controllers/note.controller';
import { NoteService } from '@services/note.service';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';
import { emitToUser } from '@utils/socket-emitter';

const router = Router();


// Initialize dependencies
  const prisma = getPrismaClient();
const service = new NoteService(prisma);
const controller = new NoteController(service);

// Validation schemas - accept both CUID and UUID formats
const createNoteSchema = z.object({
  contactId: z.string().min(1),
  content: z.string().min(1),
});

// Apply authentication to all routes
router.use(authenticate);

// Routes
router.post('/', validateRequest(createNoteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const note = await prisma.note.create({ data: { userId, contactId: req.body.contactId, content: req.body.content } });
    emitToUser(userId, 'note:created', { contactId: req.body.contactId, data: note });
    res.status(201).json({ success: true, data: note });
  } catch (error) { next(error); }
});

// Get notes - support both query param and path param
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { contactId } = req.query;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!contactId) {
      return res.status(400).json({ success: false, error: 'contactId is required' });
    }

    const notes = await prisma.note.findMany({
      where: { 
        contactId: contactId as string,
        contact: { userId } // Ensure user owns the contact
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: notes });
  } catch (error) {
    next(error);
  }
});

router.get('/contact/:contactId', controller.list);

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const note = await prisma.note.updateMany({ where: { id: req.params.id, userId }, data: { content: req.body.content } });
    if (note.count === 0) return res.status(404).json({ success: false, error: 'Note not found' });
    const updated = await prisma.note.findUnique({ where: { id: req.params.id } });
    emitToUser(userId, 'note:updated', { contactId: updated?.contactId, data: updated });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const note = await prisma.note.findFirst({ where: { id: req.params.id, userId } });
    if (!note) return res.status(404).json({ success: false, error: 'Note not found' });
    await prisma.note.delete({ where: { id: req.params.id } });
    emitToUser(userId, 'note:deleted', { contactId: note.contactId, id: req.params.id });
    res.json({ success: true, message: 'Note deleted' });
  } catch (error) { next(error); }
});

export default router;
