import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Event } from '../models/Event.js';
import { Route } from '../models/Route.js';
import { User } from '../models/User.js';
import { Trip } from '../models/Trip.js';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getLiveState } from '../services/liveState.service.js';

const router = Router();

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  venueName: z.string().min(1),
  venueLocation: z.object({
    coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  }),
  startsAt: z.string().transform(s => new Date(s)),
  endsAt: z.string().transform(s => new Date(s)),
  shuttleWindow: z.object({
    from: z.string().transform(s => new Date(s)),
    until: z.string().transform(s => new Date(s)),
  }),
  routeIds: z.array(z.string()).optional().default([]),
  isPublished: z.boolean().optional().default(false),
});

// GET /events - public (upcoming/ongoing published events)
router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const events = await Event.find({
      isPublished: true,
      endsAt: { $gte: now },
    }).sort({ startsAt: 1 });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// GET /events/all - admin (all events)
router.get('/all', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const events = await Event.find().sort({ startsAt: -1 });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// GET /events/:id - public or admin (?include=routes,activeBuses)
router.get('/:id', async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    let currentUser = null;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.slice(7);
        const payload = jwt.verify(token, env.JWT_SECRET);
        currentUser = await User.findById(payload.sub);
      } catch (e) {
        // ignore invalid token for optional auth
      }
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found' } });
    }
    if (!event.isPublished && currentUser?.role !== 'admin') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found' } });
    }

    const routes = await Route.find({ _id: { $in: event.routeIds } })
      .populate('stops.stopId', 'name code location');

    const trips = await Trip.find({ routeId: { $in: routes.map(route => route._id) }, status: 'active' })
      .populate('busId')
      .populate('driverId', 'name email phone');

    const liveState = getLiveState();

    const activeBuses = trips.map(trip => {
      const bus = trip.busId;
      const driver = trip.driverId;
      const live = liveState.get(trip._id.toString()) || null;
      return {
        _id: trip._id,
        tripId: trip._id,
        routeId: trip.routeId,
        bus: bus ? {
          _id: bus._id,
          name: bus.name,
          plateNo: bus.plateNo,
          capacity: bus.capacity,
          driver: bus.driver,
        } : null,
        driver: {
          name: bus?.driver?.name || driver?.name || 'Assigned Driver',
          phone: bus?.driver?.phone || '',
          license: bus?.driver?.license || '',
          email: driver?.email || null,
        },
        nextStopIndex: live?.nextStopIndex ?? trip.nextStopIndex ?? 0,
        speedKmh: live?.speedKmh ?? 0,
        lat: live?.lat ?? null,
        lng: live?.lng ?? null,
        lastPingAt: live?.updatedAt ?? trip.updatedAt ?? trip.startedAt,
        status: trip.status,
      };
    });

    const activeTrips = trips.map(trip => ({
      ...trip.toObject(),
      livePosition: liveState.get(trip._id.toString()) || null,
    }));

    res.json({ event, routes, activeBuses, activeTrips });
  } catch (err) {
    next(err);
  }
});

// POST /events - admin
router.post('/', verifyJWT, requireRole('admin'), validate(eventSchema), async (req, res, next) => {
  try {
    const event = await Event.create({
      ...req.body,
      venueLocation: { type: 'Point', coordinates: req.body.venueLocation.coordinates },
    });
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

// PUT /events/:id - admin
router.put('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    if (req.body.venueLocation?.coordinates) {
      req.body.venueLocation = { type: 'Point', coordinates: req.body.venueLocation.coordinates };
    }
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found' } });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// DELETE /events/:id - admin
router.delete('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found' } });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
