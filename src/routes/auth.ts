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

const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
});

// Rate limiters for auth endpoints
const loginLimiter = createRateLimiter(15 * 60 * 1000, 5);   // 5 attempts per 15 min
const registerLimiter = createRateLimiter(60 * 60 * 1000, 3); // 3 per hour
const forgotPasswordLimiter = createRateLimiter(60 * 60 * 1000, 3); // 3 per hour

// Routes
router.post('/register', registerLimiter, validateRequest(registerSchema), controller.register);
router.post('/login', loginLimiter, validateRequest(loginSchema), controller.login);
router.post('/refresh', validateRequest(refreshSchema), controller.refresh);
router.get('/me', authenticate, controller.me);

// Password reset routes
router.post('/forgot-password', forgotPasswordLimiter, validateRequest(forgotPasswordSchema), async (req, res, next) => {
    try {
        const result = await service.requestPasswordReset(req.body.email);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

router.get('/validate-reset-token', async (req, res, next) => {
    try {
        const token = req.query.token as string;
        if (!token) {
            return res.status(400).json({ success: false, error: 'Token is required' });
        }
        const valid = await service.validateResetToken(token);
        res.json({ success: true, data: { valid } });
    } catch (error) {
        next(error);
    }
});

router.post('/reset-password', validateRequest(resetPasswordSchema), async (req, res, next) => {
    try {
        await service.resetPassword(req.body.token, req.body.password);
        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        next(error);
    }
});

// Update profile
router.put('/me', authenticate, async (req, res, next) => {
    try {
        const userId = (req as any).userId;
        const { name, email, currentPassword, newPassword } = req.body;
        const updateData: any = {};

        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;

        if (currentPassword && newPassword) {
            const bcrypt = await import('bcryptjs');
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });
            const valid = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!valid) return res.status(400).json({ success: false, error: 'Current password is incorrect' });
            if (newPassword.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
            updateData.passwordHash = await bcrypt.hash(newPassword, 12);
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        const updated = await prisma.user.update({ where: { id: userId }, data: updateData, select: { id: true, name: true, email: true, username: true, role: true } });
        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

// List users (ADMIN/MANAGER only)
router.get('/users', authenticate, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: (req as any).userId } });
        if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, email: true, username: true, role: true },
            orderBy: { name: 'asc' },
        });
        res.json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
});

export default router;
