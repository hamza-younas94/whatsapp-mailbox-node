// src/controllers/auth.controller.ts
// Authentication HTTP handlers

import { Request, Response } from 'express';
import { AuthService } from '@services/auth.service';
import { asyncHandler } from '@middleware/error.middleware';

export class AuthController {
  constructor(private service: AuthService) {}

  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.register(req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.login(req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const result = await this.service.refreshToken(refreshToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  });
}
