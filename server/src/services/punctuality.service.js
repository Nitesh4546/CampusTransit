import { StopArrival } from '../models/StopArrival.js';
import { env } from '../config/env.js';

/**
 * Pure calculation function for punctuality rating.
 * @param {Array<{ delayMin: number }>} records
 * @param {number} tolerance - On-time tolerance in minutes (default 3)
 */
export function calculateRating(records, tolerance = (env.ON_TIME_TOLERANCE_MIN ?? 3)) {
  if (!records || records.length < 10) {
    const total = records ? records.length : 0;
    const avgDelayMin = total > 0
      ? Math.round((records.reduce((acc, r) => acc + (r.delayMin || 0), 0) / total) * 10) / 10
      : 0;

    return {
      rating: null,
      onTimePct: null,
      avgDelayMin,
      sampleSize: total,
    };
  }

  // Up to 100 most recent records
  const sample = records.slice(0, 100);
  const total = sample.length;

  // On time definition: -2 <= delayMin <= tolerance
  const onTimeCount = sample.filter(
    (r) => r.delayMin >= -2 && r.delayMin <= tolerance
  ).length;

  const onTimePct = Math.round((onTimeCount / total) * 100);
  // Round to half-star steps: round(onTimePct * 5 * 2) / 2 where onTimePct is fraction
  const stars = Math.round((onTimeCount / total) * 5 * 2) / 2;

  const sumDelay = sample.reduce((acc, r) => acc + (r.delayMin || 0), 0);
  const avgDelayMin = Math.round((sumDelay / total) * 10) / 10;

  return {
    rating: stars,
    onTimePct,
    avgDelayMin,
    sampleSize: total,
  };
}

/**
 * Fetch detailed stats and recent arrivals for a single bus.
 */
export async function getBusStats(busId, tolerance = (env.ON_TIME_TOLERANCE_MIN ?? 3)) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const records = await StopArrival.find({
    busId,
    createdAt: { $gte: thirtyDaysAgo },
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('stopId', 'name code');

  const stats = calculateRating(records, tolerance);

  const recent = records.slice(0, 10).map((r) => ({
    _id: r._id,
    stopName: r.stopId?.name || 'Unknown Stop',
    stopCode: r.stopId?.code || '',
    kind: r.kind,
    scheduledAt: r.scheduledAt,
    actualAt: r.actualAt,
    delayMin: r.delayMin,
    createdAt: r.createdAt,
  }));

  return {
    ...stats,
    recent,
  };
}

/**
 * Single aggregation to fetch rating and onTimePct for all buses without N+1.
 */
export async function getFleetPunctuality(busIds, tolerance = (env.ON_TIME_TOLERANCE_MIN ?? 3)) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const matchFilter = { createdAt: { $gte: thirtyDaysAgo } };
  if (busIds && busIds.length > 0) {
    matchFilter.busId = { $in: busIds };
  }

  const aggregated = await StopArrival.aggregate([
    { $match: matchFilter },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$busId',
        records: {
          $push: {
            delayMin: '$delayMin',
          },
        },
      },
    },
    {
      $project: {
        records: { $slice: ['$records', 100] },
      },
    },
  ]);

  const map = new Map();
  for (const item of aggregated) {
    const stats = calculateRating(item.records, tolerance);
    map.set(item._id.toString(), {
      rating: stats.rating,
      onTimePct: stats.onTimePct,
    });
  }

  return map;
}
