import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin,
  Route as RouteIcon,
  Clock,
  Flag,
  RotateCcw,
  Edit,
  Navigation,
  Sparkles
} from 'lucide-react';
import { useMapFocusStore } from '../store/mapFocusStore.js';
import { mapLink } from '../utils/mapLinks.js';

export default function RouteTimeline({ route, allStops = [], onClose, onEditRoute }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { focusRoute } = useMapFocusStore();

  if (!route) return null;

  const color = route.color || '#1a73e8';
  const stopsList = route.stops || [];

  // Determine if route is a loop
  const isLoop = Boolean(
    route.isLoop ||
    (stopsList.length > 1 &&
      (stopsList[0]?.stopId?._id || stopsList[0]?.stopId) ===
      (stopsList[stopsList.length - 1]?.stopId?._id || stopsList[stopsList.length - 1]?.stopId))
  );

  // Resolve stop objects
  const stopMap = new Map();
  allStops.forEach((s) => stopMap.set(s._id, s));

  const resolvedStops = stopsList
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s, idx) => {
      let stopObj = null;
      if (s.stopId && typeof s.stopId === 'object') {
        stopObj = s.stopId;
      } else if (typeof s.stopId === 'string') {
        stopObj = stopMap.get(s.stopId);
      }
      return {
        ...s,
        name: stopObj?.name || `Stop ${idx + 1}`,
        code: stopObj?.code || '',
        dwellSec: s.dwellSec ?? 30,
        scheduledOffsetMin: s.scheduledOffsetMin ?? (idx * 5),
      };
    });

  // Calculate distance in km
  let totalDistanceKm = null;
  if (route.polylineCumDistM && route.polylineCumDistM.length > 0) {
    const totalM = route.polylineCumDistM[route.polylineCumDistM.length - 1];
    totalDistanceKm = (totalM / 1000).toFixed(1);
  } else if (route.totalDistanceM) {
    totalDistanceKm = (route.totalDistanceM / 1000).toFixed(1);
  }

  // Calculate total duration
  const lastOffset = resolvedStops.length > 0
    ? resolvedStops[resolvedStops.length - 1].scheduledOffsetMin
    : 0;
  const totalDurationMin = lastOffset > 0 ? lastOffset : (resolvedStops.length * 5);

  // Format stop scheduled arrival time
  const firstStartTime = route.schedule?.startTimes?.[0] || null;
  const formatTime = (offsetMin) => {
    if (!firstStartTime) {
      return offsetMin === 0 ? 'Start' : `+${offsetMin} min`;
    }
    const [h, m] = firstStartTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return `+${offsetMin} min`;
    const totalMin = h * 60 + m + offsetMin;
    const finalH = Math.floor(totalMin / 60) % 24;
    const finalM = totalMin % 60;
    return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
  };

  const handleViewOnMap = () => {
    focusRoute(route._id);
    navigate(mapLink({ routeId: route._id }), { state: { from: location.pathname + location.search } });
  };

  const handleEdit = () => {
    if (onClose) onClose();
    if (onEditRoute) onEditRoute(route);
  };

  return (
    <div className="flex flex-col h-full font-sans -m-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#28292c]/95 backdrop-blur-md px-6 py-5 border-b border-surface-200 dark:border-surface-800 shadow-soft-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm ring-4 ring-surface-100 dark:ring-surface-800"
              style={{ backgroundColor: color }}
            />
            <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100 tracking-tight">
              {route.name}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="badge bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border-surface-200 dark:border-surface-700 uppercase font-semibold text-[10px]">
              {route.type || 'regular'}
            </span>
            <span className={`badge uppercase font-semibold text-[10px] ${
              isLoop
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border-surface-200 dark:border-surface-700'
            }`}>
              {isLoop ? 'Loop' : 'Linear'}
            </span>
            {route.eventMode?.enabled && (
              <span className="badge bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 flex items-center gap-1 text-[10px]">
                <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                Shuttle
              </span>
            )}
          </div>
        </div>

        {/* Route Stats Bar */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-surface-100 dark:border-surface-800/80 text-xs">
          <div className="flex items-center gap-1.5 text-surface-600 dark:text-surface-400">
            <MapPin className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            <span className="font-medium text-surface-900 dark:text-surface-200">{resolvedStops.length} stops</span>
          </div>
          <div className="flex items-center gap-1.5 text-surface-600 dark:text-surface-400">
            <RouteIcon className="w-3.5 h-3.5 text-google-green flex-shrink-0" />
            <span className="font-medium text-surface-900 dark:text-surface-200">
              {totalDistanceKm ? `${totalDistanceKm} km` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-surface-600 dark:text-surface-400">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="font-medium text-surface-900 dark:text-surface-200">
              ~{totalDurationMin} min
            </span>
          </div>
        </div>
      </div>

      {/* Body: Vertical Journey Timeline */}
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        {resolvedStops.length === 0 ? (
          <div className="p-8 text-center text-sm text-surface-500 dark:text-surface-400 bg-surface-50 dark:bg-surface-800/50 rounded-2xl border border-surface-200 dark:border-surface-800">
            No stops defined for this route yet.
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6">
            {/* Continuous Vertical Route Line */}
            <div
              className="absolute left-[11px] sm:left-[15px] top-3 bottom-3 w-0.5 rounded-full"
              style={{ backgroundColor: color }}
            />

            {resolvedStops.map((stop, idx) => {
              const isSource = idx === 0;
              const isDestination = idx === resolvedStops.length - 1 && !isLoop;
              const timeDisplay = formatTime(stop.scheduledOffsetMin);
              const dwellMin = stop.dwellSec ? Math.max(1, Math.round(stop.dwellSec / 60)) : null;

              return (
                <div key={stop._id || idx} className="relative flex items-start justify-between gap-4 group">
                  {/* Timeline Node Icon */}
                  <div className="absolute -left-[23px] sm:-left-[27px] top-1">
                    {isSource ? (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shadow-soft-xs ring-4 ring-white dark:ring-[#28292c]"
                        style={{ backgroundColor: color }}
                      >
                        <div className="w-2 h-2 rounded-full bg-white dark:bg-[#28292c]" />
                      </div>
                    ) : isDestination ? (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white shadow-soft-xs ring-4 ring-white dark:ring-[#28292c]"
                        style={{ backgroundColor: color }}
                      >
                        <Flag className="w-2.5 h-2.5" />
                      </div>
                    ) : (
                      <div
                        className="w-3.5 h-3.5 rounded-full bg-white dark:bg-[#28292c] border-2 shadow-xs ring-4 ring-white dark:ring-[#28292c]"
                        style={{ borderColor: color }}
                      />
                    )}
                  </div>

                  {/* Left: Stop Info */}
                  <div className="flex-1 min-w-0 pl-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {stop.name}
                      </span>
                      {stop.code && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700">
                          {stop.code}
                        </span>
                      )}
                      {isSource && (
                        <span className="badge bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800 text-[10px] font-bold uppercase tracking-wider">
                          Source
                        </span>
                      )}
                      {isDestination && (
                        <span className="badge bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                          Destination
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Time & Dwell */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs sm:text-sm font-mono font-bold text-surface-900 dark:text-surface-100">
                      {timeDisplay}
                    </div>
                    {stop.dwellSec > 0 && (
                      <div className="text-[11px] text-surface-400 dark:text-surface-500">
                        stops {dwellMin} min
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loop Return Node */}
            {isLoop && resolvedStops.length > 0 && (
              <div className="relative flex items-start justify-between gap-4 group pt-2">
                <div className="absolute -left-[23px] sm:-left-[27px] top-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white shadow-soft-xs ring-4 ring-white dark:ring-[#28292c]"
                    style={{ backgroundColor: color }}
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                  </div>
                </div>

                <div className="flex-1 min-w-0 pl-2 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-surface-900 dark:text-surface-100">
                      Returns to {resolvedStops[0].name}
                    </span>
                    <span className="badge bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-[10px] font-bold uppercase tracking-wider">
                      Loop Complete
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 pt-2">
                  <div className="text-xs sm:text-sm font-mono font-bold text-surface-900 dark:text-surface-100">
                    {formatTime(totalDurationMin)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 bg-white/95 dark:bg-[#28292c]/95 backdrop-blur-md px-6 py-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-end gap-3 shadow-soft-sm">
        <button
          type="button"
          onClick={handleViewOnMap}
          className="btn-subtle px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
        >
          <Navigation className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
          <span>View on map</span>
        </button>

        <button
          type="button"
          onClick={handleEdit}
          className="btn-primary px-4 py-2 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-soft-xs"
        >
          <Edit className="w-3.5 h-3.5" />
          <span>Edit route</span>
        </button>
      </div>
    </div>
  );
}
