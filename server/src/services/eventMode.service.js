import { getLiveState } from './liveState.service.js';
import { logger } from '../utils/logger.js';

/**
 * Check if event mode is currently active for a route.
 */
export function isEventActive(route, now = new Date()) {
  const em = route.eventMode;
  if (!em?.enabled) return false;
  if (em.activeFrom && now < new Date(em.activeFrom)) return false;
  if (em.activeUntil && now > new Date(em.activeUntil)) return false;
  return true;
}

/**
 * Compute event shuttle info for all active trips on a route.
 * Returns { nextShuttleInMin, activeShuttles, headwayMin }
 */
export function computeShuttleInfo(route, etas, io) {
  if (!isEventActive(route)) return null;

  const em = route.eventMode;
  const liveState = getLiveState();

  const activeShuttles = [];
  let minEtaMin = Infinity;

  for (const [tripId, busLive] of liveState) {
    if (busLive.routeId?.toString() !== route._id.toString()) continue;
    activeShuttles.push({ tripId, busId: busLive.busId, position: { lat: busLive.lat, lng: busLive.lng } });
  }

  // Find minimum ETA across all buses for this route
  for (const tripEtas of etas) {
    if (tripEtas.routeId?.toString() === route._id.toString()) {
      for (const eta of tripEtas.etas || []) {
        if (eta.etaMin < minEtaMin) minEtaMin = eta.etaMin;
      }
    }
  }

  const nextShuttleInMin = minEtaMin === Infinity
    ? em.headwayMin  // no active shuttle — show headway as estimate
    : minEtaMin;

  return {
    eventId: em.eventId,
    routeId: route._id,
    nextShuttleInMin,
    headwayMin: em.headwayMin,
    activeShuttles,
  };
}
