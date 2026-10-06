import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io as socketIO } from 'socket.io-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function testAll() {
  console.log('🧪 Starting End-to-End System Tests...\n');

  // 1. Health check
  console.log('1️⃣ Testing GET /api/health...');
  let healthRes;
  try {
    healthRes = await fetch(`${API_BASE}/health`);
  } catch {
    throw new Error(
      'API is not reachable at http://localhost:5000. Start MongoDB, run `npm run seed`, ' +
      'then start the server with `npm start` in another terminal before `npm run test:e2e`.'
    );
  }
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.status, 'ok');
  console.log('   ✅ Health OK');

  // 2. Auth: Admin Login
  console.log('2️⃣ Testing POST /api/auth/login (Admin)...');
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@campus.edu', password: 'admin123' })
  });
  assert.equal(adminLoginRes.status, 200);
  const { token: adminToken, user: adminUser } = await adminLoginRes.json();
  assert.equal(adminUser.role, 'admin');
  console.log(`   ✅ Admin authenticated: ${adminUser.name}`);

  // 3. Auth: Driver Login
  console.log('3️⃣ Testing POST /api/auth/login (Driver)...');
  const driverLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'driver1@campus.edu', password: 'driver123' })
  });
  assert.equal(driverLoginRes.status, 200);
  const { token: driverToken, user: driverUser } = await driverLoginRes.json();
  assert.equal(driverUser.role, 'driver');
  assert.ok(driverUser.assignedBus);
  console.log(`   ✅ Driver authenticated: ${driverUser.name}`);

  // 4. Routes & Stops
  console.log('4️⃣ Testing GET /api/routes and /api/stops...');
  const routesRes = await fetch(`${API_BASE}/routes`);
  const routes = await routesRes.json();
  assert.ok(routes.length >= 2);
  const stopsRes = await fetch(`${API_BASE}/stops`);
  const stops = await stopsRes.json();
  assert.ok(stops.length >= 10);
  console.log(`   ✅ Loaded ${routes.length} routes and ${stops.length} stops`);

  // 5. Events
  console.log('5️⃣ Testing GET /api/events...');
  const eventsRes = await fetch(`${API_BASE}/events`);
  const events = await eventsRes.json();
  assert.ok(events.length >= 1);
  console.log(`   ✅ Loaded ${events.length} event(s): "${events[0].title}"`);

  // 6. Socket.io Handshake
  console.log('6️⃣ Testing Socket.io Connection & Room Subscription...');
  const studentSocket = socketIO(SOCKET_URL, { transports: ['websocket'] });
  
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket timeout')), 5000);
    studentSocket.on('connect', () => {
      clearTimeout(timer);
      console.log(`   ✅ Student Socket connected: ${studentSocket.id}`);
      studentSocket.emit('student:subscribe', { routeIds: [routes[0]._id] });
      resolve();
    });
  });

  // 7. Trip Start & Live GPS Telemetry
  console.log('7️⃣ Testing Trip Lifecycle (Start -> GPS -> ETAs -> End)...');

  // Clean up any leftover active trips from prior test runs
  const activeCheckRes = await fetch(`${API_BASE}/trips/active`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (activeCheckRes.ok) {
    const activeList = await activeCheckRes.json();
    for (const prevTrip of activeList) {
      await fetch(`${API_BASE}/trips/${prevTrip._id}/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${driverToken}` }
      }).catch(() => {});
    }
  }

  // 7a. Trip Start without photo fails with PHOTO_REQUIRED
  console.log('   📸 Testing photo requirement: start without photo must fail...');
  const failTripRes = await fetch(`${API_BASE}/trips/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${driverToken}`
    },
    body: JSON.stringify({
      busId: driverUser.assignedBus,
      routeId: routes[0]._id
    })
  });
  assert.equal(failTripRes.status, 400);
  const failTripBody = await failTripRes.json();
  assert.equal(failTripBody.error?.code, 'PHOTO_REQUIRED');
  console.log('   ✅ Start without photo correctly rejected with PHOTO_REQUIRED');

  // 7b. Upload driver verification photo
  console.log('   📸 Testing driver photo upload (multipart/form-data)...');
  const samplePhotoPath = path.resolve(__dirname, '../scripts/assets/sample-driver.jpg');
  let photoBuffer;
  if (fs.existsSync(samplePhotoPath)) {
    photoBuffer = fs.readFileSync(samplePhotoPath);
  } else {
    photoBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
    ]);
  }

  const formData = new FormData();
  formData.append('photo', new Blob([photoBuffer], { type: 'image/jpeg' }), 'driver.jpg');

  const uploadRes = await fetch(`${API_BASE}/driver/photo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${driverToken}`,
    },
    body: formData,
  });
  assert.equal(uploadRes.status, 201);
  const { photoId } = await uploadRes.json();
  assert.ok(photoId);
  console.log(`   ✅ Driver photo uploaded, photoId: ${photoId}`);

  // 7c. Start trip WITH photoId
  console.log('   🚀 Starting trip with verified photoId...');
  const startTripRes = await fetch(`${API_BASE}/trips/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${driverToken}`
    },
    body: JSON.stringify({
      busId: driverUser.assignedBus,
      routeId: routes[0]._id,
      photoId,
    })
  });
  assert.equal(startTripRes.status, 201);
  const trip = await startTripRes.json();
  console.log(`   ✅ Trip started with photo: ${trip._id}`);

  // 7d. Fetch photo while trip is active
  console.log('   🖼️ Testing GET /api/trips/:id/driver-photo while trip is active...');
  const getPhotoRes = await fetch(`${API_BASE}/trips/${trip._id}/driver-photo`);
  assert.equal(getPhotoRes.status, 200);
  assert.equal(getPhotoRes.headers.get('content-type'), 'image/jpeg');
  assert.ok(getPhotoRes.headers.get('cache-control')?.includes('max-age=300'));
  const fetchedPhotoBlob = await getPhotoRes.arrayBuffer();
  assert.ok(fetchedPhotoBlob.byteLength > 0);
  console.log('   ✅ Driver photo fetched successfully while trip active');

  // 7e. Check public trip payload (privacy: never expose phone or license to students)
  console.log('   🔒 Verifying student privacy: public trip payload contains only name & photoUrl...');
  const activeTripsRes = await fetch(`${API_BASE}/trips/active`);
  assert.equal(activeTripsRes.status, 200);
  const activeTrips = await activeTripsRes.json();
  const currentActiveTrip = activeTrips.find(t => t._id === trip._id);
  assert.ok(currentActiveTrip);
  assert.ok(currentActiveTrip.driver);
  assert.ok(currentActiveTrip.driver.name);
  assert.ok(currentActiveTrip.driver.photoUrl);
  assert.equal(currentActiveTrip.driver.phone, undefined, 'Student payload must NEVER expose driver phone');
  assert.equal(currentActiveTrip.driver.license, undefined, 'Student payload must NEVER expose driver license');
  assert.equal(currentActiveTrip.driverSnapshot, undefined, 'Student payload must not contain driverSnapshot');
  console.log('   ✅ Privacy verified: student payload has name & photoUrl, NO phone or license');

  // Also check admin payload HAS phone and license
  const adminTripsRes = await fetch(`${API_BASE}/trips/active`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminTrips = await adminTripsRes.json();
  const adminActiveTrip = adminTrips.find(t => t._id === trip._id);
  assert.ok(adminActiveTrip.driver?.phone !== undefined);
  assert.ok(adminActiveTrip.driver?.license !== undefined);
  console.log('   ✅ Admin payload includes phone & license');

  // Driver socket sends GPS ping
  const driverSocket = socketIO(SOCKET_URL, {
    auth: { token: driverToken },
    transports: ['websocket']
  });

  await new Promise((resolve) => driverSocket.on('connect', resolve));
  driverSocket.emit('driver:join', { tripId: trip._id });

  // Send a GPS location ping along route
  const startPoint = routes[0].polyline[0];
  driverSocket.emit('driver:location', {
    tripId: trip._id,
    lat: startPoint[0],
    lng: startPoint[1],
    speed: 30,
    heading: 45,
    accuracy: 10,
    ts: Date.now()
  });
  console.log('   📡 Sent telemetry ping via driver socket');

  // Wait 1.5s for ETA calculation
  await new Promise(r => setTimeout(r, 1500));

  const etaRes = await fetch(`${API_BASE}/eta/${routes[0]._id}`);
  const etaData = await etaRes.json();
  assert.ok(etaData.length > 0);
  console.log(`   ✅ Live ETAs calculated: ${etaData[0].etas.length} stops covered`);

  // End trip
  const endTripRes = await fetch(`${API_BASE}/trips/${trip._id}/end`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${driverToken}` }
  });
  assert.equal(endTripRes.status, 200);
  console.log('   ✅ Trip ended successfully');

  // 7f. Verify photo returns 404 after trip ends
  console.log('   🗑️ Verifying driver photo returns 404 after trip ends...');
  const photoAfterEndRes = await fetch(`${API_BASE}/trips/${trip._id}/driver-photo`);
  assert.equal(photoAfterEndRes.status, 404, 'Driver photo must return 404 after trip ends');
  console.log('   ✅ Photo 404 verified: driver photo inaccessible after trip completion');

  studentSocket.disconnect();
  driverSocket.disconnect();

  // 8. Buses: Create Bus with Driver Fields
  console.log('8️⃣ Testing POST /api/buses with driver fields (Admin)...');
  const createBusRes = await fetch(`${API_BASE}/buses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      plateNo: 'KA01E2E999',
      name: 'E2E Test Shuttle',
      capacity: 35,
      driver: {
        name: 'Arjun Das',
        phone: '+919876501234',
        license: 'DL-E2E-2026',
      },
    }),
  });
  assert.equal(createBusRes.status, 201);
  const createdBus = await createBusRes.json();
  assert.equal(createdBus.driver?.name, 'Arjun Das');
  assert.equal(createdBus.driver?.phone, '+919876501234');
  console.log(`   ✅ Bus created with driver: ${createdBus.driver.name} (${createdBus.driver.phone})`);

  // 9. Buses: Fetch Punctuality Stats
  console.log('9️⃣ Testing GET /api/buses/:id/stats...');
  // Check stats for seeded demo bus
  const demoBusesRes = await fetch(`${API_BASE}/buses`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  const demoBuses = await demoBusesRes.json();
  const demoBus = demoBuses[0];

  const statsRes = await fetch(`${API_BASE}/buses/${demoBus._id}/stats`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  assert.equal(statsRes.status, 200);
  const stats = await statsRes.json();
  assert.ok(stats.sampleSize >= 10);
  assert.ok(typeof stats.rating === 'number');
  assert.ok(Array.isArray(stats.recent));
  console.log(`   ✅ Bus stats verified: rating=${stats.rating} stars (${stats.onTimePct}% on time, ${stats.sampleSize} samples)`);

  // Clean up created test bus
  await fetch(`${API_BASE}/buses/${createdBus._id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });

  // 10. Events: Fetch Event with Include (routes, activeBuses)
  console.log('🔟 Testing GET /api/events/:id?include=routes,activeBuses...');
  const eventDetailRes = await fetch(`${API_BASE}/events/${events[0]._id}?include=routes,activeBuses`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  assert.equal(eventDetailRes.status, 200);
  const eventDetail = await eventDetailRes.json();
  assert.ok(eventDetail.event);
  assert.ok(Array.isArray(eventDetail.routes));
  assert.ok(Array.isArray(eventDetail.activeBuses));
  console.log(`   ✅ Event detail verified with ${eventDetail.routes.length} route(s) and ${eventDetail.activeBuses.length} active bus(es)`);

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀');
  process.exit(0);
}

testAll().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
