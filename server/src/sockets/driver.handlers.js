import { z } from 'zod';
import { Trip } from '../models/Trip.js';
import { Route } from '../models/Route.js';
import { Bus } from '../models/Bus.js';
import { DriverPhoto } from '../models/DriverPhoto.js';
import { LocationPing } from '../models/LocationPing.js';
import { updateBus, getLiveState } from '../services/liveState.service.js';
import { computeETAs, advanceNextStop } from '../services/eta.service.js';
import { checkDelay } from '../services/delay.service.js';
import { computeShuttleInfo } from '../services/eventMode.service.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

// Throttle: max 1 bus:update/sec per bus, eta:update max 1/5sec per trip
const lastBusEmit = new Map();
const lastEtaEmit = new Map();
const locationBuffer = new Map(); // for persistence sampling (every ~15s)

const locationSchema = z.object({
  tripId: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).max(200).optional().default(0),
  heading: z.number().min(0).max(360).optional().default(0),
  accuracy: z.number().min(0).max(200).optional().default(50),
  ts: z.number().optional(),
});

export function setupDriverHandlers(io, socket) {
  // driver:trip:start - start trip from socket with photo validation
  socket.on('driver:trip:start', async (payload = {}, callback) => {
    try {
      if (!socket.user || socket.user.role !== 'driver') {
        const err = { code: 'FORBIDDEN', message: 'Only drivers can start a trip' };
        if (callback) callback({ error: err });
        return;
      }

      const { busId, routeId, photoId } = payload;
      if (!busId || !routeId) {
        const err = { code: 'BAD_REQUEST', message: 'busId and routeId are required' };
        if (callback) callback({ error: err });
        return;
      }

      const bus = await Bus.findById(busId);
      if (!bus) {
        const err = { code: 'NOT_FOUND', message: 'Bus not found' };
        if (callback) callback({ error: err });
        return;
      }

      if (bus.status === 'on_trip') {
        const err = { code: 'TRIP_ALREADY_ACTIVE', message: 'This bus already has an active trip' };
        if (callback) callback({ error: err });
        return;
      }

      const route = await Route.findById(routeId);
      if (!route || !route.isActive) {
        const err = { code: 'ROUTE_INACTIVE', message: 'Route is not active' };
        if (callback) callback({ error: err });
        return;
      }

      let photoDoc = null;
      if (env.REQUIRE_DRIVER_PHOTO && !photoId) {
        const err = { code: 'PHOTO_REQUIRED', message: 'Driver photo is required before starting a trip' };
        if (callback) callback({ error: err });
        return;
      }

      if (photoId) {
        photoDoc = await DriverPhoto.findById(photoId);
        if (!photoDoc || photoDoc.userId.toString() !== socket.user._id.toString()) {
          const err = { code: 'PHOTO_REQUIRED', message: 'Photo does not belong to you' };
          if (callback) callback({ error: err });
          return;
        }
        if (photoDoc.status !== 'pending') {
          const err = { code: 'PHOTO_REQUIRED', message: 'Photo already used' };
          if (callback) callback({ error: err });
          return;
        }
        const ageMs = Date.now() - new Date(photoDoc.capturedAt).getTime();
        if (ageMs > 15 * 60 * 1000) {
          const err = { code: 'PHOTO_REQUIRED', message: 'Photo has expired' };
          if (callback) callback({ error: err });
          return;
        }
      }

      const driverSnapshot = {
        name: bus.driver?.name || socket.user.name || 'Driver',
        phone: bus.driver?.phone || '',
        license: bus.driver?.license || '',
      };

      const trip = await Trip.create({
        busId,
        driverId: socket.user._id,
        routeId,
        eventId: route.eventMode?.enabled ? route.eventMode.eventId : null,
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

      socket.join(`bus:${bus._id}`);
      socket.tripId = trip._id.toString();
      socket.busId = bus._id.toString();

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

      if (callback) callback({ tripId: trip._id, status: 'active' });
    } catch (err) {
      logger.error('driver:trip:start error:', err.message);
      if (callback) callback({ error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
  });

  // driver:join - join bus room
  socket.on('driver:join', async ({ tripId } = {}) => {
    try {
      if (!socket.user || socket.user.role !== 'driver') return;
      const trip = await Trip.findById(tripId);
      if (!trip || trip.status !== 'active') return;
      if (trip.driverId.toString() !== socket.user._id.toString()) return;

      socket.join(`bus:${trip.busId}`);
      socket.tripId = tripId;
      socket.busId = trip.busId.toString();
      logger.info(`Driver ${socket.user.name} joined bus:${trip.busId}`);

      const studentDriver = {
        name: trip.driverSnapshot?.name || socket.user.name || 'Driver',
        photoUrl: trip.driverPhotoId ? `/api/trips/${trip._id}/driver-photo` : null,
      };
      const adminDriver = {
        name: trip.driverSnapshot?.name || socket.user.name || 'Driver',
        phone: trip.driverSnapshot?.phone || '',
        license: trip.driverSnapshot?.license || '',
        photoUrl: trip.driverPhotoId ? `/api/trips/${trip._id}/driver-photo` : null,
      };

      // Notify route room of trip started
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
    } catch (err) {
      logger.error('driver:join error:', err.message);
    }
  });

  // driver:location - receive GPS ping
  socket.on('driver:location', async (payload) => {
    try {
      if (!socket.user || socket.user.role !== 'driver') return;

      const parsed = locationSchema.safeParse(payload);
      if (!parsed.success) return;

      const { tripId, lat, lng, speed, heading, accuracy, ts } = parsed.data;

      // Reject if accuracy too poor
      if (accuracy > 100) return;

      // Validate trip ownership
      const trip = await Trip.findById(tripId).populate('busId', 'name plateNo capacity').lean();
      if (!trip || trip.status !== 'active') return;
      if (trip.driverId.toString() !== socket.user._id.toString()) return;

      const busId = (trip.busId?._id || trip.busId).toString();
      const routeId = trip.routeId.toString();

      const busLive = {
        busId,
        busName: trip.busId?.name || 'Campus Shuttle',
        plateNo: trip.busId?.plateNo || '',
        capacity: trip.busId?.capacity || 40,
        tripId,
        routeId,
        lat,
        lng,
        heading,
        speedKmh: speed,
        nextStopIndex: trip.nextStopIndex,
        startTime: trip.startedAt || trip.createdAt,
        updatedAt: new Date(),
      };

      updateBus(tripId, busLive);

      // Throttle bus:update to 1/sec
      const now = Date.now();
      const lastEmit = lastBusEmit.get(tripId) || 0;
      if (now - lastEmit >= 1000) {
        lastBusEmit.set(tripId, now);
        io.to(`route:${routeId}`).emit('bus:update', busLive);
        io.to(`bus:${busId}`).emit('bus:update', busLive);
      }

      // ETA computation (throttle to 1/5sec)
      const lastEta = lastEtaEmit.get(tripId) || 0;
      if (now - lastEta >= 5000) {
        lastEtaEmit.set(tripId, now);
        try {
          const route = await Route.findById(routeId).populate('stops.stopId', 'name code location');
          if (route) {
            const tripDoc = await Trip.findById(tripId);
            const etas = computeETAs(busLive, route, tripDoc);

            // Advance next stop if needed
            await advanceNextStop(tripDoc, route, busLive);

            io.to(`route:${routeId}`).emit('eta:update', { routeId, tripId, etas });

            // Delay check
            await checkDelay(tripDoc, etas, route);

            // Event shuttle update
            if (route.eventMode?.enabled && route.eventMode?.eventId) {
              const shuttleInfo = computeShuttleInfo(route, [{ routeId, etas }], io);
              if (shuttleInfo) {
                io.to(`event:${route.eventMode.eventId}`).emit('event:shuttle', shuttleInfo);
              }
            }

            // Off-route admin alert
            const offRouteEta = etas.find(e => e.isOffRoute);
            if (offRouteEta) {
              io.to('admin').emit('bus:offRoute', { busId, tripId, routeId });
            }
          }
        } catch (err) {
          logger.error('ETA computation error:', err.message);
        }
      }

      // Persist sample every ~15s
      const lastBuf = locationBuffer.get(tripId) || 0;
      if (now - lastBuf >= 15000) {
        locationBuffer.set(tripId, now);
        LocationPing.create({
          tripId,
          busId,
          location: { type: 'Point', coordinates: [lng, lat] },
          speedKmh: speed,
          heading,
          accuracyM: accuracy,
          ts: ts ? new Date(ts) : new Date(),
        }).catch(e => logger.error('LocationPing save failed:', e.message));
      }
    } catch (err) {
      logger.error('driver:location error:', err.message);
    }
  });
}
