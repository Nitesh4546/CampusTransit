/**
 * In-memory live state store for active buses.
 * Key: tripId (string), Value: BusLive object
 */

/** @type {Map<string, import('../types.js').BusLive>} */
const liveStateMap = new Map();

/** Offline detection: track last ping time per tripId */
const lastPingTime = new Map();

export function getLiveState() {
  return liveStateMap;
}

export function updateBus(tripId, data) {
  liveStateMap.set(tripId, { ...data, updatedAt: new Date() });
  lastPingTime.set(tripId, Date.now());
}

export function getBus(tripId) {
  return liveStateMap.get(tripId);
}

export function removeBus(tripId) {
  liveStateMap.delete(tripId);
  lastPingTime.delete(tripId);
}

export function getAllBuses() {
  return Array.from(liveStateMap.values());
}

export function getLastPingTime(tripId) {
  return lastPingTime.get(tripId);
}

export function getActiveTripIds() {
  return Array.from(liveStateMap.keys());
}
