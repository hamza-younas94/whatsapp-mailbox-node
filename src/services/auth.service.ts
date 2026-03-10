// src/services/auth.service.ts
// Authentication service

import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getEnv } from '@config/env';
import { UnauthorizedError, ValidationError, NotFoundError } from '@utils/errors';
import logger from '@utils/logger';

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  name?: string;
  orgName?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  token: string;
  refreshToken: string;
}

export interface IAuthService {
  register(data: RegisterData): Promise<AuthResponse>;
  login(data: LoginData): Promise<AuthResponse>;
  refreshToken(refreshToken: string): Promise<{ token: string }>;
  verifyToken(token: string): Promise<User>;
}

export class AuthService implements IAuthService {
  constructor(private prisma: PrismaClient) {}

  async register(data: RegisterData): Promise<AuthResponse> {
    const env = getEnv();

    // Check if user exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existingUser) {
      throw new ValidationError('User with this email or username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create organization + user in a transaction
    const orgName = data.orgName || data.name || data.username;
    const slug = data.username.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const { org, user } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          ownerId: 'pending', // Will update after user creation
        },
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          username: data.username,
          passwordHash,
          name: data.name,
          orgId: org.id,
          role: 'OWNER',
          isActive: true,
        },
      });

      // Update org with actual owner ID
      await tx.organization.update({
        where: { id: org.id },
        data: { ownerId: user.id },
      });

      return { org, user };
    });

    logger.info({ userId: user.id, orgId: org.id, email: user.email }, 'User registered with organization');

    // Generate tokens with full user info including orgId
    const token = this.generateToken(user.id, user.orgId, user.email, user.role, '24h');
    const refreshToken = this.generateToken(user.id, user.orgId, user.email, user.role, '7d');

    // Remove password from response
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  }

  async login(data: LoginData): Promise<AuthResponse> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: user.id, orgId: user.orgId, email: user.email }, 'User logged in');

    // Generate tokens with full user info including orgId
    const token = this.generateToken(user.id, user.orgId, user.email, user.role, '24h');
    const refreshToken = this.generateToken(user.id, user.orgId, user.email, user.role, '7d');

    // Remove password from response
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    try {
      const env = getEnv();
      const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as { userId: string; id: string; email: string; role: string };

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.id || decoded.userId },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const newToken = this.generateToken(user.id, user.orgId, user.email, user.role, '24h');

      return { token: newToken };
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  async verifyToken(token: string): Promise<User> {
    try {
      const env = getEnv();
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; id: string };

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.id || decoded.userId },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid token');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }

  async requestPasswordReset(email: string): Promise<{ resetUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return success even if not found to prevent email enumeration
      logger.info({ email }, 'Password reset requested for non-existent email');
      return { resetUrl: '' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry },
    });

    const env = getEnv();
    const baseUrl = env.APP_URL || `http://localhost:${env.PORT}`;
    const resetUrl = `${baseUrl}/reset-password.html?token=${token}`;

    logger.info({ userId: user.id, email }, 'Password reset token generated');
    return { resetUrl };
  }

  async validateResetToken(token: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() },
      },
    });
    return !!user;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    logger.info({ userId: user.id }, 'Password reset successfully');
  }

  private generateToken(userId: string, orgId: string, email: string, role: string, expiresIn: string): string {
    const env = getEnv();
    return jwt.sign({ userId, id: userId, orgId, email, role }, env.JWT_SECRET, { expiresIn } as any);
  }
}
