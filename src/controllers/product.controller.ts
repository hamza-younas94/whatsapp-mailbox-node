// src/controllers/product.controller.ts
// Product HTTP handlers

import { Request, Response } from 'express';
import { ProductService } from '@services/product.service';
import { asyncHandler } from '@middleware/error.middleware';

export class ProductController {
  constructor(private service: ProductService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const product = await this.service.createProduct(userId, req.body);
    res.status(201).json({ success: true, data: product });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { category, isActive, lowStock, search, page, limit } = req.query;

    const result = await this.service.getProducts(userId, {
      category: category as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      lowStock: lowStock === 'true',
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const product = await this.service.getProduct(req.params.id);
    res.status(200).json({ success: true, data: product });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const product = await this.service.updateProduct(req.params.id, userId, req.body);
    res.status(200).json({ success: true, data: product });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.deleteProduct(req.params.id);
    res.status(200).json({ success: true, message: 'Product deleted' });
  });

  getInventory = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const result = await this.service.getInventoryHistory(
      req.params.id,
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    res.status(200).json({ success: true, ...result });
  });

  addInventory = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { type, quantity, reason } = req.body;
    const transaction = await this.service.addInventoryTransaction(
      req.params.id,
      userId,
      type,
      quantity,
      reason
    );
    res.status(201).json({ success: true, data: transaction });
  });
}
