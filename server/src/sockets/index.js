import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { setupDriverHandlers } from './driver.handlers.js';
import { setupStudentHandlers } from './student.handlers.js';
import { getLiveState, getLastPingTime, removeBus } from '../services/liveState.service.js';
import { Announcement } from '../models/Announcement.js';
import { logger } from '../utils/logger.js';

const OFFLINE_TIMEOUT_MS = 30000; // 30 seconds

export function initSockets(io) {
  // Auth middleware for socket handshake
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (token) {
        const payload = jwt.verify(token, env.JWT_SECRET);
        const user = await User.findById(payload.sub).select('-passwordHash');
        if (user) {
          socket.user = user;
        }
      }
      next();
    } catch (err) {
      // Anonymous connections allowed for students
      next();
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} user=${socket.user?.email || 'anonymous'}`);

    setupDriverHandlers(io, socket);
    setupStudentHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  // Offline detection interval
  setInterval(() => {
    const liveState = getLiveState();
    const now = Date.now();
    for (const [tripId, busLive] of liveState) {
      const lastPing = getLastPingTime(tripId);
      if (lastPing && now - lastPing > OFFLINE_TIMEOUT_MS) {
        logger.warn(`Bus offline: tripId=${tripId}`);
        io.to(`route:${busLive.routeId}`).emit('bus:offline', { busId: busLive.busId, tripId });
        io.to('admin').emit('bus:offline', { busId: busLive.busId, tripId });
        removeBus(tripId);
      }
    }
  }, 10000);
}
