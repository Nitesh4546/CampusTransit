import { Router } from 'express';
import { z } from 'zod';
import { Stop } from '../models/Stop.js';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const stopSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  location: z.object({
    coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  }),
  isEventStop: z.boolean().optional(),
  eventId: z.string().optional().nullable(),
});

// GET /stops - public
router.get('/', async (req, res, next) => {
  try {
    const stops = await Stop.find().sort({ name: 1 });
    res.json(stops);
  } catch (err) {
    next(err);
  }
});

// GET /stops/:id - public
router.get('/:id', async (req, res, next) => {
  try {
    const stop = await Stop.findById(req.params.id);
    if (!stop) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Stop not found' } });
    res.json(stop);
  } catch (err) {
    next(err);
  }
});

// POST /stops - admin
router.post('/', verifyJWT, requireRole('admin'), validate(stopSchema), async (req, res, next) => {
  try {
    const stop = await Stop.create({
      ...req.body,
      location: { type: 'Point', coordinates: req.body.location.coordinates },
    });
    res.status(201).json(stop);
  } catch (err) {
    next(err);
  }
});

// PUT /stops/:id - admin
router.put('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const stop = await Stop.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!stop) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Stop not found' } });
    res.json(stop);
  } catch (err) {
    next(err);
  }
});

// DELETE /stops/:id - admin
router.delete('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const stop = await Stop.findByIdAndDelete(req.params.id);
    if (!stop) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Stop not found' } });
    res.json({ message: 'Stop deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
