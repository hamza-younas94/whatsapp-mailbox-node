// src/routes/auth.ts
// Authentication API routes

import { Router } from 'express';
import { AuthController } from '@controllers/auth.controller';
import { AuthService } from '@services/auth.service';
import getPrismaClient from '@config/database';
import { authenticate, requireRole } from '@middleware/auth.middleware';
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

// ── Team User Management (OWNER/ADMIN only) ──

const createUserSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(50),
    password: z.string().min(8),
    name: z.string().optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'AGENT']),
});

const updateUserSchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'AGENT']).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional(),
});

// List users in org
router.get('/users', authenticate, async (req, res, next) => {
    try {
        const orgId = req.user!.orgId;
        const users = await prisma.user.findMany({
            where: { orgId },
            select: { id: true, name: true, email: true, username: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });
        res.json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
});

// Create user in org (OWNER/ADMIN only)
router.post('/users', authenticate, requireRole('OWNER', 'ADMIN'), validateRequest(createUserSchema), async (req, res, next) => {
    try {
        const orgId = req.user!.orgId;
        const { email, username, password, name, role } = req.body;

        // Check if email or username already exists
        const existing = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] },
        });
        if (existing) {
            return res.status(409).json({ success: false, error: 'A user with this email or username already exists' });
        }

        // Cannot create OWNER
        if (role === 'OWNER') {
            return res.status(400).json({ success: false, error: 'Cannot create another owner' });
        }

        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { email, username, passwordHash, name, role, orgId, isActive: true },
            select: { id: true, name: true, email: true, username: true, role: true, isActive: true, createdAt: true },
        });

        res.status(201).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
});

// Update user in org (OWNER/ADMIN only)
router.put('/users/:id', authenticate, requireRole('OWNER', 'ADMIN'), validateRequest(updateUserSchema), async (req, res, next) => {
    try {
        const orgId = req.user!.orgId;
        const targetId = req.params.id;

        // Ensure target user belongs to same org
        const target = await prisma.user.findFirst({ where: { id: targetId, orgId } });
        if (!target) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Cannot demote the org owner
        if (target.role === 'OWNER' && req.body.role && req.body.role !== 'OWNER') {
            return res.status(400).json({ success: false, error: 'Cannot change the owner role' });
        }

        // Cannot set someone as OWNER
        if (req.body.role === 'OWNER') {
            return res.status(400).json({ success: false, error: 'Cannot assign owner role' });
        }

        const updateData: any = {};
        if (req.body.name !== undefined) updateData.name = req.body.name;
        if (req.body.email !== undefined) updateData.email = req.body.email;
        if (req.body.role !== undefined) updateData.role = req.body.role;
        if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
        if (req.body.password) {
            const bcrypt = await import('bcryptjs');
            updateData.passwordHash = await bcrypt.hash(req.body.password, 10);
        }

        const updated = await prisma.user.update({
            where: { id: targetId },
            data: updateData,
            select: { id: true, name: true, email: true, username: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

// Delete user from org (OWNER only, cannot delete self)
router.delete('/users/:id', authenticate, requireRole('OWNER'), async (req, res, next) => {
    try {
        const orgId = req.user!.orgId;
        const targetId = req.params.id;

        if (targetId === req.user!.id || targetId === req.user!.userId) {
            return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
        }

        const target = await prisma.user.findFirst({ where: { id: targetId, orgId } });
        if (!target) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (target.role === 'OWNER') {
            return res.status(400).json({ success: false, error: 'Cannot delete the owner' });
        }

        // Soft delete — deactivate instead of hard delete
        await prisma.user.update({ where: { id: targetId }, data: { isActive: false } });
        res.json({ success: true, message: 'User deactivated' });
    } catch (error) {
        next(error);
    }
});

export default router;
