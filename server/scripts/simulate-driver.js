/**
 * Driver Simulator — replays GPS pings along a route polyline.
 *
 * Usage:
 *   node scripts/simulate-driver.js [--route <routeName>] [--slow] [--driver <email>] [--password <pwd>]
 *
 * Flags:
 *   --slow        Simulate delay (speed reduced to 5 km/h around the middle of the route)
 *   --route       Route name prefix to match (default: "Campus Loop A")
 *   --driver      Driver email (default: driver1@campus.edu)
 *   --password    Driver password (default: driver123)
 */

import { io as socketIO } from 'socket.io-client';
import fetch from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { setTimeout as sleep } from 'timers/promises';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const API_URL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const SOCKET_URL = `http://localhost:${process.env.PORT || 5000}`;

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};
const hasFlag = flag => args.includes(flag);

const SLOW_MODE = hasFlag('--slow');
const ROUTE_NAME = getArg('--route') || 'Campus Loop A';
const DRIVER_EMAIL = getArg('--driver') || 'driver1@campus.edu';
const DRIVER_PASSWORD = getArg('--password') || 'driver123';

const INTERVAL_MS = 4000; // send GPS every 4s
const STEP_DIST_M = 50;   // move ~50m per step

// --- HTTP helper ---
async function apiFetch(path, opts = {}) {
  const url = `${API_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await globalThis.fetch(url, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ? `${data.error.message || 'Error'}: ${JSON.stringify(data.error.details || data.error)}` : `HTTP ${res.status}`);
  return data;
}

// --- Haversine ---
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// --- Interpolate position along polyline ---
function interpolatePolyline(polyline, targetDistM) {
  let accumulated = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLat, aLng] = polyline[i];
    const [bLat, bLng] = polyline[i + 1];
    const segLen = haversineM(aLat, aLng, bLat, bLng);
    if (accumulated + segLen >= targetDistM) {
      const t = (targetDistM - accumulated) / segLen;
      const lat = aLat + t * (bLat - aLat);
      const lng = aLng + t * (bLng - aLng);
      const heading = Math.atan2(bLng - aLng, bLat - aLat) * (180 / Math.PI);
      return { lat, lng, heading: (heading + 360) % 360 };
    }
    accumulated += segLen;
  }
  const last = polyline[polyline.length - 1];
  return { lat: last[0], lng: last[1], heading: 0 };
}

function totalPolylineLength(polyline) {
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    total += haversineM(polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1]);
  }
  return total;
}

async function main() {
  console.log(`\n🚌 Live Bus Tracker — Driver Simulator`);
  console.log(`   Route: ${ROUTE_NAME}`);
  console.log(`   Driver: ${DRIVER_EMAIL}`);
  console.log(`   Slow mode: ${SLOW_MODE ? 'YES (forcing delay)' : 'no'}`);
  console.log(`   API: ${API_URL}\n`);

  // 1. Login
  console.log('🔐 Logging in...');
  const { token, user } = await apiFetch('/auth/login', {
    method: 'POST',
    body: { email: DRIVER_EMAIL, password: DRIVER_PASSWORD },
  });
  console.log(`   Logged in as ${user.name} (${user.role})`);

  // 2. Fetch routes
  const routes = await apiFetch('/routes');
  let route = null;
  const requestedRoute = getArg('--route');
  if (requestedRoute) {
    route = routes.find(r => r.name.toLowerCase().includes(requestedRoute.toLowerCase()));
  } else if (user.assignedRoute) {
    const assignedRouteId = user.assignedRoute?._id || user.assignedRoute;
    route = routes.find(r => r._id === assignedRouteId);
  }
  if (!route) {
    route = routes.find(r => r.name.startsWith(ROUTE_NAME)) || routes[0];
  }
  if (!route) {
    console.error(`❌ Route not found. Available: ${routes.map(r => r.name).join(', ')}`);
    process.exit(1);
  }
  console.log(`📍 Assigned Route: ${route.name} (${route.polyline?.length || 0} polyline points)`);

  // 3. Find an idle bus for this driver
  const assignedBusId = user.assignedBus?._id || user.assignedBus;
  if (!assignedBusId) {
    console.error('❌ Driver has no assigned bus. Assign one via admin.');
    process.exit(1);
  }

  // 3.5. Upload driver photo
  console.log('📸 Uploading driver photo...');
  let photoId = null;
  try {
    const photoPath = join(dirname(fileURLToPath(import.meta.url)), 'assets/sample-driver.jpg');
    const photoBuf = await fs.promises.readFile(photoPath);
    const formData = new FormData();
    formData.append('photo', new Blob([photoBuf], { type: 'image/jpeg' }), 'sample-driver.jpg');

    const photoRes = await globalThis.fetch(`${API_URL}/driver/photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const photoJson = await photoRes.json();
    if (photoRes.ok && photoJson.photoId) {
      photoId = photoJson.photoId;
      console.log(`   Photo uploaded: ${photoId}`);
    } else {
      console.warn(`   Photo upload response:`, photoJson);
    }
  } catch (err) {
    console.warn(`   Could not upload photo: ${err.message}`);
  }

  // 4. Start trip (or resume active trip if interrupted)
  console.log(`🚦 Starting trip...`);
  let trip = null;
  try {
    trip = await apiFetch('/trips/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        busId: assignedBusId,
        routeId: route._id,
        photoId: photoId || undefined,
        scheduledStartAt: new Date().toISOString(),
      },
    });
    console.log(`   Trip started: ${trip._id}`);
  } catch (err) {
    if (err.message && err.message.includes('TRIP_ALREADY_ACTIVE')) {
      console.log('   ℹ️ Bus already has an active trip, reconnecting to it...');
      const activeTrips = await apiFetch('/trips/active');
      const found = activeTrips.find(t => (t.busId?._id || t.busId)?.toString() === assignedBusId.toString() && t.status === 'active');
      if (found) {
        trip = found;
        console.log(`   Reconnected to active trip: ${trip._id}`);
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  // 5. Connect socket
  const socket = socketIO(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log(`🔌 Socket connected: ${socket.id}`);
      socket.emit('driver:join', { tripId: trip._id });
      resolve();
    });
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Socket connection timeout')), 10000);
  });

  socket.on('bus:update', () => process.stdout.write('.'));
  socket.on('eta:update', (data) => {
    const nextEta = data.etas?.[0];
    if (nextEta) {
      process.stdout.write(` [ETA ${nextEta.stopName}: ${nextEta.etaMin}min]`);
    }
  });
  socket.on('announcement:new', (ann) => {
    console.log(`\n📢 ANNOUNCEMENT: ${ann.textShort || ann.text}`);
  });

  // Handle Ctrl+C clean shutdown
  const handleShutdown = async () => {
    console.log('\n\n🛑 Stopping simulator and ending trip...');
    try {
      await apiFetch(`/trips/${trip._id}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('✅ Trip ended cleanly.');
    } catch (_) {}
    socket.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  // 6. Simulate movement
  const polyline = route.polyline;
  if (!polyline?.length) {
    console.error('❌ Route has no polyline. Run build-polyline first or re-seed.');
    process.exit(1);
  }

  const totalLen = totalPolylineLength(polyline);
  const isOnce = hasFlag('--once');
  console.log(`\n🗺️  Total route length: ${Math.round(totalLen)}m`);
  console.log(`   Simulating movement (${INTERVAL_MS / 1000}s intervals, ${STEP_DIST_M}m/step)${isOnce ? '' : ' [continuous loop]'}`);
  console.log(`   Press Ctrl+C at any time to end trip cleanly.\n`);

  let loopCount = 1;
  while (true) {
    let distM = 0;
    let step = 0;
    const midpoint = totalLen / 2;

    while (distM < totalLen) {
      const { lat, lng, heading } = interpolatePolyline(polyline, distM);

      // Simulate slow/delay around midpoint
      let speed = 25; // normal speed km/h
      if (SLOW_MODE && Math.abs(distM - midpoint) < 500) {
        speed = 5; // creeping - will cause delay
        process.stdout.write('🐢');
      }

      socket.emit('driver:location', {
        tripId: trip._id.toString(),
        lat,
        lng,
        speed,
        heading,
        accuracy: 10 + Math.random() * 5,
        ts: Date.now(),
      });

      distM += STEP_DIST_M;
      step++;

      if (step % 10 === 0) {
        console.log(`\n   📍 [Lap ${loopCount}] ${Math.round(distM)}m / ${Math.round(totalLen)}m (${Math.round((distM / totalLen) * 100)}%)`);
      }

      await sleep(INTERVAL_MS);
    }

    // Always send the exact final polyline coordinate.
    const [endLat, endLng] = polyline[polyline.length - 1];
    socket.emit('driver:location', {
      tripId: trip._id.toString(),
      lat: endLat,
      lng: endLng,
      speed: 0,
      heading: 0,
      accuracy: 10,
      ts: Date.now(),
    });

    if (isOnce) {
      console.log(`\n   📍 Reached route endpoint (${endLat.toFixed(6)}, ${endLng.toFixed(6)})`);
      await sleep(4000);
      break;
    }

    loopCount++;
    console.log(`\n🔄 Completed lap, looping route (Lap ${loopCount})...`);
    await sleep(INTERVAL_MS);
  }

  // 7. End trip
  await handleShutdown();
}

main().catch(err => {
  console.error('\n❌ Simulator error:', err.message);
  process.exit(1);
});
