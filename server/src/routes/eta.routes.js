import { Router } from 'express';
import { computeETAs } from '../services/eta.service.js';
import { getLiveState } from '../services/liveState.service.js';
import { Route } from '../models/Route.js';
import { Trip } from '../models/Trip.js';

const router = Router();

// GET /eta/:routeId - public REST fallback
router.get('/:routeId', async (req, res, next) => {
  try {
    const route = await Route.findById(req.params.routeId).populate('stops.stopId', 'name code location');
    if (!route) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });

    const activeTrips = await Trip.find({ routeId: req.params.routeId, status: 'active' });
    const liveState = getLiveState();

    const results = [];
    for (const trip of activeTrips) {
      const busLive = liveState.get(trip._id.toString());
      if (!busLive) continue;
      const etas = computeETAs(busLive, route, trip);
      results.push({ tripId: trip._id, busId: trip.busId, etas });
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
