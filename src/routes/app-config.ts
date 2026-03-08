import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import getPrismaClient from '@config/database';
import { z } from 'zod';

const router = Router();
const prisma = getPrismaClient();

router.use(authenticate);
router.use(requireRole('ADMIN'));

const upsertSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  type: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON']).default('STRING'),
});

// List all configs
router.get('/', async (req, res, next) => {
  try {
    const configs = await prisma.appConfig.findMany({ orderBy: { key: 'asc' } });
    res.json({ success: true, data: configs });
  } catch (error) { next(error); }
});

// Get by key
router.get('/:key', async (req, res, next) => {
  try {
    const config = await prisma.appConfig.findUnique({ where: { key: req.params.key } });
    if (!config) return res.status(404).json({ success: false, error: 'Config not found' });
    res.json({ success: true, data: config });
  } catch (error) { next(error); }
});

// Upsert
router.post('/', async (req, res, next) => {
  try {
    const { key, value, type } = upsertSchema.parse(req.body);
    const config = await prisma.appConfig.upsert({
      where: { key },
      create: { key, value, type },
      update: { value, type },
    });
    res.json({ success: true, data: config });
  } catch (error) { next(error); }
});

// Delete
router.delete('/:key', async (req, res, next) => {
  try {
    await prisma.appConfig.delete({ where: { key: req.params.key } });
    res.json({ success: true, message: 'Config deleted' });
  } catch (error) { next(error); }
});

export default router;
