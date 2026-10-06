import { haversineM, projectOnPolyline } from '../utils/geo.js';
import { Route } from '../models/Route.js';

const MIN_SPEED_KMH = 12;
const MAX_SPEED_KMH = 45;
const FALLBACK_SPEED_KMH = 25;
const NEXT_STOP_RADIUS_M = 40;
const OFF_ROUTE_DIST_M = 150;
const OFF_ROUTE_CONSECUTIVE = 3;

// Speed history per tripId for EMA
const speedHistory = new Map();
// Off-route consecutive counts
const offRouteCount = new Map();

/** Exponential moving average for speed */
function updateSpeedEma(tripId, speedKmh) {
  const alpha = 0.3;
  const prev = speedHistory.get(tripId) || speedKmh;
  const ema = alpha * speedKmh + (1 - alpha) * prev;
  speedHistory.set(tripId, ema);
  return ema;
}

function clampSpeed(speed) {
  if (!speed || speed < 1) return FALLBACK_SPEED_KMH;
  return Math.min(Math.max(speed, MIN_SPEED_KMH), MAX_SPEED_KMH);
}

/**
 * Compute per-stop ETAs for a bus.
 * @param {object} busLive - current live position data
 * @param {object} route - populated route document
 * @param {object} trip - trip document
 * @returns {Array} etas per stop
 */
export function computeETAs(busLive, route, trip) {
  if (!route.polyline?.length || !route.polylineCumDistM?.length) return [];

  const { lat, lng, speedKmh: rawSpeed, tripId } = busLive;

  const avgSpeedKmh = clampSpeed(updateSpeedEma(tripId || trip._id.toString(), rawSpeed || 0));
  const avgSpeedMs = (avgSpeedKmh * 1000) / 3600;

  // Project bus onto polyline
  const { distAlongM, segmentIdx } = projectOnPolyline([lat, lng], route.polyline, route.polylineCumDistM);

  const now = new Date();
  const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);

  let dwellAccSec = 0;
  let nextStopIndex = trip.nextStopIndex || 0;
  const etas = [];

  // Check off-route
  const nearest = projectOnPolyline([lat, lng], route.polyline, route.polylineCumDistM);
  const distToPolylineM = nearest.perpDistM || 0;
  const tid = trip._id.toString();
  if (distToPolylineM > OFF_ROUTE_DIST_M) {
    offRouteCount.set(tid, (offRouteCount.get(tid) || 0) + 1);
  } else {
    offRouteCount.set(tid, 0);
  }
  const isOffRoute = (offRouteCount.get(tid) || 0) >= OFF_ROUTE_CONSECUTIVE;

  for (let i = 0; i < sortedStops.length; i++) {
    const stop = sortedStops[i];
    const stopPopulated = stop.stopId;
    if (!stopPopulated) continue;

    const stopDistM = stop.projectedDistM || 0;
    const remainingDist = Math.max(0, stopDistM - distAlongM);

    if (i < nextStopIndex) {
      // Already passed — mark as arrived
      etas.push({
        stopId: stopPopulated._id,
        stopName: stopPopulated.name,
        etaMin: 0,
        etaTime: now.toISOString(),
        status: 'arrived',
        delayMin: 0,
      });
      continue;
    }

    const travelSec = remainingDist / avgSpeedMs;
    const etaSec = travelSec + dwellAccSec;
    const etaMin = Math.ceil(etaSec / 60);
    const etaTime = new Date(now.getTime() + etaSec * 1000);

    // Delay calculation
    let delayMin = 0;
    let status = 'on_time';
    if (trip.scheduledStartAt && stop.scheduledOffsetMin != null) {
      const scheduledTime = new Date(trip.scheduledStartAt.getTime() + stop.scheduledOffsetMin * 60000);
      delayMin = Math.round((etaTime - scheduledTime) / 60000);
      if (delayMin >= 5) status = 'delayed';
    }

    etas.push({
      stopId: stopPopulated._id,
      stopName: stopPopulated.name,
      order: stop.order,
      etaMin,
      etaTime: etaTime.toISOString(),
      status,
      delayMin: Math.max(0, delayMin),
      remainingDistM: Math.round(remainingDist),
      isOffRoute,
    });

    // Add dwell time for intermediate stops
    dwellAccSec += stop.dwellSec || 30;
  }

  return etas;
}

/**
 * Check if bus has passed next stop and advance nextStopIndex.
 * Mutates trip.nextStopIndex and saves if changed.
 */
export async function advanceNextStop(trip, route, busLive) {
  const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);
  const currentIdx = trip.nextStopIndex || 0;
  if (currentIdx >= sortedStops.length) return false;

  const nextStop = sortedStops[currentIdx];
  if (!nextStop?.stopId?.location?.coordinates) return false;

  const [sLng, sLat] = nextStop.stopId.location.coordinates;
  const distM = haversineM(busLive.lat, busLive.lng, sLat, sLng);

  let passed = false;
  if (distM <= NEXT_STOP_RADIUS_M) {
    passed = true;
  } else if (route.polylineCumDistM?.length && nextStop.projectedDistM) {
    const { distAlongM } = projectOnPolyline([busLive.lat, busLive.lng], route.polyline, route.polylineCumDistM);
    if (distAlongM >= nextStop.projectedDistM) {
      passed = true;
    }
  }

  if (passed) {
    trip.nextStopIndex = currentIdx + 1;
    await trip.save();

    // Log arrival punctuality if trip has scheduledStartAt
    if (trip.scheduledStartAt) {
      try {
        const { StopArrival } = await import('../models/StopArrival.js');
        const scheduledTimeMs = new Date(trip.scheduledStartAt).getTime() + (nextStop.scheduledOffsetMin || 0) * 60000;
        const scheduledAt = new Date(scheduledTimeMs);
        const actualAt = new Date();
        const delayMin = Math.round((actualAt.getTime() - scheduledAt.getTime()) / 60000);
        const stopId = nextStop.stopId?._id || nextStop.stopId;

        if (stopId) {
          await StopArrival.create({
            tripId: trip._id,
            busId: trip.busId,
            routeId: route._id,
            stopId,
            kind: 'arrival',
            scheduledAt,
            actualAt,
            delayMin,
          });
        }
      } catch (logErr) {
        console.warn('Failed to log StopArrival on advanceNextStop:', logErr.message);
      }
    }

    return true;
  }

  return false;
}

/**
 * Precompute projected distances for all stops along the route polyline.
 * Called on route save.
 */
export async function precomputeRouteDists(route) {
  if (!route.polyline?.length || !route.polylineCumDistM?.length) return;

  for (const stop of route.stops) {
    const stopDoc = await import('../models/Stop.js').then(m => m.Stop.findById(stop.stopId));
    if (!stopDoc?.location?.coordinates) {
      stop.projectedDistM = 0;
      continue;
    }
    const [lng, lat] = stopDoc.location.coordinates;
    const { distAlongM } = projectOnPolyline([lat, lng], route.polyline, route.polylineCumDistM);
    stop.projectedDistM = distAlongM;
  }
  await route.save();
}
