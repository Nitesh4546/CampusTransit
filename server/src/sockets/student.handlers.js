import { getLiveState } from '../services/liveState.service.js';
import { Announcement } from '../models/Announcement.js';
import { Trip } from '../models/Trip.js';
import { logger } from '../utils/logger.js';

export function setupStudentHandlers(io, socket) {
  // Handler for student subscribing to route(s)
  const handleStudentSubscribe = async (payload = {}) => {
    try {
      const routeIds = payload.routeIds || (payload.routeId ? [payload.routeId] : []);
      for (const routeId of routeIds) {
        socket.join(`route:${routeId}`);
      }

      // Send snapshot of current live buses on these routes
      const liveState = getLiveState();
      const buses = [];
      for (const [, busLive] of liveState) {
        if (routeIds.includes(busLive.routeId?.toString())) {
          buses.push(busLive);
        }
      }

      const announcements = await Announcement.find({
        routeId: { $in: routeIds },
        status: 'published',
      }).sort({ publishedAt: -1 }).limit(10);

      // Collect driver public payload (name, photoUrl only) for active trips
      const liveTripIds = buses.map(b => b.tripId);
      const activeTrips = await Trip.find({ _id: { $in: liveTripIds }, status: 'active' });
      const drivers = {};
      for (const t of activeTrips) {
        drivers[t._id.toString()] = {
          name: t.driverSnapshot?.name || 'Driver',
          photoUrl: t.driverPhotoId ? `/api/trips/${t._id}/driver-photo` : null,
        };
      }

      socket.emit('snapshot', { buses, announcements, drivers });
    } catch (err) {
      logger.error('student:subscribe error:', err.message);
    }
  };

  socket.on('student:subscribe', handleStudentSubscribe);
  socket.on('student:join:route', handleStudentSubscribe);

  // student:unsubscribe - leave route rooms
  socket.on('student:unsubscribe', ({ routeIds = [] } = {}) => {
    for (const routeId of routeIds) {
      socket.leave(`route:${routeId}`);
    }
  });

  // event:subscribe - join event room
  socket.on('event:subscribe', async ({ eventId } = {}) => {
    try {
      if (!eventId) return;
      socket.join(`event:${eventId}`);

      const announcements = await Announcement.find({
        eventId,
        status: 'published',
      }).sort({ publishedAt: -1 }).limit(10);

      socket.emit('snapshot', { buses: [], announcements });
    } catch (err) {
      logger.error('event:subscribe error:', err.message);
    }
  });
}
