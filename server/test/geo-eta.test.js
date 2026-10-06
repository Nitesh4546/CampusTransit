import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineM, computeCumDist, projectOnPolyline } from '../src/utils/geo.js';
import { computeETAs } from '../src/services/eta.service.js';

test('haversineM calculates accurate distance between two points', () => {
  // New Delhi to nearby point (~1.1 km)
  const lat1 = 28.6139, lng1 = 77.2090;
  const lat2 = 28.6239, lng2 = 77.2090; // ~1.11 km north
  const dist = haversineM(lat1, lng1, lat2, lng2);

  assert.ok(dist > 1050 && dist < 1150, `Distance should be ~1110m, got ${dist}`);
});

test('haversineM between identical points is 0', () => {
  const d = haversineM(28.6139, 77.2090, 28.6139, 77.2090);
  assert.equal(Math.round(d), 0);
});

test('computeCumDist returns monotonically increasing distances', () => {
  const polyline = [
    [28.6100, 77.2000],
    [28.6110, 77.2010],
    [28.6120, 77.2020],
    [28.6130, 77.2030],
  ];
  const cum = computeCumDist(polyline);

  assert.equal(cum.length, polyline.length);
  assert.equal(cum[0], 0);
  assert.ok(cum[1] > 0);
  assert.ok(cum[2] > cum[1]);
  assert.ok(cum[3] > cum[2]);
});

test('projectOnPolyline projects point accurately onto segment', () => {
  const polyline = [
    [28.6100, 77.2000],
    [28.6200, 77.2000],
  ];
  const cumDist = computeCumDist(polyline);

  // Point right in the middle
  const query = [28.6150, 77.2000];
  const proj = projectOnPolyline(query, polyline, cumDist);

  assert.equal(proj.segmentIdx, 0);
  assert.ok(proj.distAlongM > 0);
  assert.ok(proj.perpDistM < 5, `Perpendicular distance should be near 0, got ${proj.perpDistM}`);
});

test('computeETAs calculates ETA to upcoming stops', () => {
  const polyline = [
    [28.6100, 77.2000],
    [28.6150, 77.2000],
    [28.6200, 77.2000],
    [28.6250, 77.2000],
  ];
  const polylineCumDistM = computeCumDist(polyline);

  const route = {
    _id: 'route123',
    polyline,
    polylineCumDistM,
    stops: [
      {
        stopId: { _id: 'stop1', name: 'Stop 1' },
        order: 0,
        dwellSec: 30,
        projectedDistM: polylineCumDistM[1],
        scheduledOffsetMin: 5,
      },
      {
        stopId: { _id: 'stop2', name: 'Stop 2' },
        order: 1,
        dwellSec: 30,
        projectedDistM: polylineCumDistM[3],
        scheduledOffsetMin: 15,
      },
    ],
  };

  const trip = {
    _id: 'trip123',
    nextStopIndex: 0,
    scheduledStartAt: new Date(Date.now() - 2 * 60000), // started 2 min ago
  };

  const busLive = {
    tripId: 'trip123',
    lat: 28.6110,
    lng: 77.2000,
    speedKmh: 30,
  };

  const etas = computeETAs(busLive, route, trip);
  assert.ok(Array.isArray(etas));
  assert.equal(etas.length, 2);
  assert.ok(etas[0].etaMin >= 0);
  assert.ok(etas[1].etaMin > etas[0].etaMin, 'ETA for stop 2 must be greater than stop 1');
});
