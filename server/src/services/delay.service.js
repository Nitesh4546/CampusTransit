import { env } from '../config/env.js';
import { generateDelayAnnouncement } from './announcement.service.js';
import { logger } from '../utils/logger.js';

const DELAY_THRESHOLD = env.DELAY_THRESHOLD_MIN;
const CONSECUTIVE_REQUIRED = 2;
const MIN_INTERVAL_MS = 10 * 60 * 1000; // 10 min
const INCREMENTAL_THRESHOLD = 5; // additional 5 min triggers new announcement

// State per tripId
const consecutiveDelays = new Map();
const lastDelayMin = new Map();

let ioInstance = null;

export function setDelayServiceIO(io) {
  ioInstance = io;
}

/**
 * Run delay detection after each ETA update.
 * @param {object} trip - trip document (with lastDelayAnnouncementAt)
 * @param {Array} etas - computed ETAs
 * @param {object} route - route document
 */
export async function checkDelay(trip, etas, route) {
  if (!etas?.length) return;

  const tripId = trip._id.toString();
  const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);
  const nextStopEta = etas.find(e => e.order >= (trip.nextStopIndex || 0) && e.status !== 'arrived');

  if (!nextStopEta) return;

  const { delayMin, stopName } = nextStopEta;

  if (delayMin >= DELAY_THRESHOLD) {
    const count = (consecutiveDelays.get(tripId) || 0) + 1;
    consecutiveDelays.set(tripId, count);

    if (count < CONSECUTIVE_REQUIRED) return;

    const now = Date.now();
    const lastAt = trip.lastDelayAnnouncementAt;
    const prevDelay = lastDelayMin.get(tripId) || 0;

    const timeSinceLastMs = lastAt ? now - new Date(lastAt).getTime() : Infinity;
    const delayGrew = delayMin - prevDelay >= INCREMENTAL_THRESHOLD;

    if (timeSinceLastMs >= MIN_INTERVAL_MS || delayGrew) {
      lastDelayMin.set(tripId, delayMin);
      try {
        const ann = await generateDelayAnnouncement(trip._id, null, {
          routeName: route.name,
          stopName: nextStopEta.stopName,
          delayMin,
          etaTime: nextStopEta.etaTime,
        });

        if (ioInstance) {
          if (ann.status === 'published') {
            ioInstance.to(`route:${route._id}`).emit('announcement:new', ann);
          } else {
            ioInstance.to('admin').emit('announcement:draft', ann);
          }
        }
      } catch (err) {
        logger.error('Delay announcement generation failed:', err.message);
      }
    }
  } else {
    consecutiveDelays.set(tripId, 0);
  }
}

export function clearTripDelayState(tripId) {
  consecutiveDelays.delete(tripId);
  lastDelayMin.delete(tripId);
}
