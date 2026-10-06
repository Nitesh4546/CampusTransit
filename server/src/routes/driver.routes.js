import { Router } from 'express';
import multer from 'multer';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import { saveDriverPhoto, checkRateLimit } from '../services/driverPhoto.service.js';

const router = Router();

// Multer in-memory storage, max 800 KB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 800 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      cb(null, true);
    } else {
      const err = new Error('Invalid file type. Only JPEG photos are accepted.');
      err.code = 'INVALID_FORMAT';
      err.statusCode = 400;
      cb(err);
    }
  },
});

// POST /api/driver/photo
router.post(
  '/photo',
  verifyJWT,
  requireRole('driver', 'admin'),
  (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: { code: 'LIMIT_FILE_SIZE', message: 'Photo exceeds 800 KB limit' },
          });
        }
        return res.status(400).json({
          error: { code: err.code || 'BAD_REQUEST', message: err.message },
        });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          error: { code: 'PHOTO_REQUIRED', message: 'Photo file is required' },
        });
      }

      // Check rate limit: 10 per hour per user
      if (!checkRateLimit(req.user._id)) {
        return res.status(429).json({
          error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many photo uploads. Limit is 10 per hour.' },
        });
      }

      const photo = await saveDriverPhoto(req.user._id, req.file.buffer);

      res.status(201).json({
        photoId: photo._id,
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          error: { code: err.code || 'BAD_REQUEST', message: err.message },
        });
      }
      next(err);
    }
  }
);

export default router;
