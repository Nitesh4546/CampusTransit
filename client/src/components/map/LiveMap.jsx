import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import BusMarker from './BusMarker.jsx';
import StopMarker from './StopMarker.jsx';
import RouteLine from './RouteLine.jsx';
import { useMapFocusStore } from '../../store/mapFocusStore.js';

const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function MapFit({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom || map.getZoom());
  }, [center?.toString()]);
  return null;
}

function MapFocusController({ routes = [], stops = [], markerRefs }) {
  const map = useMap();
  const target = useMapFocusStore((state) => state.target);
  const clearTarget = useMapFocusStore((state) => state.clear || state.clearTarget);

  useEffect(() => {
    if (!target || !map) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Responsive padding to prevent route or stop from being hidden under side panel (desktop) or bottom drawer (mobile)
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    const paddingTopLeft = isDesktop ? [400, 40] : [30, 30];
    const paddingBottomRight = isDesktop ? [40, 40] : [30, 220];

    if (target.type === 'route') {
      const route = routes.find((r) => r._id === target.id || r.id === target.id);
      if (!route) return; // Wait for routes data to arrive before consuming target

      let bounds = null;
      if (route.polyline && route.polyline.length > 1) {
        bounds = L.latLngBounds(route.polyline);
      } else if (route.stops && route.stops.length > 0) {
        // Fallback: fit bounds around stops if polyline is missing / stale / empty
        const stopCoords = (route.stops || [])
          .map((s) => {
            const stopDoc = s.stopId || s;
            if (stopDoc?.location?.coordinates) {
              return [stopDoc.location.coordinates[1], stopDoc.location.coordinates[0]];
            }
            if (stopDoc?.lat != null && stopDoc?.lng != null) {
              return [stopDoc.lat, stopDoc.lng];
            }
            if (typeof s.stopId === 'string') {
              const matched = stops.find((item) => (item._id || item.id) === s.stopId);
              if (matched?.location?.coordinates) {
                return [matched.location.coordinates[1], matched.location.coordinates[0]];
              }
              if (matched?.lat != null && matched?.lng != null) {
                return [matched.lat, matched.lng];
              }
            }
            return null;
          })
          .filter(Boolean);

        if (stopCoords.length > 0) {
          bounds = L.latLngBounds(stopCoords);
        }
      }

      if (bounds && bounds.isValid()) {
        const applyBounds = () => {
          if (prefersReducedMotion) {
            map.fitBounds(bounds, { paddingTopLeft, paddingBottomRight, animate: false });
          } else {
            map.flyToBounds(bounds, {
              paddingTopLeft,
              paddingBottomRight,
              duration: 0.8,
              maxZoom: 16,
            });
          }
          clearTarget();
        };

        map.whenReady(applyBounds);
      }
    } else if (target.type === 'stop') {
      // Look up stop across explicit stops array and nested route stops
      let stopFound = stops.find((s) => String(s._id || s.id) === String(target.id));
      if (!stopFound) {
        for (const route of routes) {
          for (const s of route.stops || []) {
            const stopDoc = s.stopId || s;
            if (String(stopDoc._id || stopDoc.id) === String(target.id)) {
              stopFound = stopDoc;
              break;
            }
          }
          if (stopFound) break;
        }
      }

      if (!stopFound && routes.length === 0 && stops.length === 0) {
        // Data not yet loaded; retain target until data arrives
        return;
      }

      if (stopFound) {
        let lat, lng;
        if (stopFound.location?.coordinates && stopFound.location.coordinates.length >= 2) {
          [lng, lat] = stopFound.location.coordinates;
        } else if (stopFound.lat != null && stopFound.lng != null) {
          lat = Number(stopFound.lat);
          lng = Number(stopFound.lng);
        }

        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
          const stopIdToFocus = String(target.id);
          const applyStopFocus = () => {
            if (prefersReducedMotion) {
              map.setView([lat, lng], 17, { animate: false });
            } else {
              map.flyTo([lat, lng], 17, { duration: 0.8 });
            }

            // Open marker popup after transition (reliably handles async DOM / ref mount)
            const triggerPopup = () => {
              const marker = markerRefs.current?.get(stopIdToFocus);
              if (marker && !marker.isPopupOpen?.()) {
                marker.openPopup();
              }
            };
            setTimeout(triggerPopup, prefersReducedMotion ? 50 : 300);
            setTimeout(triggerPopup, prefersReducedMotion ? 100 : 850);
            clearTarget();
          };

          map.whenReady(applyStopFocus);
        }
      }
    }
  }, [target, map, routes, stops, clearTarget]);

  return null;
}

export default function LiveMap({
  center = [12.9716, 77.5800],
  zoom = 15,
  routes = [],
  buses = [],
  stops = [],
  selectedRouteId = null,
  onStopClick,
  onBusClick,
  flyTo,
  children,
}) {
  const markerRefs = useRef(new Map());
  const focusRoute = useMapFocusStore((state) => state.focusRoute);
  const focusStop = useMapFocusStore((state) => state.focusStop);

  // Collect all unique stops from both routes and standalone stops
  const allStops = [];
  const seenStopIds = new Set();

  // Standalone stops
  stops.forEach((s) => {
    const id = s._id || s.id;
    if (id && !seenStopIds.has(String(id))) {
      seenStopIds.add(String(id));
      allStops.push(s);
    }
  });

  // Stops from routes
  routes.forEach((route) => {
    (route.stops || []).forEach((stop) => {
      const stopDoc = stop.stopId || stop;
      const id = stopDoc?._id || stopDoc?.id;
      if (id && !seenStopIds.has(String(id))) {
        seenStopIds.add(String(id));
        allStops.push(stopDoc);
      }
    });
  });

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer url={OSM_TILE} attribution={ATTRIBUTION} maxZoom={19} />

      {flyTo && <MapFit center={flyTo} zoom={16} />}

      <MapFocusController routes={routes} stops={allStops} markerRefs={markerRefs} />

      {/* Route polylines */}
      {routes.map((route) =>
        route.polyline?.length > 1 && (
          <RouteLine
            key={route._id}
            polyline={route.polyline}
            color={route.color || '#6366f1'}
            isSelected={route._id === selectedRouteId}
            onClick={() => focusRoute(route._id)}
          />
        )
      )}

      {/* Stop markers */}
      {allStops.map((stopDoc) => {
        let lat, lng;
        if (stopDoc?.location?.coordinates && stopDoc.location.coordinates.length >= 2) {
          [lng, lat] = stopDoc.location.coordinates;
        } else if (stopDoc?.lat != null && stopDoc?.lng != null) {
          lat = Number(stopDoc.lat);
          lng = Number(stopDoc.lng);
        }
        if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;

        const id = String(stopDoc._id || stopDoc.id);

        return (
          <StopMarker
            key={id}
            ref={(marker) => {
              if (marker) {
                markerRefs.current.set(id, marker);
              } else {
                markerRefs.current.delete(id);
              }
            }}
            lat={lat}
            lng={lng}
            name={stopDoc.name}
            code={stopDoc.code}
            isEvent={Boolean(stopDoc.isEventStop)}
            onClick={() => {
              focusStop(id);
              onStopClick?.(stopDoc);
            }}
          />
        );
      })}

      {/* Bus markers */}
      {buses.map((bus) => {
        const route = routes.find((r) => String(r._id || r.id) === String(bus.routeId));
        return (
          <BusMarker
            key={bus.tripId}
            bus={bus}
            routeColor={route?.color}
            onBusClick={onBusClick}
          />
        );
      })}

      {children}
    </MapContainer>
  );
}
