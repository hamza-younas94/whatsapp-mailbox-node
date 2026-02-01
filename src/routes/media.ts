// src/routes/media.ts
// Media upload API routes

import { Router } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { asyncHandler } from '@middleware/error.middleware';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'media');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  }
});

// Apply authentication to all routes
router.use(authenticate);

// Upload single file
router.post('/upload', upload.single('file'), asyncHandler(async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { message: 'No file uploaded' }
    });
  }

  const fileUrl = `/uploads/media/${req.file.filename}`;
  
  // Determine media type
  let mediaType = 'DOCUMENT';
  if (req.file.mimetype.startsWith('image/')) mediaType = 'IMAGE';
  else if (req.file.mimetype.startsWith('video/')) mediaType = 'VIDEO';
  else if (req.file.mimetype.startsWith('audio/')) mediaType = 'AUDIO';

  res.status(200).json({
    success: true,
    data: {
      url: fileUrl,
      type: mediaType,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  });
}));

// Upload multiple files
router.post('/upload-multiple', upload.array('files', 10), asyncHandler(async (req: any, res: any) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'No files uploaded' }
    });
  }

  const uploadedFiles = files.map(file => {
    let mediaType = 'DOCUMENT';
    if (file.mimetype.startsWith('image/')) mediaType = 'IMAGE';
    else if (file.mimetype.startsWith('video/')) mediaType = 'VIDEO';
    else if (file.mimetype.startsWith('audio/')) mediaType = 'AUDIO';

    return {
      url: `/uploads/media/${file.filename}`,
      type: mediaType,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    };
  });

  res.status(200).json({
    success: true,
    data: uploadedFiles
  });
}));

export default router;
