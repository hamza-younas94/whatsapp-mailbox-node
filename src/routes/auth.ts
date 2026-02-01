// src/routes/auth.ts
// Authentication API routes

import { Router } from 'express';
import { AuthController } from '@controllers/auth.controller';
import { AuthService } from '@services/auth.service';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Initialize dependencies
const prisma = getPrismaClient();
const service = new AuthService(prisma);
const controller = new AuthController(service);

// Validation schemas
const registerSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(50),
    password: z.string().min(8),
    name: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

const refreshSchema = z.object({
    refreshToken: z.string(),
});

// Routes
router.post('/register', validateRequest(registerSchema), controller.register);
router.post('/login', validateRequest(loginSchema), controller.login);
router.post('/refresh', validateRequest(refreshSchema), controller.refresh);
router.get('/me', authenticate, controller.me);

export default router;
