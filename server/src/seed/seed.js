/**
 * Seed script: Creates demo data for development.
 * Run with: npm run seed
 *
 * Creates:
 * - 1 admin, 2 drivers, 1 student
 * - 3 buses (assigned to drivers)
 * - 5 stops for Route A, 5 stops for Route B
 * - 2 routes with polylines (straight-line approximation)
 * - 1 event with shuttle route
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

import { User } from '../models/User.js';
import { Bus } from '../models/Bus.js';
import { Stop } from '../models/Stop.js';
import { Route } from '../models/Route.js';
import { Event } from '../models/Event.js';
import { StopArrival } from '../models/StopArrival.js';
import { Trip } from '../models/Trip.js';
import { Announcement } from '../models/Announcement.js';
import { LocationPing } from '../models/LocationPing.js';
import { computeCumDist, buildPolylineOSRM } from '../utils/geo.js';
import { precomputeRouteDists } from '../services/eta.service.js';

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bus-tracker');
  console.log('Connected to MongoDB');
}

async function clearAll() {
  await Promise.all([
    User.deleteMany({}),
    Bus.deleteMany({}),
    Stop.deleteMany({}),
    Route.deleteMany({}),
    Event.deleteMany({}),
    Trip.deleteMany({}),
    Announcement.deleteMany({}),
    LocationPing.deleteMany({}),
  ]);
  console.log('Cleared all collections');
}

async function seed() {
  await connectDB();
  await clearAll();

  // --- Users ---
  const hash = pwd => bcrypt.hash(pwd, 10);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@campus.edu',
    passwordHash: await hash('admin123'),
    role: 'admin',
  });

  const driver1 = await User.create({
    name: 'Raj Kumar',
    email: 'driver1@campus.edu',
    passwordHash: await hash('driver123'),
    role: 'driver',
  });

  const driver2 = await User.create({
    name: 'Priya Singh',
    email: 'driver2@campus.edu',
    passwordHash: await hash('driver123'),
    role: 'driver',
  });

  const student = await User.create({
    name: 'Test Student',
    email: 'student@campus.edu',
    passwordHash: await hash('student123'),
    role: 'student',
  });

  console.log('✅ Users created');

  // --- Buses ---
  const bus1 = await Bus.create({
    plateNo: 'KA01AB1234',
    name: 'Campus Express 1',
    capacity: 45,
    driver: {
      name: 'Rahul Sharma',
      phone: '+919876543210',
      license: 'DL-04-2018-0012',
    },
  });
  const bus2 = await Bus.create({
    plateNo: 'KA01AB5678',
    name: 'Campus Express 2',
    capacity: 40,
    driver: {
      name: 'Priya Singh',
      phone: '+919876543211',
      license: 'DL-04-2019-0034',
    },
  });
  const bus3 = await Bus.create({
    plateNo: 'KA01AB9012',
    name: 'Event Shuttle',
    capacity: 30,
    driver: {
      name: 'Anil Verma',
      phone: '+919876543212',
      license: 'DL-04-2020-0056',
    },
  });

  // Assign buses to drivers
  await User.findByIdAndUpdate(driver1._id, { assignedBus: bus1._id });
  await User.findByIdAndUpdate(driver2._id, { assignedBus: bus2._id });

  console.log('✅ Buses created with driver details');

  // --- Stops for Route A (campus loop - Bangalore area approximation) ---
  const stopsA = await Stop.insertMany([
    { name: 'Main Gate', code: 'MG', location: { type: 'Point', coordinates: [77.5800, 12.9716] }, isEventStop: false },
    { name: 'Admin Block', code: 'AB', location: { type: 'Point', coordinates: [77.5820, 12.9730] }, isEventStop: false },
    { name: 'Library', code: 'LIB', location: { type: 'Point', coordinates: [77.5840, 12.9745] }, isEventStop: false },
    { name: 'Hostel A', code: 'HA', location: { type: 'Point', coordinates: [77.5860, 12.9760] }, isEventStop: false },
    { name: 'Sports Complex', code: 'SC', location: { type: 'Point', coordinates: [77.5880, 12.9775] }, isEventStop: false },
  ]);

  // --- Stops for Route B ---
  const stopsB = await Stop.insertMany([
    { name: 'South Gate', code: 'SG', location: { type: 'Point', coordinates: [77.5790, 12.9700] }, isEventStop: false },
    { name: 'Engineering Block', code: 'EB', location: { type: 'Point', coordinates: [77.5810, 12.9710] }, isEventStop: false },
    { name: 'Cafeteria', code: 'CAF', location: { type: 'Point', coordinates: [77.5830, 12.9720] }, isEventStop: false },
    { name: 'Medical Center', code: 'MC', location: { type: 'Point', coordinates: [77.5850, 12.9735] }, isEventStop: false },
    { name: 'Parking Lot', code: 'PL', location: { type: 'Point', coordinates: [77.5870, 12.9750] }, isEventStop: false },
  ]);

  // --- Event stop ---
  const [eventStop] = await Stop.insertMany([
    { name: 'Auditorium', code: 'AUD', location: { type: 'Point', coordinates: [77.5855, 12.9740] }, isEventStop: true },
  ]);

  console.log('✅ Stops created');

  // --- Build polyline from stops along road network via OSRM ---
  async function generateRoadPolyline(stops) {
    const coords = stops.map(s => s.location.coordinates); // [[lng, lat], ...]
    const osrmUrl = process.env.OSRM_URL || 'https://router.project-osrm.org';
    try {
      console.log(`Routing ${stops.length} stops along roads via OSRM...`);
      const { polyline, cumDist } = await buildPolylineOSRM(coords, osrmUrl);
      console.log(`   ✅ Snapped to roads: ${polyline.length} geometry points (distance: ${Math.round(cumDist[cumDist.length - 1])}m)`);
      return { polyline, cumDist };
    } catch (err) {
      console.warn(`   ⚠️ OSRM fallback: ${err.message}`);
      const polyline = stops.map(s => [s.location.coordinates[1], s.location.coordinates[0]]);
      const cumDist = computeCumDist(polyline);
      return { polyline, cumDist };
    }
  }

  // --- Route A ---
  const { polyline: polyA, cumDist: cumA } = await generateRoadPolyline(stopsA);
  const routeA = await Route.create({
    name: 'Campus Loop A',
    color: '#3B82F6',
    type: 'regular',
    stops: stopsA.map((s, i) => ({
      stopId: s._id,
      order: i,
      dwellSec: 30,
      scheduledOffsetMin: i * 5,
    })),
    polyline: polyA,
    polylineCumDistM: cumA,
    schedule: {
      days: [1, 2, 3, 4, 5], // Mon-Fri
      startTimes: ['07:30', '08:15', '09:00', '13:00', '17:00'],
    },
    isActive: true,
  });
  await precomputeRouteDists(routeA);

  // --- Route B ---
  const { polyline: polyB, cumDist: cumB } = await generateRoadPolyline(stopsB);
  const routeB = await Route.create({
    name: 'Campus Loop B',
    color: '#10B981',
    type: 'regular',
    stops: stopsB.map((s, i) => ({
      stopId: s._id,
      order: i,
      dwellSec: 30,
      scheduledOffsetMin: i * 6,
    })),
    polyline: polyB,
    polylineCumDistM: cumB,
    schedule: {
      days: [1, 2, 3, 4, 5],
      startTimes: ['07:45', '08:30', '09:15', '13:15', '17:15'],
    },
    isActive: true,
  });
  await precomputeRouteDists(routeB);

  // --- Event shuttle route ---
  const shuttleStops = [stopsA[0], eventStop]; // Main Gate → Auditorium
  const { polyline: polySh, cumDist: cumSh } = await generateRoadPolyline(shuttleStops);

  const shuttleRoute = await Route.create({
    name: 'Fest Shuttle',
    color: '#F59E0B',
    type: 'event',
    stops: shuttleStops.map((s, i) => ({
      stopId: s._id,
      order: i,
      dwellSec: 60,
      scheduledOffsetMin: i * 10,
    })),
    polyline: polySh,
    polylineCumDistM: cumSh,
    isActive: true,
  });
  await precomputeRouteDists(shuttleRoute);

  console.log('✅ Routes created with road-following polylines');

  // Assign default routes to buses
  await Bus.findByIdAndUpdate(bus1._id, { defaultRouteId: routeA._id, currentRouteId: routeA._id });
  await Bus.findByIdAndUpdate(bus2._id, { defaultRouteId: routeB._id, currentRouteId: routeB._id });
  await Bus.findByIdAndUpdate(bus3._id, { defaultRouteId: shuttleRoute._id, currentRouteId: shuttleRoute._id });

  // Assign routes to drivers
  await User.findByIdAndUpdate(driver1._id, { assignedRoute: routeA._id });
  await User.findByIdAndUpdate(driver2._id, { assignedRoute: routeB._id });

  // --- Event ---
  const now = new Date();
  const eventStart = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h from now
  const eventEnd = new Date(now.getTime() + 8 * 60 * 60 * 1000);   // 8h from now

  const event = await Event.create({
    title: 'Tech Fest 2026',
    description: 'Annual technology festival with workshops, hackathons, and performances.',
    venueName: 'Campus Auditorium',
    venueLocation: { type: 'Point', coordinates: [77.5855, 12.9740] },
    startsAt: eventStart,
    endsAt: eventEnd,
    shuttleWindow: {
      from: new Date(eventStart.getTime() - 30 * 60 * 1000), // 30min before
      until: new Date(eventEnd.getTime() + 30 * 60 * 1000),   // 30min after
    },
    routeIds: [shuttleRoute._id],
    isPublished: true,
  });

  // Update event stop with event reference
  await Stop.findByIdAndUpdate(eventStop._id, { eventId: event._id });

  // Enable event mode on shuttle route
  shuttleRoute.eventMode = {
    enabled: true,
    eventId: event._id,
    headwayMin: 15,
    activeFrom: new Date(eventStart.getTime() - 30 * 60 * 1000),
    activeUntil: new Date(eventEnd.getTime() + 30 * 60 * 1000),
  };
  await shuttleRoute.save();

  console.log('✅ Event created');

  // --- Seed ~40 Historical Punctuality Records per Demo Bus ---
  const punctualityRecords = [];
  const busesForHistory = [
    { bus: bus1, route: routeA, stops: stopsA, onTimeRate: 0.85 },
    { bus: bus2, route: routeB, stops: stopsB, onTimeRate: 0.72 },
    { bus: bus3, route: shuttleRoute, stops: shuttleStops, onTimeRate: 0.90 },
  ];

  for (const { bus, route, stops, onTimeRate } of busesForHistory) {
    for (let i = 0; i < 40; i++) {
      const daysAgo = Math.floor(i / 2);
      const hour = 8 + (i % 6);
      const scheduledAt = new Date(Date.now() - (daysAgo * 24 * 60 + hour * 60) * 60 * 1000);

      const rand = Math.random();
      let delayMin;
      if (rand < onTimeRate) {
        delayMin = Math.floor(Math.random() * 5) - 2; // -2 to +2 (on time)
      } else if (rand < onTimeRate + 0.15) {
        delayMin = Math.floor(Math.random() * 7) + 4; // +4 to +10 (late)
      } else {
        delayMin = -Math.floor(Math.random() * 3) - 3; // -3 to -5 (early)
      }

      const actualAt = new Date(scheduledAt.getTime() + delayMin * 60 * 1000);
      const stop = stops[i % stops.length];

      punctualityRecords.push({
        tripId: new mongoose.Types.ObjectId(),
        busId: bus._id,
        routeId: route._id,
        stopId: stop._id,
        kind: i % 5 === 0 ? 'departure' : 'arrival',
        scheduledAt,
        actualAt,
        delayMin,
        createdAt: actualAt,
      });
    }
  }

  await StopArrival.deleteMany({});
  await StopArrival.insertMany(punctualityRecords);
  console.log(`✅ Seeded ${punctualityRecords.length} historical punctuality arrivals for demo buses`);

  // --- Summary ---
  console.log('\n🎉 Seed complete!');
  console.log('='.repeat(50));
  console.log('👤 Admin:   admin@campus.edu    / admin123');
  console.log('🚗 Driver1: driver1@campus.edu  / driver123');
  console.log('🚗 Driver2: driver2@campus.edu  / driver123');
  console.log('🎓 Student: student@campus.edu  / student123');
  console.log('='.repeat(50));
  console.log(`📍 Routes: ${routeA.name} (${stopsA.length} stops), ${routeB.name} (${stopsB.length} stops)`);
  console.log(`🎪 Event:  ${event.title}`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
