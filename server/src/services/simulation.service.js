import { Route } from '../models/Route.js';
import { Bus } from '../models/Bus.js';
import { Trip } from '../models/Trip.js';
import { User } from '../models/User.js';
import { haversineM, computeCumDist, buildPolylineOSRM } from '../utils/geo.js';
import { updateBus, removeBus } from './liveState.service.js';
import { computeETAs, advanceNextStop, precomputeRouteDists } from './eta.service.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * In-memory registry of active simulated route runners.
 * Map<routeIdString, SimulationRunner>
 */
const activeSimulations = new Map();
let syncIntervalTimer = null;
let ioInstance = null;

/**
 * Interpolate a position and heading along a polyline at a given distance.
 * @param {Array<[number, number]>} polyline - [[lat, lng], ...]
 * @param {number} targetDistM - target distance along polyline in meters
 * @param {number} direction - 1 (forward) or -1 (reverse)
 * @returns {{ lat: number, lng: number, heading: number }}
 */
function interpolatePolyline(polyline, targetDistM, direction = 1) {
  if (!polyline || polyline.length === 0) {
    return { lat: 0, lng: 0, heading: 0 };
  }
  if (polyline.length === 1) {
    return { lat: polyline[0][0], lng: polyline[0][1], heading: 0 };
  }

  let accumulated = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLat, aLng] = polyline[i];
    const [bLat, bLng] = polyline[i + 1];
    const segLen = haversineM(aLat, aLng, bLat, bLng);

    if (accumulated + segLen >= targetDistM) {
      const remaining = targetDistM - accumulated;
      const t = segLen > 0 ? remaining / segLen : 0;
      const lat = aLat + t * (bLat - aLat);
      const lng = aLng + t * (bLng - aLng);

      let heading;
      if (direction >= 0) {
        heading = Math.atan2(bLng - aLng, bLat - aLat) * (180 / Math.PI);
      } else {
        heading = Math.atan2(aLng - bLng, aLat - bLat) * (180 / Math.PI);
      }
      return { lat, lng, heading: (heading + 360) % 360 };
    }
    accumulated += segLen;
  }

  const last = polyline[polyline.length - 1];
  const prev = polyline[polyline.length - 2] || last;
  const heading = Math.atan2(last[1] - prev[1], last[0] - prev[0]) * (180 / Math.PI);
  return { lat: last[0], lng: last[1], heading: (heading + 360) % 360 };
}

/**
 * Calculate total length of polyline in meters.
 */
function totalPolylineLength(polyline) {
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    total += haversineM(polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1]);
  }
  return total;
}

/**
 * Ensure a dedicated simulation driver User exists in MongoDB.
 */
async function getOrCreateSimDriver() {
  let driver = await User.findOne({ email: 'simulator@campus.internal' });
  if (!driver) {
    driver = await User.create({
      name: 'Campus AutoPilot',
      email: 'simulator@campus.internal',
      passwordHash: 'simulation_account_no_login',
      role: 'driver',
    });
  }
  return driver;
}

/**
 * Ensure a dedicated simulation Bus exists for a route.
 */
async function getOrCreateSimBus(route) {
  const routeSuffix = route._id.toString().slice(-4).toUpperCase();
  const plateNo = `SIM-${routeSuffix}`;

  let bus = await Bus.findOne({ plateNo });
  if (!bus) {
    bus = await Bus.create({
      plateNo,
      name: `${route.name} Shuttle`,
      capacity: 40,
      defaultRouteId: route._id,
      driver: {
        name: `${route.name} Pilot`,
        phone: '+91 98000 00000',
        license: `SIM-${routeSuffix}`,
      },
      status: 'idle',
    });
  } else if (bus.name !== `${route.name} Shuttle` || String(bus.defaultRouteId) !== String(route._id)) {
    bus.name = `${route.name} Shuttle`;
    bus.defaultRouteId = route._id;
    await bus.save();
  }
  return bus;
}

/**
 * Build or retrieve a valid polyline for a route.
 */
async function ensureRoutePolyline(route) {
  if (route.polyline && route.polyline.length >= 2) {
    if (!route.polylineCumDistM || route.polylineCumDistM.length !== route.polyline.length) {
      route.polylineCumDistM = computeCumDist(route.polyline);
      route.totalDistanceM = route.polylineCumDistM[route.polylineCumDistM.length - 1] || 0;
      await route.save();
    }
    return route.polyline;
  }

  // Fallback to stop coordinates if available
  if (route.stops && route.stops.length >= 2) {
    await route.populate('stops.stopId', 'name location');
    const sortedStops = [...(route.stops || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const coords = sortedStops
      .map(s => s.stopId?.location?.coordinates)
      .filter(Boolean); // [[lng, lat], ...]

    if (coords.length >= 2) {
      try {
        const { polyline, cumDist } = await buildPolylineOSRM(coords, env.OSRM_URL);
        route.polyline = polyline;
        route.polylineCumDistM = cumDist;
        route.totalDistanceM = cumDist[cumDist.length - 1] || 0;
        await precomputeRouteDists(route);
        await route.save();
        return route.polyline;
      } catch (err) {
        logger.warn(`OSRM failed for route ${route.name}, using straight line fallback: ${err.message}`);
        const polyline = coords.map(([lng, lat]) => [lat, lng]);
        const cumDist = computeCumDist(polyline);
        route.polyline = polyline;
        route.polylineCumDistM = cumDist;
        route.totalDistanceM = cumDist[cumDist.length - 1] || 0;
        await precomputeRouteDists(route);
        await route.save();
        return route.polyline;
      }
    }
  }

  return null;
}

/**
 * Start a single route simulation runner.
 */
async function startRouteRunner(route, io) {
  const routeIdStr = route._id.toString();

  // If already running, update polyline if needed and return
  if (activeSimulations.has(routeIdStr)) {
    const existing = activeSimulations.get(routeIdStr);
    if (route.polyline && route.polyline.length >= 2) {
      existing.polyline = route.polyline;
      existing.totalDistM = totalPolylineLength(route.polyline);
    }
    return;
  }

  try {
    const polyline = await ensureRoutePolyline(route);
    if (!polyline || polyline.length < 2) {
      logger.info(`[Simulation] Route "${route.name}" has no valid polyline or < 2 stops yet. Waiting for stops...`);
      return;
    }

    const totalDistM = totalPolylineLength(polyline);
    if (totalDistM < 10) {
      return;
    }

    const [simDriver, simBus] = await Promise.all([
      getOrCreateSimDriver(),
      getOrCreateSimBus(route),
    ]);

    // Check for existing active trip or create new one
    let trip = await Trip.findOne({
      busId: simBus._id,
      routeId: route._id,
      status: 'active',
    });

    if (!trip) {
      trip = await Trip.create({
        busId: simBus._id,
        driverId: simDriver._id,
        routeId: route._id,
        status: 'active',
        startedAt: new Date(),
        driverSnapshot: {
          name: simBus.driver?.name || 'Simulation Pilot',
          phone: simBus.driver?.phone || '',
          license: simBus.driver?.license || '',
        },
      });

      await Bus.findByIdAndUpdate(simBus._id, {
        status: 'on_trip',
        currentTripId: trip._id,
        currentRouteId: route._id,
      });
    }

    // Spread starting positions across multiple routes
    const initialOffset = (activeSimulations.size * 250) % totalDistM;

    const runner = {
      routeId: routeIdStr,
      routeName: route.name,
      busId: simBus._id.toString(),
      tripId: trip._id.toString(),
      busName: simBus.name,
      plateNo: simBus.plateNo,
      capacity: simBus.capacity,
      polyline,
      totalDistM,
      currentDistM: initialOffset,
      direction: 1, // 1 forward, -1 reverse (for non-loop)
      isLoop: Boolean(route.isLoop),
      stepCount: Math.floor(Math.random() * 100),
      timer: null,
    };

    const TICK_MS = 3000; // Update position every 3 seconds

    runner.timer = setInterval(async () => {
      try {
        runner.stepCount++;

        // Smooth speed fluctuation between 22 km/h and 34 km/h
        const baseSpeed = 28;
        const speedKmh = Math.max(15, Math.min(45, baseSpeed + Math.sin(runner.stepCount * 0.15) * 6));
        const speedMs = (speedKmh * 1000) / 3600;
        const stepDistM = speedMs * (TICK_MS / 1000);

        if (runner.isLoop) {
          runner.currentDistM = (runner.currentDistM + stepDistM) % runner.totalDistM;
        } else {
          runner.currentDistM += stepDistM * runner.direction;
          if (runner.currentDistM >= runner.totalDistM) {
            runner.currentDistM = runner.totalDistM;
            runner.direction = -1; // turnaround
          } else if (runner.currentDistM <= 0) {
            runner.currentDistM = 0;
            runner.direction = 1; // forward
          }
        }

        const pos = interpolatePolyline(runner.polyline, runner.currentDistM, runner.direction);

        const busLive = {
          busId: runner.busId,
          busName: runner.busName,
          plateNo: runner.plateNo,
          capacity: runner.capacity,
          tripId: runner.tripId,
          routeId: runner.routeId,
          lat: pos.lat,
          lng: pos.lng,
          heading: Math.round(pos.heading),
          speedKmh: Math.round(speedKmh),
          nextStopIndex: trip.nextStopIndex || 0,
          startTime: trip.startedAt,
          updatedAt: new Date(),
        };

        // 1. Update in-memory state
        updateBus(runner.tripId, busLive);

        // 2. Broadcast live coordinates
        io.to(`route:${runner.routeId}`).emit('bus:update', busLive);
        io.to(`bus:${runner.busId}`).emit('bus:update', busLive);

        // 3. Compute and emit ETAs every 2 ticks (~6 seconds)
        if (runner.stepCount % 2 === 0) {
          try {
            const populatedRoute = await Route.findById(runner.routeId).populate('stops.stopId', 'name code location');
            if (populatedRoute && populatedRoute.stops?.length > 0) {
              const currentTripDoc = await Trip.findById(runner.tripId);
              if (currentTripDoc) {
                const etas = computeETAs(busLive, populatedRoute, currentTripDoc);
                await advanceNextStop(currentTripDoc, populatedRoute, busLive);
                io.to(`route:${runner.routeId}`).emit('eta:update', {
                  routeId: runner.routeId,
                  tripId: runner.tripId,
                  etas,
                });
              }
            }
          } catch (etaErr) {
            // non-fatal
          }
        }
      } catch (tickErr) {
        logger.error(`[Simulation Tick Error on ${runner.routeName}]:`, tickErr.message);
      }
    }, TICK_MS);

    activeSimulations.set(routeIdStr, runner);
    logger.info(`[Simulation] ✅ Active bus started on "${route.name}" (${runner.plateNo})`);
  } catch (err) {
    logger.error(`[Simulation] Failed to start simulation for route ${route.name}:`, err.message);
  }
}

/**
 * Stop a specific route simulation runner.
 */
async function stopRouteRunner(routeIdStr) {
  const runner = activeSimulations.get(routeIdStr);
  if (!runner) return;

  clearInterval(runner.timer);
  activeSimulations.delete(routeIdStr);
  removeBus(runner.tripId);

  try {
    await Trip.findByIdAndUpdate(runner.tripId, { status: 'completed', endedAt: new Date() });
    await Bus.findByIdAndUpdate(runner.busId, { status: 'idle', currentTripId: null, currentRouteId: null });
    if (ioInstance) {
      ioInstance.to(`route:${routeIdStr}`).emit('bus:offline', { tripId: runner.tripId, busId: runner.busId });
    }
  } catch (err) {
    logger.warn(`[Simulation] Cleanup error for route ${routeIdStr}:`, err.message);
  }

  logger.info(`[Simulation] Stopped simulation for route ${runner.routeName}`);
}

/**
 * Synchronize simulation runners with all active routes in MongoDB.
 * Starts runners for new routes, and stops runners for removed/inactive routes.
 */
export async function syncRoutesSimulation(io = ioInstance) {
  if (!io) return;
  ioInstance = io;

  try {
    const activeRoutes = await Route.find({ isActive: true });
    const currentActiveRouteIds = new Set(activeRoutes.map(r => r._id.toString()));

    // 1. Start simulation for any new or unsimulated routes
    for (const route of activeRoutes) {
      if (!activeSimulations.has(route._id.toString())) {
        await startRouteRunner(route, io);
      }
    }

    // 2. Stop simulation for deleted or deactivated routes
    for (const [runningRouteId] of activeSimulations) {
      if (!currentActiveRouteIds.has(runningRouteId)) {
        await stopRouteRunner(runningRouteId);
      }
    }
  } catch (err) {
    logger.error('[Simulation] Sync error:', err.message);
  }
}

/**
 * Immediately trigger simulation for a single route (e.g. after create or build-polyline).
 */
export async function triggerRouteSimulation(routeId, io = ioInstance) {
  if (!io) return;
  ioInstance = io;
  try {
    const route = await Route.findById(routeId);
    if (route && route.isActive) {
      // If already running, refresh its runner with new polyline
      if (activeSimulations.has(route._id.toString())) {
        await stopRouteRunner(route._id.toString());
      }
      await startRouteRunner(route, io);
    } else {
      // If route was deleted or made inactive, stop runner if running
      const idStr = routeId?.toString();
      if (idStr && activeSimulations.has(idStr)) {
        await stopRouteRunner(idStr);
      }
    }
  } catch (err) {
    logger.error(`[Simulation] Trigger error for route ${routeId}:`, err.message);
  }
}

/**
 * Initialize auto-simulation on server bootstrap.
 */
export async function startAutoSimulation(io) {
  if (env.AUTO_SIMULATION === false) {
    logger.info('[Simulation] Auto-simulation disabled via environment (AUTO_SIMULATION=false).');
    return;
  }

  ioInstance = io;
  logger.info('[Simulation] 🚀 Initializing multi-route auto-simulation service...');

  // Initial sync
  await syncRoutesSimulation(io);

  // Periodic sync every 10 seconds to catch newly added routes, updated polylines, or DB changes
  if (syncIntervalTimer) clearInterval(syncIntervalTimer);
  syncIntervalTimer = setInterval(() => {
    syncRoutesSimulation(ioInstance).catch(err => {
      logger.error('[Simulation] Periodic sync error:', err.message);
    });
  }, 10000);
}

/**
 * Graceful shutdown.
 */
export function stopAutoSimulation() {
  if (syncIntervalTimer) {
    clearInterval(syncIntervalTimer);
    syncIntervalTimer = null;
  }

  for (const [routeIdStr, runner] of activeSimulations) {
    clearInterval(runner.timer);
    removeBus(runner.tripId);
  }
  activeSimulations.clear();
  logger.info('[Simulation] All auto-simulations stopped.');
}
