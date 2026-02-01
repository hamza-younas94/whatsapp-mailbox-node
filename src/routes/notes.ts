// src/routes/notes.ts
// Notes API routes

import { Router, Request, Response, NextFunction } from 'express';
import { NoteController } from '@controllers/note.controller';
import { NoteService } from '@services/note.service';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

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
router.post('/', validateRequest(createNoteSchema), controller.create);

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
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;
