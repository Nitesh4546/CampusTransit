import { Router } from 'express';
import { z } from 'zod';
import { Announcement } from '../models/Announcement.js';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { generateDelayAnnouncement } from '../services/announcement.service.js';
import rateLimit from 'express-rate-limit';

const router = Router();

const announceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many announcement requests' } },
});

const createSchema = z.object({
  routeId: z.string(),
  kind: z.enum(['delay', 'cancellation', 'info', 'event']),
  text: z.string().min(1),
  textShort: z.string().optional().default(''),
  tripId: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
});

// GET /announcements - public
router.get('/', async (req, res, next) => {
  try {
    const filter = { status: 'published' };
    if (req.query.routeId) filter.routeId = req.query.routeId;
    if (req.query.eventId) filter.eventId = req.query.eventId;
    const announcements = await Announcement.find(filter)
      .sort({ publishedAt: -1 })
      .limit(50);
    res.json(announcements);
  } catch (err) {
    next(err);
  }
});

// GET /announcements/drafts - admin
router.get('/drafts', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const drafts = await Announcement.find({ status: 'draft' })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(drafts);
  } catch (err) {
    next(err);
  }
});

// POST /announcements - admin/driver manual
router.post('/', verifyJWT, requireRole('admin', 'driver'), announceLimiter, validate(createSchema), async (req, res, next) => {
  try {
    const ann = await Announcement.create({
      ...req.body,
      source: 'manual',
      status: 'published',
      publishedAt: new Date(),
    });
    // broadcast via io if available
    const io = req.app.get('io');
    if (io) {
      io.to(`route:${ann.routeId}`).emit('announcement:new', ann);
    }
    res.status(201).json(ann);
  } catch (err) {
    next(err);
  }
});

// POST /announcements/generate-delay - admin/driver
router.post('/generate-delay', verifyJWT, requireRole('admin', 'driver'), announceLimiter, async (req, res, next) => {
  try {
    const { tripId, reason } = req.body;
    if (!tripId) return res.status(400).json({ error: { code: 'MISSING_TRIP', message: 'tripId is required' } });

    const ann = await generateDelayAnnouncement(tripId, reason);
    res.status(201).json(ann);
  } catch (err) {
    next(err);
  }
});

// PATCH /announcements/:id/publish - admin
router.patch('/:id/publish', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const ann = await Announcement.findByIdAndUpdate(
      req.params.id,
      { status: 'published', publishedAt: new Date() },
      { new: true }
    );
    if (!ann) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Announcement not found' } });

    const io = req.app.get('io');
    if (io) {
      io.to(`route:${ann.routeId}`).emit('announcement:new', ann);
      if (ann.eventId) io.to(`event:${ann.eventId}`).emit('announcement:new', ann);
    }
    res.json(ann);
  } catch (err) {
    next(err);
  }
});

export default router;
