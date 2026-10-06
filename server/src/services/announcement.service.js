import { Trip } from '../models/Trip.js';
import { Route } from '../models/Route.js';
import { Bus } from '../models/Bus.js';
import { Announcement } from '../models/Announcement.js';
import { generateDelayText } from './gemini.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Generate and save a delay announcement for a trip.
 * Uses Gemini or template fallback.
 */
export async function generateDelayAnnouncement(tripId, reason = null, context = null) {
  const trip = await Trip.findById(tripId);
  if (!trip || trip.status !== 'active') {
    throw new Error('Trip not found or not active');
  }

  const route = await Route.findById(trip.routeId);
  const bus = await Bus.findById(trip.busId);

  const ctx = context || {
    routeName: route?.name || 'Unknown Route',
    busName: bus?.name || 'Unknown Bus',
    stopName: 'Next stop',
    delayMin: 5,
    etaTime: new Date(Date.now() + 5 * 60000).toISOString(),
    reason,
  };

  const { text, textShort, source } = await generateDelayText(ctx);

  const autoPublish = env.AI_AUTO_PUBLISH;
  const ann = await Announcement.create({
    tripId: trip._id,
    routeId: trip.routeId,
    eventId: trip.eventId || null,
    kind: 'delay',
    text,
    textShort,
    source,
    status: autoPublish ? 'published' : 'draft',
    meta: {
      delayMin: ctx.delayMin,
      stopName: ctx.stopName,
      reason: reason || undefined,
    },
    publishedAt: autoPublish ? new Date() : null,
  });

  // Update trip's last delay announcement time
  await Trip.findByIdAndUpdate(tripId, { lastDelayAnnouncementAt: new Date() });

  logger.info(`Announcement created (${source}, ${ann.status}) for trip ${tripId}`);
  return ann;
}
