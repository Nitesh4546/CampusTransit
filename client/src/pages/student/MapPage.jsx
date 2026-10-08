import React, { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Bus, MapPin, Navigation, ChevronRight, Calendar, Wifi, WifiOff, Shield, AlertCircle } from 'lucide-react';
import { routesApi, stopsApi } from '../../api/index.js';
import { useLiveBusStore } from '../../store/liveBusStore.js';
import { useAnnouncementStore } from '../../store/announcementStore.js';
import { useLiveBuses } from '../../hooks/useLiveBuses.js';
import { getSocket } from '../../socket/socket.js';
import LiveMap from '../../components/map/LiveMap.jsx';
import AnnouncementBanner from '../../components/AnnouncementBanner.jsx';
import EtaList from '../../components/EtaList.jsx';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';
import BackToAdmin from '../../components/BackToAdmin.jsx';
import DriverChip from '../../components/DriverChip.jsx';
import ActiveBusDrawer from '../../components/ActiveBusDrawer.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { useMapFocusStore } from '../../store/mapFocusStore.js';

export default function MapPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedStop, setSelectedStop] = useState(null);
  const [inspectedBus, setInspectedBus] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [connected, setConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const { user, isAuthenticated } = useAuthStore();
  const focusRoute = useMapFocusStore((state) => state.focusRoute);
  const focusStop = useMapFocusStore((state) => state.focusStop);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const { getAllActiveBuses, etas, drivers } = useLiveBusStore();
  const activeBuses = getAllActiveBuses();
  const routeIds = routes.map(r => r._id);

  useLiveBuses(routeIds);

  useEffect(() => {
    Promise.all([
      routesApi.list().catch((err) => {
        console.error('Failed to load routes:', err);
        return { data: [] };
      }),
      stopsApi.list().catch((err) => {
        console.error('Failed to load stops:', err);
        return { data: [] };
      }),
    ]).then(([routesRes, stopsRes]) => {
      const now = Date.now();
      const allRoutes = routesRes.data || [];
      const allStops = stopsRes.data || [];
      setStops(allStops);

      const visibleRoutes = allRoutes.filter(route => {
        const mode = route.eventMode;
        if (!mode?.enabled) return true;
        return (!mode.activeFrom || now >= new Date(mode.activeFrom).getTime()) &&
          (!mode.activeUntil || now <= new Date(mode.activeUntil).getTime());
      });

      const fRoute = searchParams.get('focusRoute');
      const fStop = searchParams.get('focusStop');

      let targetRouteToSelect = null;

      if (fRoute) {
        const found = allRoutes.find(r => r._id === fRoute || r.id === fRoute);
        if (found) {
          if (!visibleRoutes.some(r => r._id === found._id)) {
            visibleRoutes.push(found);
          }
          targetRouteToSelect = found._id;
          focusRoute(found._id);
        } else {
          showToast('Route not found');
        }
      } else if (fStop) {
        const parentRoute = allRoutes.find(r =>
          (r.stops || []).some(s => String(s.stopId?._id || s.stopId || s._id) === String(fStop))
        );
        if (parentRoute) {
          if (!visibleRoutes.some(r => r._id === parentRoute._id)) {
            visibleRoutes.push(parentRoute);
          }
          targetRouteToSelect = parentRoute._id;
        }

        const stopDoc = allStops.find(s => String(s._id || s.id) === String(fStop));
        if (stopDoc || parentRoute) {
          if (stopDoc) setSelectedStop(stopDoc);
          focusStop(fStop);
        } else {
          showToast('Stop not found');
        }
      }

      setRoutes(visibleRoutes);

      if (targetRouteToSelect) {
        setSelectedRouteId(targetRouteToSelect);
      } else if (visibleRoutes.length) {
        setSelectedRouteId(visibleRoutes[0]._id);
        if (!fRoute && !fStop) {
          focusRoute(visibleRoutes[0]._id);
        }
      }

      // Clear searchParams while preserving BackToAdmin state
      if (fRoute || fStop) {
        const next = new URLSearchParams(searchParams);
        next.delete('focusRoute');
        next.delete('focusStop');
        setSearchParams(next, { replace: true, state: location.state });
      }
    }).catch(console.error).finally(() => setLoading(false));

    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);

    const onRouteCreated = (newRoute) => {
      setRoutes((prev) => {
        if (prev.some((r) => r._id === newRoute._id)) return prev;
        return [...prev, newRoute];
      });
    };

    const onRouteUpdated = (updatedRoute) => {
      setRoutes((prev) => {
        const idx = prev.findIndex((r) => r._id === updatedRoute._id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedRoute;
          return next;
        }
        return [...prev, updatedRoute];
      });
    };

    const onRouteDeleted = ({ routeId }) => {
      setRoutes((prev) => prev.filter((r) => r._id !== routeId));
    };

    socket.on('route:created', onRouteCreated);
    socket.on('route:updated', onRouteUpdated);
    socket.on('route:deleted', onRouteDeleted);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('route:created', onRouteCreated);
      socket.off('route:updated', onRouteUpdated);
      socket.off('route:deleted', onRouteDeleted);
    };
  }, []);

  // React to query parameter changes when routes/stops are already loaded
  useEffect(() => {
    if (loading || (routes.length === 0 && stops.length === 0)) return;
    const fRoute = searchParams.get('focusRoute');
    const fStop = searchParams.get('focusStop');
    if (!fRoute && !fStop) return;

    if (fRoute) {
      const found = routes.find(r => r._id === fRoute || r.id === fRoute);
      if (found) {
        setSelectedRouteId(found._id);
        focusRoute(found._id);
      } else {
        showToast('Route not found');
      }
    } else if (fStop) {
      const parentRoute = routes.find(r =>
        (r.stops || []).some(s => String(s.stopId?._id || s.stopId || s._id) === String(fStop))
      );
      if (parentRoute) {
        setSelectedRouteId(parentRoute._id);
      }
      const stopDoc = stops.find(s => String(s._id || s.id) === String(fStop));
      if (stopDoc || parentRoute) {
        if (stopDoc) setSelectedStop(stopDoc);
        focusStop(fStop);
      } else {
        showToast('Stop not found');
      }
    }

    const next = new URLSearchParams(searchParams);
    next.delete('focusRoute');
    next.delete('focusStop');
    setSearchParams(next, { replace: true, state: location.state });
  }, [searchParams, loading, routes, stops]);

  const selectedRoute = routes.find(r => r._id === selectedRouteId);
  const selectedBuses = activeBuses.filter(b => b.routeId === selectedRouteId);
  const selectedEtas = selectedRouteId && etas[selectedRouteId]
    ? Object.entries(etas[selectedRouteId]).map(([tripId, etaList]) => ({
        tripId,
        etas: etaList,
        busId: activeBuses.find(b => b.tripId === tripId)?.busId,
      }))
    : [];

  const handleNearestStop = () => {
    navigator.geolocation.getCurrentPosition(
      pos => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
      err => alert('Location access denied: ' + err.message)
    );
  };

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="h-dvh flex flex-col bg-surface-50 dark:bg-[#1f1f1f] text-surface-900 dark:text-surface-100 overflow-hidden font-sans transition-colors duration-150">
      {/* Chrome Style Top Header Navbar */}
      <header className="bg-white dark:bg-[#28292c] border-b border-surface-200 dark:border-surface-800 px-4 sm:px-6 py-3 flex items-center justify-between z-50 flex-shrink-0 shadow-soft-xs transition-colors duration-150">
        <div className="flex items-center gap-3">
          <BackToAdmin />
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800/60 flex items-center justify-center transition-colors group-hover:bg-primary-100 dark:group-hover:bg-primary-900/60">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold text-surface-900 dark:text-surface-100 text-base sm:text-lg tracking-tight block">
                LiveBus
              </span>
              <span className="text-[11px] text-surface-500 dark:text-surface-400 font-medium hidden sm:block -mt-0.5">
                Campus Transit
              </span>
            </div>
          </Link>

          {/* Connection status indicator chip */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            connected
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700'
          }`}>
            {connected ? (
              <>
                <span className="live-dot" />
                <span>Live Feed</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-surface-500" />
                <span>Reconnecting</span>
              </>
            )}
          </div>
        </div>

        {/* Header Navigation Actions */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle Button (Light/Dark) */}
          <ThemeToggle />

          <Link
            to="/events"
            state={location.state}
            className="btn-secondary rounded-full py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-surface-600 dark:text-surface-400" />
            <span>Events</span>
          </Link>

          {isAuthenticated && user?.role === 'admin' ? (
            <Link
              to="/admin"
              id="admin-dashboard-nav-btn"
              className="btn-primary rounded-full py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 shadow-soft-xs bg-primary-700 hover:bg-primary-800"
              title="Return to Admin Dashboard"
            >
              <Shield className="w-3.5 h-3.5 text-primary-200" />
              <span>Admin Dashboard</span>
            </Link>
          ) : isAuthenticated && user?.role === 'driver' ? (
            <Link
              to="/driver"
              id="driver-portal-nav-btn"
              className="btn-primary rounded-full py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 shadow-soft-xs"
              title="Return to Driver Portal"
            >
              <Bus className="w-3.5 h-3.5" />
              <span>Driver Console</span>
            </Link>
          ) : (
            <Link
              to="/login"
              id="portal-login-nav-btn"
              className="btn-primary rounded-full py-1.5 px-4 text-xs font-semibold flex items-center gap-1.5 shadow-soft-xs"
              title="Sign in to Admin or Driver Portal"
            >
              <span>Portal Sign In</span>
            </Link>
          )}
        </div>
      </header>

      {/* Map + Panel Layout */}
      <div className="flex-1 map-layout overflow-hidden relative">
        {/* Side Panel (Desktop) */}
        <aside className="bg-white dark:bg-[#28292c] border-r border-surface-200 dark:border-surface-800 overflow-y-auto flex-col hidden md:flex shadow-soft-xs z-10 transition-colors duration-150">
          {/* Route Chips */}
          <div className="p-5 border-b border-surface-200 dark:border-surface-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title mb-0">Active Campus Routes</h2>
              <span className="text-xs font-medium text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full">
                {routes.length} total
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {routes.map(route => {
                const busCount = activeBuses.filter(b => b.routeId === route._id).length;
                const isSelected = selectedRouteId === route._id;

                return (
                  <button
                    key={route._id}
                    id={`route-chip-${route._id}`}
                    onClick={() => {
                      setSelectedRouteId(route._id);
                      focusRoute(route._id);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                      isSelected
                        ? 'bg-primary-50/80 dark:bg-primary-950/60 border-2 border-primary-600 dark:border-primary-400 shadow-soft-xs'
                        : 'bg-surface-50/70 dark:bg-surface-800/60 border border-surface-200/80 dark:border-surface-700/80 hover:bg-surface-100 dark:hover:bg-surface-700/70 hover:border-surface-300 dark:hover:border-surface-600'
                    }`}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: route.color || '#1a73e8' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${
                        isSelected ? 'text-primary-900 dark:text-primary-200' : 'text-surface-800 dark:text-surface-200'
                      }`}>
                        {route.name}
                      </div>
                      <div className="text-xs text-surface-500 dark:text-surface-400 font-medium">
                        {route.stops?.length || 0} stops {route.type === 'event' && '• Event Shuttle'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {busCount > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60">
                          <span className="live-dot" />
                          <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">{busCount}</span>
                        </div>
                      )}
                      <ChevronRight className={`w-4 h-4 transition-transform ${
                        isSelected ? 'text-primary-600 dark:text-primary-400 translate-x-0.5' : 'text-surface-400 dark:text-surface-500'
                      }`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ETAs Panel */}
          {selectedRoute && (
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <h2 className="section-title mb-0">Upcoming Stop ETAs</h2>
                  <div className="text-xs text-surface-500 dark:text-surface-400 font-medium mt-0.5">{selectedRoute.name}</div>
                </div>
                {selectedBuses.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span className="live-dot" />
                    <span>{selectedBuses.length} active</span>
                  </div>
                )}
              </div>

              {/* Now Driving per active bus */}
              {selectedBuses.length > 0 && (
                <div className="mb-4 p-3 rounded-2xl bg-surface-50/80 dark:bg-surface-800/60 border border-surface-200/80 dark:border-surface-700/70 space-y-2">
                  <div className="text-[11px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                    Now Driving
                  </div>
                  <div className="space-y-1.5">
                    {selectedBuses.map((bus) => (
                      <button
                        key={bus.tripId}
                        type="button"
                        onClick={() => {
                          setInspectedBus(bus);
                          if (bus.lat && bus.lng) setMapCenter([bus.lat, bus.lng]);
                        }}
                        className="w-full text-left p-2 bg-white dark:bg-[#1f1f23] rounded-xl border border-surface-200 dark:border-surface-700 shadow-soft-xs hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-soft-sm transition-all cursor-pointer"
                      >
                        <DriverChip
                          driver={drivers[bus.tripId] || { name: 'Assigned Driver' }}
                          busLabel={bus.busName || `Bus #${String(bus.busId || '').slice(-6) || 'Live'}`}
                        />
                        <div className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold mt-1 pl-0.5">
                          Tap to view live details
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedEtas.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200/80 dark:border-surface-700/60">
                  <div className="w-10 h-10 rounded-full bg-surface-200/60 dark:bg-surface-700 flex items-center justify-center mx-auto mb-2 text-surface-500 dark:text-surface-400">
                    <Bus className="w-5 h-5" />
                  </div>
                  <p className="text-surface-800 dark:text-surface-200 text-sm font-semibold">No active buses on this route</p>
                  <p className="text-surface-500 dark:text-surface-400 text-xs mt-1 max-w-xs mx-auto">
                    Buses appear automatically when drivers begin telemetry or simulator is running.
                  </p>
                </div>
              ) : (
                selectedEtas.map(({ tripId, etas: etaList }) => {
                  const liveBus = activeBuses.find(b => b.tripId === tripId);
                  const displayName = liveBus?.busName || `Bus #${String(liveBus?.busId || tripId).slice(-6)}`;
                  return (
                    <div key={tripId} className="mb-4">
                      <EtaList etas={etaList} busName={displayName} />
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Footer Controls */}
          <div className="p-4 border-t border-surface-200 dark:border-surface-800 mt-auto bg-surface-50/50 dark:bg-surface-800/40 space-y-2">
            <button
              id="nearest-stop-btn"
              onClick={handleNearestStop}
              className="btn-secondary w-full text-xs justify-center py-2.5 font-semibold rounded-full"
            >
              <Navigation className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              <span>Find Nearest Stop</span>
            </button>
            <Link
              to="/admin"
              className="text-xs text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 font-medium py-1 w-full text-center flex items-center justify-center gap-1 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Control Center</span>
            </Link>
          </div>
        </aside>

        {/* Map Area */}
        <div className="relative w-full h-full">
          {/* Mobile Floating Route Chips (bottom) */}
          <div className="absolute bottom-4 left-3 right-3 z-[900] flex gap-2 overflow-x-auto pb-1 md:hidden">
            <div className="flex gap-2 p-1.5 rounded-full bg-white/95 dark:bg-[#28292c]/95 backdrop-blur-md border border-surface-200 dark:border-surface-700 shadow-soft-md w-full">
              {routes.map(route => {
                const isSelected = selectedRouteId === route._id;
                return (
                  <button
                    key={route._id}
                    id={`mobile-route-${route._id}`}
                    onClick={() => {
                      setSelectedRouteId(route._id);
                      focusRoute(route._id);
                    }}
                    className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-primary-600 text-white shadow-soft-xs'
                        : 'bg-transparent text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: isSelected ? '#ffffff' : (route.color || '#1a73e8') }}
                    />
                    <span>{route.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Announcement Banner */}
          <AnnouncementBanner routeId={selectedRouteId} />

          {/* Interactive Leaflet Map */}
          <LiveMap
            routes={routes}
            stops={stops}
            buses={activeBuses}
            selectedRouteId={selectedRouteId}
            flyTo={mapCenter}
            onStopClick={setSelectedStop}
            onBusClick={(bus) => {
              setInspectedBus(bus);
              if (bus.lat && bus.lng) setMapCenter([bus.lat, bus.lng]);
            }}
          />
        </div>
      </div>

      {/* Toast Notification */}
      {/* Active Bus Drawer — opens when a bus marker or sidebar card is clicked */}
      <ActiveBusDrawer
        isOpen={Boolean(inspectedBus)}
        onClose={() => setInspectedBus(null)}
        bus={inspectedBus
          ? (activeBuses.find(b => b.tripId === inspectedBus.tripId) || inspectedBus)
          : null
        }
        route={inspectedBus
          ? routes.find(r => r._id === (inspectedBus.routeId || selectedRouteId))
          : null
        }
        onFocusMap={(coords) => setMapCenter(coords)}
      />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] bg-surface-900/90 dark:bg-surface-100/90 text-white dark:text-surface-900 text-xs font-semibold px-4 py-2.5 rounded-full shadow-soft-lg flex items-center gap-2 pointer-events-none transition-all"
        >
          <AlertCircle className="w-4 h-4 text-google-yellow flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
