import React, { useState } from 'react';
import {
  Bus,
  Navigation,
  Clock,
  Gauge,
  Compass,
  MapPin,
  Route as RouteIcon,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Users,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import Drawer from './ui/Drawer.jsx';
import Modal from './ui/Modal.jsx';
import { useLiveBusStore } from '../store/liveBusStore.js';

function getCardinalDirection(angle = 0) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((angle % 360) / 45)) % 8;
  return directions[index];
}

export default function ActiveBusDrawer({
  isOpen,
  onClose,
  bus,
  route,
  onFocusMap,
}) {
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const drivers = useLiveBusStore((state) => state.drivers);
  const etas = useLiveBusStore((state) => state.etas);

  if (!bus) return null;

  const driver = drivers[bus.tripId] || { name: 'Assigned Driver' };
  const routeEtas = (route && etas[route._id]?.[bus.tripId]) || [];

  const busTitle = bus.busName || bus.name || `Bus #${bus.busId?.slice(-6) || 'Live'}`;
  const busSubtitle = bus.plateNo ? `Vehicle Plate: ${bus.plateNo}` : 'Live Campus Transit Shuttle';

  // Identify next stop from route definition
  const stopsList = route?.stops || [];
  const nextStopIndex = bus.nextStopIndex ?? 0;
  const nextStopDoc = stopsList[nextStopIndex]?.stopId || stopsList[nextStopIndex] || null;
  const nextStopName = nextStopDoc?.name || (stopsList.length > 0 ? `Stop #${nextStopIndex + 1}` : 'In Transit');

  // Next ETA
  const nextEtaItem = routeEtas.find((e) => e.stopIndex === nextStopIndex) || routeEtas[0];
  const nextEtaMin = nextEtaItem ? Math.round(nextEtaItem.etaMinutes ?? nextEtaItem.etaMin ?? 0) : null;

  const handleCenter = () => {
    if (bus.lat && bus.lng && onFocusMap) {
      onFocusMap([bus.lat, bus.lng]);
    }
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={busTitle}
        subtitle={busSubtitle}
      >
        <div className="space-y-5 text-sm font-sans">
          {/* HEADER STATUS BADGE */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                {bus.offline ? 'Telemetry Interrupted' : 'Live & Broadcasting'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCenter}
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Center on map</span>
            </button>
          </div>

          {/* SECTION 1: REAL-TIME TELEMETRY STATS */}
          <section className="space-y-2.5">
            <div className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-google-green" />
              <span>Real-Time Telemetry</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Live Speed */}
              <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200 dark:border-surface-700/80">
                <span className="text-[10px] text-surface-500 dark:text-surface-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-primary-500" /> Speed
                </span>
                <div className="text-xl font-extrabold text-surface-900 dark:text-surface-100 mt-0.5">
                  {Math.round(bus.speedKmh || 0)} <span className="text-xs font-normal text-surface-500">km/h</span>
                </div>
                <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                  {bus.speedKmh > 3 ? 'Moving on route' : 'Stationary / At stop'}
                </div>
              </div>

              {/* Heading */}
              <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200 dark:border-surface-700/80">
                <span className="text-[10px] text-surface-500 dark:text-surface-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-blue-500" /> Heading
                </span>
                <div className="text-xl font-extrabold text-surface-900 dark:text-surface-100 mt-0.5">
                  {Math.round(bus.heading || 0)}° <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">{getCardinalDirection(bus.heading)}</span>
                </div>
                <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                  Compass orientation
                </div>
              </div>
            </div>

            {/* GPS coordinates & timestamp */}
            {bus.lat != null && bus.lng != null && (
              <div className="p-3 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200 dark:border-surface-700/80 text-xs flex items-center justify-between font-mono text-surface-600 dark:text-surface-300">
                <span>Lat: {bus.lat.toFixed(5)}</span>
                <span>Lng: {bus.lng.toFixed(5)}</span>
                <span className="text-[10px] text-surface-500 font-sans">
                  {new Date(bus.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            )}
          </section>

          {/* SECTION 2: ROUTE PROGRESS & NEXT STOP */}
          {route && (
            <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                  <RouteIcon className="w-3.5 h-3.5 text-primary-600" />
                  <span>Assigned Route</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shadow-xs"
                    style={{ backgroundColor: route.color || '#1a73e8' }}
                  />
                  <span className="text-xs font-bold text-surface-900 dark:text-surface-100">
                    {route.name}
                  </span>
                </div>
              </div>

              {/* Next stop highlight card */}
              <div className="p-3.5 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-google-red" />
                    <span>Next Designated Stop</span>
                  </span>
                  {nextEtaMin != null && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      ~{nextEtaMin} min ETA
                    </span>
                  )}
                </div>

                <div className="text-base font-bold text-surface-900 dark:text-surface-100">
                  {nextStopName}
                </div>

                <div className="text-xs text-surface-500 dark:text-surface-400">
                  Stop {nextStopIndex + 1} of {stopsList.length} along scheduled circuit
                </div>
              </div>

              {/* Upcoming stops list with ETAs */}
              {routeEtas.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                    Upcoming Stop ETAs
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {routeEtas.slice(0, 4).map((etaItem, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-[#1f1f23]/70 border border-surface-100 dark:border-surface-700/60 text-xs"
                      >
                        <span className="font-medium text-surface-800 dark:text-surface-200 truncate">
                          {etaItem.stopName || `Stop ${idx + 1}`}
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-[11px] flex-shrink-0">
                          {etaItem.etaMinutes != null ? `${Math.round(etaItem.etaMinutes)} min` : 'In transit'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SECTION 3: VERIFIED DRIVER OPERATOR */}
          <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-3">
            <div className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              <span>Verified Operator</span>
            </div>

            <div className="p-3.5 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Photo Thumbnail */}
                <div
                  onClick={() => driver.photoUrl && setPhotoModalOpen(true)}
                  className={`relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-soft-xs bg-surface-100 dark:bg-surface-800 flex-shrink-0 ${
                    driver.photoUrl ? 'cursor-pointer group' : ''
                  }`}
                  title={driver.photoUrl ? 'Click to inspect verified photo' : undefined}
                >
                  {driver.photoUrl ? (
                    <>
                      <img
                        src={driver.photoUrl}
                        alt={driver.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextSibling) {
                            e.currentTarget.nextSibling.style.display = 'flex';
                          }
                        }}
                      />
                      <div
                        style={{ display: 'none' }}
                        className="w-full h-full items-center justify-center font-bold text-sm text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-950"
                      >
                        {driver.name ? driver.name.slice(0, 2).toUpperCase() : 'DR'}
                      </div>
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-sm text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-950">
                      {driver.name ? driver.name.slice(0, 2).toUpperCase() : 'DR'}
                    </div>
                  )}
                </div>

                <div>
                  <div className="font-bold text-surface-900 dark:text-surface-100 text-sm">
                    {driver.name || 'Assigned Driver'}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Identity Verified for Trip</span>
                  </div>
                </div>
              </div>

              {driver.photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(true)}
                  className="btn-subtle px-3 py-1.5 text-xs rounded-full font-semibold"
                >
                  View Photo
                </button>
              )}
            </div>

            <p className="text-[11px] text-surface-500 dark:text-surface-400 leading-relaxed">
              Driver verification photo was authenticated at trip departure. Private operator contact details are protected.
            </p>
          </section>

          {/* SECTION 4: VEHICLE SPECIFICATIONS */}
          <section className="p-4 rounded-3xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/80 space-y-2.5">
            <div className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bus className="w-3.5 h-3.5 text-google-green" />
              <span>Vehicle Specifications</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-white dark:bg-[#1f1f23] rounded-xl border border-surface-200 dark:border-surface-700">
                <span className="text-[10px] text-surface-500 uppercase tracking-wider block font-semibold">Capacity</span>
                <span className="font-bold text-surface-900 dark:text-surface-100 mt-0.5 block">
                  {bus.capacity || 40} Passengers
                </span>
              </div>

              <div className="p-2.5 bg-white dark:bg-[#1f1f23] rounded-xl border border-surface-200 dark:border-surface-700">
                <span className="text-[10px] text-surface-500 uppercase tracking-wider block font-semibold">License Plate</span>
                <span className="font-bold text-surface-900 dark:text-surface-100 font-mono mt-0.5 block truncate">
                  {bus.plateNo || 'Active Service'}
                </span>
              </div>
            </div>
          </section>

          {/* Action button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleCenter}
              className="w-full btn-primary py-3 rounded-full text-xs font-bold flex items-center justify-center gap-2 shadow-soft-xs"
            >
              <Navigation className="w-4 h-4" />
              <span>Center Bus on Live Map</span>
            </button>
          </div>
        </div>
      </Drawer>

      {/* Enlarged Driver Photo Modal */}
      {photoModalOpen && driver.photoUrl && (
        <Modal
          isOpen={photoModalOpen}
          onClose={() => setPhotoModalOpen(false)}
          title="Verified Driver Identity"
          maxWidth="max-w-sm"
        >
          <div className="text-center space-y-4 font-sans">
            <div className="w-56 h-56 mx-auto rounded-3xl overflow-hidden border-2 border-emerald-500 shadow-soft-lg">
              <img
                src={driver.photoUrl}
                alt={driver.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h4 className="text-base font-bold text-surface-900 dark:text-surface-100">
                {driver.name}
              </h4>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                Assigned operator for {busTitle}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-google-green" />
              <span>Live Photo Authenticated</span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
