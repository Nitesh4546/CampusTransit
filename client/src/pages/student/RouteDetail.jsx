import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Bus, MapPin, Clock, ChevronRight } from 'lucide-react';
import { routesApi } from '../../api/index.js';
import { useLiveBusStore } from '../../store/liveBusStore.js';
import { useLiveBuses } from '../../hooks/useLiveBuses.js';
import LiveMap from '../../components/map/LiveMap.jsx';
import EtaList from '../../components/EtaList.jsx';
import AnnouncementBanner from '../../components/AnnouncementBanner.jsx';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';
import BackToAdmin from '../../components/BackToAdmin.jsx';
import DriverChip from '../../components/DriverChip.jsx';
import { useMapFocusStore } from '../../store/mapFocusStore.js';

export default function RouteDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const { getAllActiveBuses, etas, drivers } = useLiveBusStore();
  const focusRoute = useMapFocusStore((state) => state.focusRoute);
  const focusStop = useMapFocusStore((state) => state.focusStop);

  useLiveBuses([id]);

  useEffect(() => {
    routesApi.get(id).then(res => {
      setRoute(res.data);
      focusRoute(id);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner fullscreen />;
  if (!route) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-surface-50 text-center font-sans">
        <div className="w-12 h-12 rounded-full bg-surface-200 flex items-center justify-center text-surface-500 mb-3">
          <Bus className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-surface-900 mb-1">Route Not Found</h2>
        <p className="text-sm text-surface-600 mb-5">The requested campus route could not be loaded.</p>
        <Link to="/" state={location.state} className="btn-primary">
          Back to Live Map
        </Link>
      </div>
    );
  }

  const activeBuses = getAllActiveBuses().filter(b => b.routeId === id);
  const routeEtas = etas[id] ? Object.entries(etas[id]) : [];

  return (
    <div className="h-dvh flex flex-col bg-surface-50 dark:bg-[#1f1f1f] text-surface-900 dark:text-surface-100 font-sans overflow-hidden transition-colors duration-150">
      {/* Chrome Style Top Header Navbar */}
      <header className="bg-white dark:bg-[#28292c] border-b border-surface-200 dark:border-surface-800 px-4 sm:px-6 py-3 flex items-center justify-between z-50 flex-shrink-0 shadow-soft-xs transition-colors duration-150">
        <div className="flex items-center gap-3">
          <BackToAdmin />
          <Link
            to="/"
            state={location.state}
            className="p-2 rounded-full text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            title="Back to Map"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div
            onClick={() => route && focusRoute(route._id)}
            className="flex items-center gap-3 cursor-pointer group"
            title="Click to focus route on map"
          >
            <div
              className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm transition-transform group-hover:scale-125"
              style={{ backgroundColor: route.color || '#1a73e8' }}
            />
            <div>
              <h1 className="text-base sm:text-lg font-bold text-surface-900 dark:text-surface-100 leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {route.name}
              </h1>
              <div className="text-xs text-surface-500 dark:text-surface-400 font-medium">
                {route.type === 'event' ? 'Event Shuttle Service' : 'Standard Campus Line'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeBuses.length > 0 ? (
            <div className="badge-success">
              <span className="live-dot" />
              <span>{activeBuses.length} bus{activeBuses.length !== 1 ? 'es' : ''} live</span>
            </div>
          ) : (
            <div className="badge-muted">
              <span>No buses active</span>
            </div>
          )}

          {/* Theme Toggle Button */}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 map-layout overflow-hidden relative">
        {/* Sidebar */}
        <aside className="bg-white dark:bg-[#28292c] border-r border-surface-200 dark:border-surface-800 overflow-y-auto p-5 hidden md:flex flex-col shadow-soft-xs z-10 transition-colors duration-150">
          {/* Stops List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title mb-0">Route Stops</h2>
              <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full">
                {route.stops?.length || 0} stops
              </span>
            </div>

            <div className="space-y-1.5">
              {[...(route.stops || [])].sort((a, b) => a.order - b.order).map((stop, idx) => {
                const s = stop.stopId || stop;
                return (
                  <div
                    key={s._id || idx}
                    onClick={() => (s._id || s.id) && focusStop(s._id || s.id)}
                    title="Click to focus stop on map"
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-50/70 dark:bg-surface-800/60 border border-surface-200/60 dark:border-surface-700/60 hover:bg-surface-100/70 dark:hover:bg-surface-800 hover:border-primary-400 dark:hover:border-primary-500 cursor-pointer transition-all"
                  >
                    <div className="w-6 h-6 rounded-full bg-white dark:bg-surface-700 border border-surface-300 dark:border-surface-600 flex items-center justify-center text-xs font-bold text-surface-700 dark:text-surface-200 flex-shrink-0 shadow-soft-xs">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{s.name}</div>
                      {stop.scheduledOffsetMin > 0 ? (
                        <div className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-surface-400" />
                          <span>+{stop.scheduledOffsetMin} min from route start</span>
                        </div>
                      ) : (
                        <div className="text-xs text-primary-600 dark:text-primary-400 font-medium mt-0.5">Departure Station</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Shuttles & Drivers */}
          {activeBuses.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title mb-0">Active Buses & Drivers</h2>
                <span className="badge-success text-[10px]">
                  <span className="live-dot" /> Live
                </span>
              </div>
              <div className="space-y-2">
                {activeBuses.map((bus) => (
                  <div
                    key={bus.tripId}
                    className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 shadow-soft-xs"
                  >
                    <DriverChip
                      driver={drivers[bus.tripId] || { name: 'Assigned Driver' }}
                      busLabel={`Bus #${bus.busId?.slice(-6) || ''}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live ETAs Section */}
          <div className="mt-auto pt-4 border-t border-surface-200 dark:border-surface-800">
            <h2 className="section-title">Live Stop ETAs</h2>
            {routeEtas.length > 0 ? (
              routeEtas.map(([tripId, etaList]) => (
                <div key={tripId} className="mb-4">
                  <EtaList etas={etaList} />
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200/80 dark:border-surface-700 text-center">
                <p className="text-xs text-surface-600 dark:text-surface-400 font-medium">No live ETAs currently computed.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Map View */}
        <div className="relative w-full h-full">
          <AnnouncementBanner routeId={id} />
          <LiveMap
            routes={[route]}
            buses={activeBuses}
            selectedRouteId={id}
          />
        </div>
      </div>
    </div>
  );
}
