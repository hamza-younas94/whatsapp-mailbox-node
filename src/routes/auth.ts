// src/routes/auth.ts
// Authentication API routes

import { Router } from 'express';
import { AuthController } from '@controllers/auth.controller';
import { AuthService } from '@services/auth.service';
import getPrismaClient from '@config/database';
import { authenticate } from '@middleware/auth.middleware';
import { validateRequest } from '@middleware/validation.middleware';
import { createRateLimiter } from '@middleware/rate-limit.middleware';
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

// Rate limiters for auth endpoints
const loginLimiter = createRateLimiter(15 * 60 * 1000, 5);   // 5 attempts per 15 min
const registerLimiter = createRateLimiter(60 * 60 * 1000, 3); // 3 per hour

// Routes
router.post('/register', registerLimiter, validateRequest(registerSchema), controller.register);
router.post('/login', loginLimiter, validateRequest(loginSchema), controller.login);
router.post('/refresh', validateRequest(refreshSchema), controller.refresh);
router.get('/me', authenticate, controller.me);

export default router;
