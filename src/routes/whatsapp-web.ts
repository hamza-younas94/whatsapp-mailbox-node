// src/routes/whatsapp-web.ts
// WhatsApp Web QR code routes

import { Router } from 'express';
import { WhatsAppWebController } from '@controllers/whatsapp-web.controller';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();
const controller = new WhatsAppWebController();

// Validation schemas
const sendMessageSchema = z.object({
  to: z.string().min(10),
  message: z.string().min(1),
  mediaUrl: z.string().url().optional(),
});

// Apply authentication to all routes
router.use(authenticate);

// Simplified endpoints for primary session (used by frontend)
router.get('/status', controller.getDefaultStatus);
router.post('/initialize', controller.initializeDefaultSession);
router.post('/disconnect', controller.disconnectDefaultSession);

// Session management
router.post('/init', controller.initSession);
router.get('/sessions', controller.listSessions);
router.get('/sessions/:sessionId/status', controller.getStatus);
router.get('/sessions/:sessionId/qr', controller.getQRCode);
router.get('/sessions/:sessionId/qr/stream', controller.streamQR);
router.post('/sessions/:sessionId/restart', controller.restart);
router.delete('/sessions/:sessionId', controller.logout);

// Messaging
router.post('/sessions/:sessionId/send', validateRequest(sendMessageSchema), controller.sendMessage);

export default router;
