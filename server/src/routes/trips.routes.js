import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { Trip } from '../models/Trip.js';
import { Bus } from '../models/Bus.js';
import { Route } from '../models/Route.js';
import { DriverPhoto } from '../models/DriverPhoto.js';
import { User } from '../models/User.js';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getLiveState } from '../services/liveState.service.js';
import { StopArrival } from '../models/StopArrival.js';
import { PHOTOS_DIR, deleteDriverPhotoForTrip } from '../services/driverPhoto.service.js';
import { env } from '../config/env.js';

const router = Router();

const startTripSchema = z.object({
  busId: z.string(),
  routeId: z.string(),
  photoId: z.string().optional(),
  scheduledStartAt: z.string().optional(),
});

/**
 * GET /api/trips/:id/driver-photo
 * Publicly accessible ONLY while the trip is 'active'; 404 otherwise.
 */
router.get('/:id/driver-photo', async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip || trip.status !== 'active' || !trip.driverPhotoId) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Driver photo not found or trip is not active' },
      });
    }

    const photo = await DriverPhoto.findById(trip.driverPhotoId);
    if (!photo || !photo.filename) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Driver photo record not found' },
      });
    }

    const filePath = path.join(PHOTOS_DIR, photo.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Driver photo file not found' },
      });
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=300',
    });

    return res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// POST /trips/start - driver or admin
router.post('/start', verifyJWT, requireRole('driver', 'admin'), validate(startTripSchema), async (req, res, next) => {
  try {
    const { busId, routeId, photoId, scheduledStartAt } = req.body;

    const bus = await Bus.findById(busId);
    if (!bus) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bus not found' } });

    if (req.user.role === 'driver' && bus._id.toString() !== req.user.assignedBus?.toString()) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This bus is not assigned to you' } });
    }
    if (bus.status === 'on_trip') {
      return res.status(409).json({ error: { code: 'TRIP_ALREADY_ACTIVE', message: 'This bus already has an active trip' } });
    }

    const route = await Route.findById(routeId);
    if (!route) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
    if (!route.isActive) {
      return res.status(400).json({ error: { code: 'ROUTE_INACTIVE', message: 'This route is not active' } });
    }

    const driverAssignedRoute = req.user.assignedRoute?.toString() || bus.defaultRouteId?.toString();
    if (req.user.role === 'driver' && driverAssignedRoute && route._id.toString() !== driverAssignedRoute) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This route is not assigned to you' } });
    }

    // Avoid leaving a second active trip behind if bus state drifted from trip state
    const existingTrip = await Trip.findOne({ busId, status: 'active' });
    if (existingTrip) {
      return res.status(409).json({ error: { code: 'TRIP_ALREADY_ACTIVE', message: 'This bus already has an active trip' } });
    }

    // Photo validation
    let photoDoc = null;
    if (env.REQUIRE_DRIVER_PHOTO && !photoId) {
      return res.status(400).json({
        error: { code: 'PHOTO_REQUIRED', message: 'A live driver photo is required before starting a trip' },
      });
    }

    if (photoId) {
      photoDoc = await DriverPhoto.findById(photoId);
      if (!photoDoc || photoDoc.userId.toString() !== req.user._id.toString()) {
        return res.status(400).json({
          error: { code: 'PHOTO_REQUIRED', message: 'Photo does not exist or does not belong to you' },
        });
      }
      if (photoDoc.status !== 'pending') {
        return res.status(400).json({
          error: { code: 'PHOTO_REQUIRED', message: 'Photo has already been attached to a trip' },
        });
      }
      const ageMs = Date.now() - new Date(photoDoc.capturedAt).getTime();
      if (ageMs > 15 * 60 * 1000) {
        return res.status(400).json({
          error: { code: 'PHOTO_REQUIRED', message: 'Photo is older than 15 minutes, please take a new photo' },
        });
      }
    }

    // Capture driver details snapshot from bus.driver, falling back to req.user.name
    const driverSnapshot = {
      name: bus.driver?.name || req.user.name || 'Driver',
      phone: bus.driver?.phone || '',
      license: bus.driver?.license || '',
    };

    const trip = await Trip.create({
      busId,
      driverId: req.user._id,
      routeId,
      eventId: route.eventMode?.enabled ? route.eventMode.eventId : null,
      scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : null,
      status: 'active',
      driverPhotoId: photoDoc ? photoDoc._id : null,
      driverSnapshot,
    });

    if (photoDoc) {
      photoDoc.status = 'attached';
      photoDoc.tripId = trip._id;
      await photoDoc.save();
    }

    await Bus.findByIdAndUpdate(busId, { status: 'on_trip', currentRouteId: routeId, currentTripId: trip._id });

    // Punctuality: log departure if scheduledStartAt was provided
    if (trip.scheduledStartAt) {
      const scheduledAt = new Date(trip.scheduledStartAt);
      const actualAt = trip.startedAt || new Date();
      const delayMin = Math.round((actualAt.getTime() - scheduledAt.getTime()) / 60000);
      const firstStop = route.stops?.[0];
      const stopId = firstStop?.stopId?._id || firstStop?.stopId;
      if (stopId) {
        await StopArrival.create({
          tripId: trip._id,
          busId: trip.busId,
          routeId: trip.routeId,
          stopId,
          kind: 'departure',
          scheduledAt,
          actualAt,
          delayMin,
        });
      }
    }

    // Socket broadcasts: student payload has only name & photoUrl; admin payload includes phone & license
    const io = req.app.get('io');
    if (io) {
      const studentDriver = {
        name: driverSnapshot.name,
        photoUrl: photoDoc ? `/api/trips/${trip._id}/driver-photo` : null,
      };
      const adminDriver = {
        name: driverSnapshot.name,
        phone: driverSnapshot.phone,
        license: driverSnapshot.license,
        photoUrl: photoDoc ? `/api/trips/${trip._id}/driver-photo` : null,
      };

      io.to(`route:${trip.routeId}`).emit('trip:started', {
        tripId: trip._id,
        routeId: trip.routeId,
        busId: trip.busId,
        driver: studentDriver,
      });

      io.to('admin').emit('trip:started', {
        tripId: trip._id,
        routeId: trip.routeId,
        busId: trip.busId,
        driver: adminDriver,
      });
    }

    res.status(201).json(trip);
  } catch (err) {
    next(err);
  }
});

// POST /trips/:id/end - driver
router.post('/:id/end', verifyJWT, requireRole('driver', 'admin'), async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trip not found' } });

    // only the driver of this trip or an admin can end it
    if (req.user.role !== 'admin' && trip.driverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your trip' } });
    }

    trip.status = 'completed';
    trip.endedAt = new Date();
    await trip.save();

    await Bus.findByIdAndUpdate(trip.busId, { status: 'idle', currentTripId: null, currentRouteId: null });

    // Remove from live state
    const { removeBus } = await import('../services/liveState.service.js');
    removeBus(trip._id.toString());

    // Immediately delete photo file and DB record
    await deleteDriverPhotoForTrip(trip._id);

    // Notify sockets
    const io = req.app.get('io');
    if (io) {
      io.to(`route:${trip.routeId}`).emit('trip:ended', { tripId: trip._id, routeId: trip.routeId, busId: trip.busId });
      io.to('admin').emit('trip:ended', { tripId: trip._id, routeId: trip.routeId, busId: trip.busId });
    }

    res.json(trip);
  } catch (err) {
    next(err);
  }
});

// GET /trips/active - public (students) or admin
router.get('/active', async (req, res, next) => {
  try {
    // Check if requester has admin token
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, env.JWT_SECRET);
        if (decoded?.sub) {
          const user = await User.findById(decoded.sub).select('role');
          if (user?.role === 'admin') {
            isAdmin = true;
          }
        }
      } catch (_) {}
    }

    const trips = await Trip.find({ status: 'active' })
      .populate('busId', 'name plateNo capacity driver')
      .populate('routeId', 'name color')
      .populate('driverId', 'name');

    const liveState = getLiveState();
    const result = trips.map(t => {
      const obj = t.toObject();

      const publicDriver = {
        name: t.driverSnapshot?.name || t.driverId?.name || 'Driver',
        photoUrl: t.driverPhotoId ? `/api/trips/${t._id}/driver-photo` : null,
      };

      if (isAdmin) {
        obj.driver = {
          ...publicDriver,
          phone: t.driverSnapshot?.phone || '',
          license: t.driverSnapshot?.license || '',
        };
      } else {
        obj.driver = publicDriver;
        // Never expose phone or license in driverSnapshot to students
        delete obj.driverSnapshot;
      }

      obj.livePosition = liveState.get(t._id.toString()) || null;
      return obj;
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /trips/:id - any auth
router.get('/:id', verifyJWT, async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('busId', 'name plateNo driver')
      .populate('routeId', 'name color stops')
      .populate('driverId', 'name');
    if (!trip) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trip not found' } });

    const obj = trip.toObject();
    const isAdmin = req.user.role === 'admin';

    const driverInfo = {
      name: trip.driverSnapshot?.name || trip.driverId?.name || 'Driver',
      photoUrl: trip.driverPhotoId ? `/api/trips/${trip._id}/driver-photo` : null,
    };

    if (isAdmin) {
      driverInfo.phone = trip.driverSnapshot?.phone || '';
      driverInfo.license = trip.driverSnapshot?.license || '';
    } else {
      delete obj.driverSnapshot;
    }

    obj.driver = driverInfo;
    res.json(obj);
  } catch (err) {
    next(err);
  }
});

export default router;
