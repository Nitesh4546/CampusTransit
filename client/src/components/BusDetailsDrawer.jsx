import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bus,
  Users,
  Route,
  Activity,
  Phone,
  CreditCard,
  Mail,
  Clock,
  Gauge,
  Navigation,
  Star,
  CheckCircle2,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Edit,
  Trash2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import Drawer from './ui/Drawer.jsx';
import { busesApi } from '../api/index.js';
import { mapLink } from '../utils/mapLinks.js';
import { useLiveBusStore } from '../store/liveBusStore.js';

function StarRating({ rating }) {
  if (rating === null || rating === undefined) {
    return (
      <span className="text-xs text-surface-500 dark:text-surface-400 italic">
        Not enough data yet
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center text-amber-500">
        {[1, 2, 3, 4, 5].map((star) => {
          if (rating >= star) {
            return <Star key={star} className="w-4 h-4 fill-amber-400 text-amber-500" />;
          } else if (rating >= star - 0.5) {
            return (
              <div key={star} className="relative w-4 h-4">
                <Star className="w-4 h-4 text-surface-300 dark:text-surface-600" />
                <div className="absolute inset-0 overflow-hidden w-1/2">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                </div>
              </div>
            );
          } else {
            return <Star key={star} className="w-4 h-4 text-surface-300 dark:text-surface-600" />;
          }
        })}
      </div>
      <span className="font-bold text-sm text-surface-900 dark:text-surface-100">
        {rating.toFixed(1)} / 5.0
      </span>
    </div>
  );
}

export default function BusDetailsDrawer({
  isOpen,
  onClose,
  bus,
  routes = [],
  onEdit,
  onDelete,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Subscribe to live bus store
  const liveBuses = useLiveBusStore((state) => state.buses);
  const drivers = useLiveBusStore((state) => state.drivers);
  const liveBus = bus
    ? Object.values(liveBuses).find(
        (b) => b.busId === bus._id || b.tripId === bus.currentTripId?._id || b.tripId === bus.currentTripId
      )
    : null;

  const currentTripId = liveBus?.tripId || (typeof bus?.currentTripId === 'object' ? bus.currentTripId?._id : bus?.currentTripId);
  const liveDriver = currentTripId ? drivers[currentTripId] : null;
  const liveDriverName = liveDriver?.name || bus?.driver?.name || 'Assigned Driver';
  const liveDriverPhone = liveDriver?.phone || bus?.driver?.phone || '';
  const liveDriverLicense = liveDriver?.license || bus?.driver?.license || '';
  const liveDriverPhotoUrl = liveDriver?.photoUrl || (currentTripId ? `/api/trips/${currentTripId}/driver-photo` : null);

  useEffect(() => {
    if (!bus?._id || !isOpen) {
      setStats(null);
      return;
    }

    let isMounted = true;
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const res = await busesApi.getStats(bus._id);
        if (isMounted) {
          setStats(res.data);
        }
      } catch (err) {
        console.error('Failed to load bus punctuality stats:', err);
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, [bus?._id, isOpen]);

  if (!bus) return null;

  const routeObj = routes.find(
    (r) => r._id === (bus.currentRouteId?._id || bus.currentRouteId)
  );

  const isLive = bus.status === 'on_trip' || Boolean(liveBus);
  const isIdle = bus.status === 'idle' && !liveBus;

  // Format ping age
  const lastPingAge = liveBus?.updatedAt
    ? Math.max(0, Math.round((Date.now() - new Date(liveBus.updatedAt).getTime()) / 1000))
    : null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={bus.name}
      subtitle={`License Plate: ${bus.plateNo}`}
    >
      <div className="space-y-6 text-sm font-sans">
        {/* SECTION 1: VEHICLE SPECIFICATIONS */}
        <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
              Vehicle Overview
            </span>
            <span
              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                isLive
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : isIdle
                  ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800'
                  : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLive ? 'bg-emerald-500 animate-ping' : 'bg-current'
                }`}
              />
              {bus.status ? bus.status.replace('_', ' ') : 'idle'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700">
              <div className="text-[11px] text-surface-500 dark:text-surface-400 mb-0.5">License Plate</div>
              <div className="font-mono font-bold text-surface-900 dark:text-surface-100 text-sm">
                {bus.plateNo}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700">
              <div className="text-[11px] text-surface-500 dark:text-surface-400 mb-0.5">Capacity</div>
              <div className="font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-surface-400" />
                <span>{bus.capacity} seats</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: LIVE TRIP BROADCAST (if on a trip) */}
        {isLive && (
          <section className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-3xl border border-emerald-200 dark:border-emerald-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>Live Trip Broadcast</span>
              </div>
              {lastPingAge !== null && (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  GPS ping: {lastPingAge}s ago
                </span>
              )}
            </div>

            {/* Live Active Driver Card */}
            <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-950/80 border-2 border-emerald-500 flex-shrink-0 flex items-center justify-center shadow-soft-xs">
                {liveDriverPhotoUrl ? (
                  <img
                    src={liveDriverPhotoUrl}
                    alt={liveDriverName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextSibling) {
                        e.currentTarget.nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div
                  style={{ display: liveDriverPhotoUrl ? 'none' : 'flex' }}
                  className="w-full h-full items-center justify-center font-bold text-xs text-primary-800 dark:text-primary-200"
                >
                  {liveDriverName ? liveDriverName.slice(0, 2).toUpperCase() : 'DR'}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-surface-900 dark:text-surface-100 truncate">
                    {liveDriverName}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Live Driver
                  </span>
                </div>
                <div className="text-[11px] text-surface-500 dark:text-surface-400 flex items-center gap-2 mt-0.5 flex-wrap">
                  {liveDriverPhone ? (
                    <a href={`tel:${liveDriverPhone}`} className="hover:underline text-primary-600 dark:text-primary-400">
                      Tel: {liveDriverPhone}
                    </a>
                  ) : (
                    <span>Tel: —</span>
                  )}
                  <span>•</span>
                  <span className="font-mono">Lic: {liveDriverLicense || '—'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                <div className="text-[11px] text-surface-500 dark:text-surface-400 mb-0.5">Assigned Line</div>
                <div className="font-bold text-surface-900 dark:text-surface-100 truncate">
                  {routeObj?.name || 'In Transit'}
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                <div className="text-[11px] text-surface-500 dark:text-surface-400 mb-0.5">Current Speed</div>
                <div className="font-bold text-surface-900 dark:text-surface-100 flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{liveBus?.speedKmh ? `${Math.round(liveBus.speedKmh)} km/h` : '0 km/h'}</span>
                </div>
              </div>
            </div>

            {liveBus?.nextStopIndex !== undefined && routeObj?.stops?.[liveBus.nextStopIndex] && (
              <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs">
                <span className="text-surface-600 dark:text-surface-400">Next Scheduled Stop:</span>
                <span className="font-bold text-surface-900 dark:text-surface-100">
                  {routeObj.stops[liveBus.nextStopIndex]?.stopId?.name || `Stop #${liveBus.nextStopIndex + 1}`}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const target = routeObj ? mapLink({ routeId: routeObj._id }) : '/';
                navigate(target, { state: { from: location.pathname + location.search } });
              }}
              className="w-full btn-primary text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-soft-xs"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>View live bus on map</span>
            </button>
          </section>
        )}

        {/* SECTION 3: DRIVER ASSIGNMENT */}
        <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-3">
          <div className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
            Assigned Driver Details
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700">
              <span className="text-xs text-surface-500 dark:text-surface-400">Driver Name</span>
              <span className="font-bold text-surface-900 dark:text-surface-100">
                {bus.driver?.name || 'Unassigned'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700">
              <span className="text-xs text-surface-500 dark:text-surface-400">Phone Number</span>
              {bus.driver?.phone ? (
                <a
                  href={`tel:${bus.driver.phone}`}
                  className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{bus.driver.phone}</span>
                </a>
              ) : (
                <span className="text-xs text-surface-400">—</span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700">
              <span className="text-xs text-surface-500 dark:text-surface-400">License Number</span>
              <span className="font-mono text-xs text-surface-800 dark:text-surface-200">
                {bus.driver?.license || 'Not recorded'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700">
              <span className="text-xs text-surface-500 dark:text-surface-400">Linked Account</span>
              {bus.assignedDriverEmail ? (
                <span className="font-mono text-xs text-surface-800 dark:text-surface-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-surface-400" />
                  <span>{bus.assignedDriverEmail}</span>
                </span>
              ) : (
                <span className="text-xs text-surface-400 italic">No account linked</span>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 4: PUNCTUALITY METRICS & ARRIVAL HISTORY */}
        <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
              Punctuality Rating & Stats
            </span>
            {stats && stats.sampleSize > 0 && (
              <span className="text-[11px] text-surface-500 dark:text-surface-400">
                {stats.sampleSize} arrivals (30d)
              </span>
            )}
          </div>

          {loadingStats ? (
            <div className="p-6 text-center text-xs text-surface-500">Loading metrics...</div>
          ) : stats ? (
            <>
              {/* Rating Card */}
              <div className="p-4 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <StarRating rating={stats.rating} />
                  {stats.onTimePct !== null && (
                    <span className="badge bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                      {stats.onTimePct}% on time
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-100 dark:border-surface-800 text-xs">
                  <div>
                    <span className="text-surface-500 dark:text-surface-400 text-[11px]">Average Delay: </span>
                    <strong className="text-surface-900 dark:text-surface-100">
                      {stats.avgDelayMin !== undefined ? `${stats.avgDelayMin > 0 ? '+' : ''}${stats.avgDelayMin} min` : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-surface-500 dark:text-surface-400 text-[11px]">Evaluated: </span>
                    <strong className="text-surface-900 dark:text-surface-100">{stats.sampleSize} runs</strong>
                  </div>
                </div>
              </div>

              {/* Recent 10 Arrivals List */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
                  Recent Recorded Arrivals
                </div>

                {stats.recent && stats.recent.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {stats.recent.map((rec) => {
                      const isOnTime = rec.delayMin >= -2 && rec.delayMin <= 3;
                      const isLate = rec.delayMin > 3;
                      const isEarly = rec.delayMin < -2;

                      return (
                        <div
                          key={rec._id}
                          className="p-2.5 bg-white dark:bg-[#1f1f23] rounded-xl border border-surface-200 dark:border-surface-700/80 flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-semibold text-surface-900 dark:text-surface-100 truncate">
                              {rec.stopName}
                              {rec.stopCode && (
                                <span className="font-mono text-[10px] text-surface-400 ml-1">
                                  ({rec.stopCode})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-surface-400 capitalize">
                              {rec.kind} • {new Date(rec.actualAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>

                          {/* Punctuality Chip */}
                          <div className="flex-shrink-0">
                            {isOnTime && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {rec.delayMin > 0 ? `+${rec.delayMin}m` : `${rec.delayMin}m`} On time
                              </span>
                            )}
                            {isLate && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                +{rec.delayMin}m Late
                              </span>
                            )}
                            {isEarly && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {rec.delayMin}m Early
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 text-center text-xs text-surface-400">
                    No historical arrivals recorded yet.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 text-center text-xs text-surface-400">
              Not enough data yet
            </div>
          )}
        </section>

        {/* SECTION 5: ACTION TOOLBAR */}
        <div className="pt-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onEdit) onEdit(bus);
            }}
            className="btn-subtle px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Vehicle</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onDelete) onDelete(bus._id);
            }}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/50 text-google-red hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </Drawer>
  );
}
