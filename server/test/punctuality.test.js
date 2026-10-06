import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRating } from '../src/services/punctuality.service.js';
import { advanceNextStop } from '../src/services/eta.service.js';

test('calculateRating returns null for sample sizes < 10', () => {
  const samples9 = Array.from({ length: 9 }, () => ({ delayMin: 0 }));
  const res = calculateRating(samples9, 3);
  assert.equal(res.rating, null, 'Rating should be null when samples < 10');
  assert.equal(res.onTimePct, null, 'onTimePct should be null when samples < 10');
  assert.equal(res.sampleSize, 9);

  const samples0 = [];
  const res0 = calculateRating(samples0, 3);
  assert.equal(res0.rating, null);
  assert.equal(res0.sampleSize, 0);
});

test('calculateRating respects on-time tolerance boundaries (-2 to tolerance)', () => {
  const tolerance = 3;

  // 10 records:
  // - delayMin: -2 -> on time
  // - delayMin: 0  -> on time
  // - delayMin: 1  -> on time
  // - delayMin: 3  -> on time (at tolerance)
  // - delayMin: -1 -> on time
  // - delayMin: -3 -> early (NOT on time)
  // - delayMin: -4 -> early (NOT on time)
  // - delayMin: 4  -> late (NOT on time)
  // - delayMin: 5  -> late (NOT on time)
  // - delayMin: 6  -> late (NOT on time)
  // On time: 5 out of 10 = 50%
  const records = [
    { delayMin: -2 },
    { delayMin: 0 },
    { delayMin: 1 },
    { delayMin: 3 },
    { delayMin: -1 },
    { delayMin: -3 }, // early
    { delayMin: -4 }, // early
    { delayMin: 4 },  // late
    { delayMin: 5 },  // late
    { delayMin: 6 },  // late
  ];

  const result = calculateRating(records, tolerance);
  assert.equal(result.sampleSize, 10);
  assert.equal(result.onTimePct, 50);
  assert.equal(result.rating, 2.5); // 0.50 * 5 = 2.5 stars
});

test('calculateRating rounds stars in half-star increments', () => {
  // 17 on-time out of 20 = 85% -> 0.85 * 5 = 4.25 -> 4.5 stars
  const records85 = [
    ...Array.from({ length: 17 }, () => ({ delayMin: 1 })),
    ...Array.from({ length: 3 }, () => ({ delayMin: 6 })),
  ];
  const res85 = calculateRating(records85, 3);
  assert.equal(res85.onTimePct, 85);
  assert.equal(res85.rating, 4.5);

  // 16 on-time out of 20 = 80% -> 0.80 * 5 = 4.0 stars
  const records80 = [
    ...Array.from({ length: 16 }, () => ({ delayMin: 0 })),
    ...Array.from({ length: 4 }, () => ({ delayMin: 8 })),
  ];
  const res80 = calculateRating(records80, 3);
  assert.equal(res80.onTimePct, 80);
  assert.equal(res80.rating, 4.0);

  // 14 on-time out of 20 = 70% -> 0.70 * 5 = 3.5 stars
  const records70 = [
    ...Array.from({ length: 14 }, () => ({ delayMin: 2 })),
    ...Array.from({ length: 6 }, () => ({ delayMin: 7 })),
  ];
  const res70 = calculateRating(records70, 3);
  assert.equal(res70.onTimePct, 70);
  assert.equal(res70.rating, 3.5);
});

test('advanceNextStop advances nextStopIndex when bus reaches next stop', async () => {
  let saved = false;
  const trip = {
    _id: 'trip-test-1',
    busId: 'bus-test-1',
    nextStopIndex: 0,
    scheduledStartAt: null, // skip DB log for unit test
    save: async () => { saved = true; },
  };

  const route = {
    _id: 'route-test-1',
    stops: [
      {
        stopId: {
          _id: 'stop-1',
          name: 'Gate 1',
          location: { coordinates: [77.2000, 28.6100] },
        },
        order: 0,
        dwellSec: 30,
        scheduledOffsetMin: 0,
      },
      {
        stopId: {
          _id: 'stop-2',
          name: 'Gate 2',
          location: { coordinates: [77.2050, 28.6150] },
        },
        order: 1,
        dwellSec: 30,
        scheduledOffsetMin: 5,
      },
    ],
  };

  // Bus right at stop 0 coordinates
  const busLive = {
    lat: 28.6100,
    lng: 77.2000,
  };

  const advanced = await advanceNextStop(trip, route, busLive);
  assert.equal(advanced, true);
  assert.equal(trip.nextStopIndex, 1);
  assert.equal(saved, true);
});
