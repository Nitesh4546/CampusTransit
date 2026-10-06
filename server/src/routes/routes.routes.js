import { Router } from 'express';
import { z } from 'zod';
import { Route } from '../models/Route.js';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { precomputeRouteDists } from '../services/eta.service.js';
import { buildPolylineOSRM } from '../utils/geo.js';
import { env } from '../config/env.js';

const router = Router();

const routeStopSchema = z.object({
  stopId: z.string(),
  order: z.number().int().min(0),
  dwellSec: z.number().optional().default(30),
  scheduledOffsetMin: z.number().optional().default(0),
});

const routeSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional().default('#3B82F6'),
  type: z.enum(['regular', 'event']).optional().default('regular'),
  isLoop: z.boolean().optional().default(false),
  totalDistanceM: z.number().optional().default(0),
  stops: z.array(routeStopSchema).optional().default([]),
  schedule: z.object({
    days: z.array(z.number().int().min(0).max(6)).optional().default([]),
    startTimes: z.array(z.string()).optional().default([]),
  }).optional(),
  isActive: z.boolean().optional().default(true),
});

// GET /routes
router.get('/', async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.type) filter.type = req.query.type;
    const routes = await Route.find(filter).populate('stops.stopId', 'name code location');
    res.json(routes);
  } catch (err) {
    next(err);
  }
});

// GET /routes/:id
router.get('/:id', async (req, res, next) => {
  try {
    const route = await Route.findById(req.params.id).populate('stops.stopId', 'name code location');
    if (!route) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
    res.json(route);
  } catch (err) {
    next(err);
  }
});

// POST /routes - admin
router.post('/', verifyJWT, requireRole('admin'), validate(routeSchema), async (req, res, next) => {
  try {
    const route = await Route.create(req.body);
    
    // Auto-build road polyline if stops are provided
    if (route.stops?.length >= 2 && (!route.polyline || route.polyline.length === 0)) {
      try {
        await route.populate('stops.stopId', 'location');
        const coords = route.stops
          .map(s => s.stopId?.location?.coordinates)
          .filter(Boolean);
        if (coords.length >= 2) {
          const { polyline, cumDist } = await buildPolylineOSRM(coords, env.OSRM_URL);
          route.polyline = polyline;
          route.polylineCumDistM = cumDist;
          route.totalDistanceM = cumDist.length > 0 ? cumDist[cumDist.length - 1] : 0;
          await precomputeRouteDists(route);

          let cumDwellSec = 0;
          for (let i = 0; i < route.stops.length; i++) {
            const stop = route.stops[i];
            const distM = stop.projectedDistM || 0;
            const transitMin = (distM / 1000 / 25) * 60;
            const dwellMin = cumDwellSec / 60;
            stop.scheduledOffsetMin = Math.round(transitMin + dwellMin);
            cumDwellSec += (stop.dwellSec || 30);
          }

          await route.save();
        }
      } catch (osrmErr) {
        console.warn('Auto-OSRM road snap fallback:', osrmErr.message);
      }
    }

    res.status(201).json(route);
  } catch (err) {
    next(err);
  }
});

// PUT /routes/:id - admin
router.put('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!route) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
    // recompute if polyline or stops changed
    if (req.body.polyline || req.body.stops) {
      await precomputeRouteDists(route);
    }
    res.json(route);
  } catch (err) {
    next(err);
  }
});

// DELETE /routes/:id - admin
router.delete('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
    res.json({ message: 'Route deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /routes/:id/build-polyline - admin
router.post('/:id/build-polyline', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const route = await Route.findById(req.params.id).populate('stops.stopId', 'location');
    if (!route) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });

    const coords = route.stops
      .sort((a, b) => a.order - b.order)
      .filter(s => s.stopId?.location?.coordinates)
      .map(s => s.stopId.location.coordinates); // [lng, lat]

    if (coords.length < 2) {
      return res.status(400).json({ error: { code: 'INSUFFICIENT_STOPS', message: 'Need at least 2 stops with locations' } });
    }

    const { polyline, cumDist } = await buildPolylineOSRM(coords, env.OSRM_URL);
    route.polyline = polyline;
    route.polylineCumDistM = cumDist;
    route.totalDistanceM = cumDist.length > 0 ? cumDist[cumDist.length - 1] : 0;
    await precomputeRouteDists(route);

    let cumDwellSec = 0;
    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i];
      const distM = stop.projectedDistM || 0;
      const transitMin = (distM / 1000 / 25) * 60;
      const dwellMin = cumDwellSec / 60;
      stop.scheduledOffsetMin = Math.round(transitMin + dwellMin);
      cumDwellSec += (stop.dwellSec || 30);
    }

    await route.save();
    res.json({ message: 'Polyline built', polylinePoints: polyline.length, totalDistM: route.totalDistanceM, route });
  } catch (err) {
    next(err);
  }
});

// POST /routes/:id/event-mode - admin
router.post('/:id/event-mode', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const { enabled, eventId, headwayMin, activeFrom, activeUntil } = req.body;
    const route = await Route.findByIdAndUpdate(
      req.params.id,
      {
        'eventMode.enabled': enabled,
        'eventMode.eventId': eventId || null,
        'eventMode.headwayMin': headwayMin || 15,
        'eventMode.activeFrom': activeFrom ? new Date(activeFrom) : null,
        'eventMode.activeUntil': activeUntil ? new Date(activeUntil) : null,
      },
      { new: true }
    );
    if (!route) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
    res.json(route);
  } catch (err) {
    next(err);
  }
});

export default router;
