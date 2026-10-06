const EARTH_RADIUS_M = 6371000;

/**
 * Compute haversine distance in meters between two lat/lng points.
 */
export function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Compute cumulative distances in meters for each point in a polyline.
 * @param {Array} polyline - [[lat, lng], ...]
 * @returns {number[]} cumulative distance at each point
 */
export function computeCumDist(polyline) {
  const cumDist = [0];
  for (let i = 1; i < polyline.length; i++) {
    const d = haversineM(polyline[i - 1][0], polyline[i - 1][1], polyline[i][0], polyline[i][1]);
    cumDist.push(cumDist[i - 1] + d);
  }
  return cumDist;
}

/**
 * Project a point onto the nearest segment of a polyline.
 * @param {[number, number]} point - [lat, lng]
 * @param {Array} polyline - [[lat, lng], ...]
 * @param {number[]} cumDistM - cumulative dist per polyline point
 * @returns {{ distAlongM, segmentIdx, perpDistM, projLat, projLng }}
 */
export function projectOnPolyline(point, polyline, cumDistM) {
  const [pLat, pLng] = point;
  let bestDistAlong = 0;
  let bestPerp = Infinity;
  let bestSeg = 0;
  let bestProjLat = polyline[0][0];
  let bestProjLng = polyline[0][1];

  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLat, aLng] = polyline[i];
    const [bLat, bLng] = polyline[i + 1];
    const segLen = haversineM(aLat, aLng, bLat, bLng);

    if (segLen < 1) continue;

    // Use linear algebra in flat projection (good enough for short distances)
    const ax = aLng, ay = aLat;
    const bx = bLng, by = bLat;
    const px = pLng, py = pLat;

    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));

    const projX = ax + t * dx;
    const projY = ay + t * dy;

    const perpDist = haversineM(pLat, pLng, projY, projX);

    if (perpDist < bestPerp) {
      bestPerp = perpDist;
      bestSeg = i;
      bestProjLat = projY;
      bestProjLng = projX;

      // Distance along polyline = cumDist[i] + t * segment length
      const partialDist = haversineM(aLat, aLng, projY, projX);
      bestDistAlong = cumDistM[i] + partialDist;
    }
  }

  return {
    distAlongM: bestDistAlong,
    segmentIdx: bestSeg,
    perpDistM: bestPerp,
    projLat: bestProjLat,
    projLng: bestProjLng,
  };
}

/**
 * Build a route polyline via the OSRM routing API.
 * @param {Array} coords - [[lng, lat], ...] (OSRM expects lng,lat)
 * @param {string} osrmUrl - base OSRM URL
 * @returns {{ polyline: [[lat, lng]], cumDist: number[] }}
 */
export async function buildPolylineOSRM(coords, osrmUrl) {
  const coordinateStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `${osrmUrl}/route/v1/driving/${coordinateStr}?overview=full&geometries=geojson`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`);

  const data = await res.json();
  if (!data.routes?.[0]) throw new Error('No route returned from OSRM');

  const geoCoords = data.routes[0].geometry.coordinates; // [[lng, lat], ...]
  const polyline = geoCoords.map(([lng, lat]) => [lat, lng]); // convert to [[lat, lng]]
  const cumDist = computeCumDist(polyline);

  return { polyline, cumDist };
}
