// src/services/auth.service.ts
// Authentication service

import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getEnv } from '@config/env';
import { UnauthorizedError, ValidationError } from '@utils/errors';
import logger from '@utils/logger';

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  name?: string;
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

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        name: data.name,
        role: 'USER',
        isActive: true,
      },
    });

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    // Generate tokens with full user info
    const token = this.generateToken(user.id, user.email, user.role, '24h');
    const refreshToken = this.generateToken(user.id, user.email, user.role, '7d');

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

    logger.info({ userId: user.id, email: user.email }, 'User logged in');

    // Generate tokens with full user info
    const token = this.generateToken(user.id, user.email, user.role, '24h');
    const refreshToken = this.generateToken(user.id, user.email, user.role, '7d');

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

      const newToken = this.generateToken(user.id, user.email, user.role, '24h');

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

  private generateToken(userId: string, email: string, role: string, expiresIn: string): string {
    const env = getEnv();
    return jwt.sign({ userId, id: userId, email, role }, env.JWT_SECRET, { expiresIn } as any);
  }
}
