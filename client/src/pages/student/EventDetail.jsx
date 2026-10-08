import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Clock, Bus, Radio, AlertCircle, ChevronRight } from 'lucide-react';
import { eventsApi, stopsApi } from '../../api/index.js';
import EventBadge from '../../components/EventBadge.jsx';
import LiveMap from '../../components/map/LiveMap.jsx';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';
import AnnouncementBanner from '../../components/AnnouncementBanner.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';
import BackToAdmin from '../../components/BackToAdmin.jsx';
import DriverChip from '../../components/DriverChip.jsx';
import { useLiveBusStore } from '../../store/liveBusStore.js';
import { getSocket } from '../../socket/socket.js';
import { useLiveBuses } from '../../hooks/useLiveBuses.js';
import { useMapFocusStore } from '../../store/mapFocusStore.js';

export default function EventDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [eventData, setEventData] = useState(null);
  const [eventStops, setEventStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shuttleInfo, setShuttleInfo] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const focusRoute = useMapFocusStore((state) => state.focusRoute);
  const focusStop = useMapFocusStore((state) => state.focusStop);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const { buses, drivers } = useLiveBusStore();
  const eventRouteIds = (eventData?.routes || []).map(route => route._id);
  useLiveBuses(eventRouteIds);

  useEffect(() => {
    Promise.all([
      eventsApi.get(id),
      stopsApi.list().catch(() => ({ data: [] })),
    ])
      .then(([res, stopsRes]) => {
        setEventData(res.data);
        const allStops = stopsRes.data || [];
        const related = allStops.filter(s =>
          String(s.eventId?._id || s.eventId) === String(id)
        );
        setEventStops(related);

        const routes = res.data?.routes || [];
        const fRoute = searchParams.get('focusRoute');
        const fStop = searchParams.get('focusStop');

        let targetRouteToSelect = null;
        if (fRoute) {
          const found = routes.find(r => r._id === fRoute || r.id === fRoute);
          if (found) {
            targetRouteToSelect = found._id;
            focusRoute(found._id);
          } else {
            showToast('Route not found');
          }
        } else if (fStop) {
          const parentRoute = routes.find(r =>
            (r.stops || []).some(s => String(s.stopId?._id || s.stopId || s._id) === String(fStop))
          );
          if (parentRoute) {
            targetRouteToSelect = parentRoute._id;
          }
          focusStop(fStop);
        }

        if (targetRouteToSelect) {
          setSelectedRouteId(targetRouteToSelect);
        } else if (routes.length > 0) {
          setSelectedRouteId(routes[0]._id);
        }

        if (fRoute || fStop) {
          const next = new URLSearchParams(searchParams);
          next.delete('focusRoute');
          next.delete('focusStop');
          setSearchParams(next, { replace: true, state: location.state });
        }
      })
      .catch(err => {
        console.error('Failed to load event:', err);
        setError('Failed to load event details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // React to query parameter changes when event is loaded
  useEffect(() => {
    if (loading || !eventData) return;
    const routes = eventData.routes || [];
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
        (r.stops || []).some(s => (s.stopId?._id || s.stopId || s._id) === fStop)
      );
      if (parentRoute) {
        setSelectedRouteId(parentRoute._id);
      }
      focusStop(fStop);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('focusRoute');
    next.delete('focusStop');
    setSearchParams(next, { replace: true, state: location.state });
  }, [searchParams, loading, eventData]);

  // Subscribe to event socket room
  useEffect(() => {
    const socket = getSocket();
    socket.emit('event:subscribe', { eventId: id });

    const handleShuttleUpdate = (payload) => {
      if (payload.eventId === id) {
        setShuttleInfo(payload);
      }
    };

    socket.on('event:shuttle', handleShuttleUpdate);

    return () => {
      socket.off('event:shuttle', handleShuttleUpdate);
    };
  }, [id]);

  if (loading) return <LoadingSpinner fullscreen />;
  if (error || !eventData) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-surface-50 text-center font-sans">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-google-red flex items-center justify-center mb-3">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-surface-900 mb-1">Event Not Found</h2>
        <p className="text-surface-600 text-sm mb-6">{error || 'This campus event could not be found.'}</p>
        <Link to="/events" state={location.state} className="btn-primary">
          Back to Events List
        </Link>
      </div>
    );
  }

  const { event, routes = [], activeTrips = [] } = eventData;
  const liveBuses = Object.values(buses).filter(bus => eventRouteIds.includes(bus.routeId));
  const venueCoords = event.venueLocation?.coordinates ? [event.venueLocation.coordinates[1], event.venueLocation.coordinates[0]] : null;

  // Flatten all stops from event routes plus standalone event stops
  const routeStops = routes.flatMap(r => r.stops?.map(s => s.stopId || s) || []).filter(Boolean);
  const stops = [...eventStops, ...routeStops];

  return (
    <div className="h-dvh flex flex-col bg-surface-50 dark:bg-[#1f1f1f] text-surface-900 dark:text-surface-100 font-sans overflow-hidden transition-colors duration-150">
      {/* Top Header Navbar */}
      <header className="bg-white dark:bg-[#28292c] border-b border-surface-200 dark:border-surface-800 px-4 sm:px-6 py-3 flex items-center justify-between z-40 flex-shrink-0 shadow-soft-xs transition-colors duration-150">
        <div className="flex items-center gap-4 min-w-0">
          <BackToAdmin />
          <Link
            to="/events"
            state={location.state}
            className="p-2 rounded-full text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors flex-shrink-0"
            title="Back to Events"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <EventBadge event={event} />
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60">
                Shuttle Service
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-surface-900 dark:text-surface-100 truncate">{event.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0 ml-4">
          <ThemeToggle />
        </div>
      </header>

      <AnnouncementBanner eventId={event._id} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden relative">
        {/* Left Column: Details & Shuttle Status */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-full bg-white dark:bg-[#28292c] border-r border-surface-200 dark:border-surface-800 shadow-soft-xs z-10 transition-colors duration-150">
          {/* Headway Status Card */}
          <div className="bg-primary-50/70 dark:bg-primary-950/40 border border-primary-200/80 dark:border-primary-800/60 p-5 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 animate-pulse" /> Live Shuttle Headway
              </span>
              <span className="text-xs font-semibold text-primary-800 dark:text-primary-200 bg-white dark:bg-[#28292c] px-2.5 py-0.5 rounded-full border border-primary-200/60 dark:border-primary-800/60 shadow-soft-xs">
                {activeTrips.length} active {activeTrips.length === 1 ? 'shuttle' : 'shuttles'}
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight">
              {shuttleInfo?.nextShuttleInMin != null ? (
                <span>Next shuttle in <span className="text-primary-600 dark:text-primary-400 font-black">{shuttleInfo.nextShuttleInMin} min</span></span>
              ) : routes[0]?.eventMode?.headwayMin ? (
                <span>Every <span className="text-primary-600 dark:text-primary-400 font-black">~{routes[0].eventMode.headwayMin} min</span></span>
              ) : (
                <span>Continuous Loop Service</span>
              )}
            </div>
            <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed font-medium">
              High-frequency transit loop connecting university halls directly with {event.venueName}.
            </p>
          </div>

          {/* Details Card */}
          <div className="rounded-3xl bg-surface-50/60 dark:bg-surface-800/50 border border-surface-200/80 dark:border-surface-700 p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-surface-600 dark:text-surface-400">Event Details</h2>
            
            {event.description && (
              <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">{event.description}</p>
            )}

            <div className="space-y-3 pt-3 border-t border-surface-200 dark:border-surface-700">
              <div
                onClick={() => venueCoords && setMapCenter([...venueCoords])}
                className={`flex items-start gap-3 text-sm p-2 -mx-2 rounded-xl transition-colors ${
                  venueCoords ? 'cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700/60' : ''
                }`}
                title={venueCoords ? 'Click to focus venue on map' : undefined}
              >
                <MapPin className="w-4 h-4 text-google-red flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-surface-900 dark:text-surface-100 flex items-center justify-between">
                    <span>{event.venueName}</span>
                    {venueCoords && (
                      <span className="text-[11px] text-primary-600 dark:text-primary-400 font-medium">Focus map</span>
                    )}
                  </div>
                  <div className="text-xs text-surface-500 dark:text-surface-400">Dedicated Shuttle Station & Drop Zone</div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
                <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                <span>
                  {new Date(event.startsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(event.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {event.shuttleWindow?.from && (
                <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
                  <Clock className="w-4 h-4 text-google-green flex-shrink-0" />
                  <span>
                    Shuttles active: {new Date(event.shuttleWindow.from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.shuttleWindow.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Live Shuttles List */}
          {liveBuses.length > 0 && (
            <div className="rounded-3xl bg-surface-50/60 dark:bg-surface-800/50 border border-surface-200/80 dark:border-surface-700 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-surface-600 dark:text-surface-400">
                  Live Shuttles ({liveBuses.length})
                </h2>
                <span className="badge-success text-[10px]">
                  <span className="live-dot" /> Live
                </span>
              </div>
              <div className="space-y-2">
                {liveBuses.map((bus) => (
                  <div
                    key={bus.tripId}
                    className="p-3 bg-white dark:bg-[#1f1f1f] rounded-2xl border border-surface-200/90 dark:border-surface-700 shadow-soft-xs flex items-center justify-between"
                  >
                    <DriverChip
                      driver={drivers[bus.tripId] || { name: 'Assigned Driver' }}
                      busLabel={`Bus #${bus.busId?.slice(-6) || ''}`}
                    />
                    <div className="text-right text-xs font-mono text-surface-500 dark:text-surface-400">
                      {Math.round(bus.speedKmh || 0)} km/h
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shuttle Routes List */}
          <div className="rounded-3xl bg-surface-50/60 dark:bg-surface-800/50 border border-surface-200/80 dark:border-surface-700 p-5 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-surface-600 dark:text-surface-400">
              Assigned Shuttle Routes ({routes.length})
            </h2>
            <div className="space-y-2">
              {routes.map(route => (
                <div
                  key={route._id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#1f1f1f] hover:bg-surface-50 dark:hover:bg-surface-800 border border-surface-200/90 dark:border-surface-700 shadow-soft-xs transition-all group"
                >
                  <div
                    onClick={() => focusRoute(route._id)}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    title="Click to focus route on map"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0"
                      style={{ backgroundColor: route.color || '#1a73e8' }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                        {route.name}
                      </div>
                      <div className="text-xs text-surface-500 dark:text-surface-400 font-medium">
                        {route.stops?.length || 0} stops on loop
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => focusRoute(route._id)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 hover:text-primary-600 transition-colors"
                    >
                      Focus
                    </button>
                    <Link
                      to={`/routes/${route._id}`}
                      className="p-1 rounded-full text-surface-400 hover:text-primary-600 transition-colors"
                      title="View Route Details"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Map */}
        <div className="lg:col-span-2 relative h-[450px] lg:h-auto min-h-[400px]">
          <LiveMap
            routes={routes}
            buses={liveBuses}
            stops={stops}
            selectedRouteId={selectedRouteId || routes[0]?._id}
            center={venueCoords || [28.6139, 77.2090]}
            zoom={14}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] bg-surface-900/90 dark:bg-surface-100/90 text-white dark:text-surface-900 text-xs font-semibold px-4 py-2.5 rounded-full shadow-soft-lg flex items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          <AlertCircle className="w-4 h-4 text-google-yellow flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
