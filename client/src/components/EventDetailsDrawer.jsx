import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  Route as RouteIcon,
  Bus,
  Activity,
  Edit,
  ExternalLink,
  Navigation,
  Gauge,
  User,
  AlertCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

import Drawer from './ui/Drawer.jsx';
import EventBadge from './EventBadge.jsx';
import { eventsApi } from '../api/index.js';
import { useLiveBusStore } from '../store/liveBusStore.js';
import { useMapFocusStore } from '../store/mapFocusStore.js';
import { mapLink } from '../utils/mapLinks.js';

// Venue pin marker icon for Leaflet mini-map
const venuePinIcon = new L.DivIcon({
  className: 'venue-marker-pin',
  html: `
    <div style="
      background-color: #ea4335;
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    ">
      <div style="
        width: 10px;
        height: 10px;
        background-color: white;
        border-radius: 50%;
        transform: rotate(45deg);
      "></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

export default function EventDetailsDrawer({
  isOpen,
  onClose,
  eventId,
  onEdit,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { focusRoute } = useMapFocusStore();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Live bus store for real-time updates
  const liveBuses = useLiveBusStore((state) => state.buses);
  const liveDrivers = useLiveBusStore((state) => state.drivers);

  const fetchEvent = async () => {
    if (!eventId || !isOpen) return;
    try {
      setLoading(true);
      const res = await eventsApi.get(eventId, { include: 'routes,activeBuses' });
      setEventData(res.data);
    } catch (err) {
      console.error('Failed to load event details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId, isOpen]);

  if (!eventData && !loading) return null;

  const event = eventData?.event;
  const routes = eventData?.routes || [];
  const activeBuses = eventData?.activeBuses || [];

  const venueCoords = event?.venueLocation?.coordinates
    ? [event.venueLocation.coordinates[1], event.venueLocation.coordinates[0]] // [lat, lng]
    : null;

  const handleOpenPublicPage = () => {
    if (!event) return;
    navigate(`/events/${event._id}`, { state: { from: location.pathname + location.search } });
  };

  const handleFocusOnMap = () => {
    if (!event) return;
    navigate(mapLink({ eventId: event._id }), { state: { from: location.pathname + location.search } });
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={event?.title || 'Event Details'}
      subtitle={event?.venueName || 'Campus Event Shuttle Service'}
    >
      {loading && !event ? (
        <div className="p-8 text-center text-xs text-surface-500">Loading event specifications...</div>
      ) : event ? (
        <div className="space-y-6 text-sm font-sans">
          {/* Header Status & Dates */}
          <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <EventBadge event={event} />
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                  event.isPublished
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700'
                }`}
              >
                {event.isPublished ? 'Published' : 'Draft'}
              </span>
            </div>

            {event.description && (
              <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed pt-1">
                {event.description}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-surface-200/80 dark:border-surface-700/80">
              <div className="p-2.5 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700">
                <div className="text-[11px] text-surface-500 dark:text-surface-400 mb-0.5">Event Start</div>
                <div className="font-semibold text-surface-900 dark:text-surface-100">
                  {new Date(event.startsAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <div className="p-2.5 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700">
                <div className="text-[11px] text-surface-500 dark:text-surface-400 mb-0.5">Event Conclusion</div>
                <div className="font-semibold text-surface-900 dark:text-surface-100">
                  {new Date(event.endsAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: VENUE & MINI MAP */}
          <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-google-red" />
                <span>Venue Location</span>
              </div>

              <button
                type="button"
                onClick={handleFocusOnMap}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                <Navigation className="w-3 h-3" />
                <span>Focus on map</span>
              </button>
            </div>

            <div className="text-sm font-bold text-surface-900 dark:text-surface-100">
              {event.venueName}
            </div>

            {/* Non-interactive Mini Map */}
            {venueCoords ? (
              <div className="relative rounded-2xl overflow-hidden border border-surface-200 dark:border-surface-700 shadow-soft-xs h-40 w-full z-0">
                <MapContainer
                  center={venueCoords}
                  zoom={15}
                  scrollWheelZoom={false}
                  dragging={false}
                  zoomControl={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                  attributionControl={false}
                  className="h-full w-full"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={venueCoords} icon={venuePinIcon} />
                </MapContainer>
              </div>
            ) : (
              <div className="p-4 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 text-center text-xs text-surface-400">
                No venue coordinates specified.
              </div>
            )}
          </section>

          {/* SECTION: SHUTTLE SERVICE & LINKED ROUTES */}
          <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                <span>Shuttle Service Window</span>
              </div>
            </div>

            {event.shuttleWindow?.from && (
              <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 text-xs text-surface-700 dark:text-surface-300">
                Operating Window: <strong className="text-surface-900 dark:text-surface-100">
                  {new Date(event.shuttleWindow.from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.shuttleWindow.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </strong>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <div className="text-xs font-semibold text-surface-600 dark:text-surface-400">
                Linked Shuttle Lines ({routes.length})
              </div>

              {routes.length === 0 ? (
                <div className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 text-center text-xs text-surface-400">
                  No routes linked to this event.
                </div>
              ) : (
                routes.map((r) => {
                  const isRouteActive = r.eventMode?.enabled ?? false;
                  return (
                    <div
                      key={r._id}
                      className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: r.color || '#1a73e8' }}
                        />
                        <span className="font-bold text-surface-900 dark:text-surface-100 truncate">
                          {r.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.eventMode?.headwayMin && (
                          <span className="badge bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-semibold flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            ~{r.eventMode.headwayMin} min
                          </span>
                        )}
                        <span
                          className={`badge text-[10px] font-bold uppercase tracking-wider ${
                            isRouteActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700'
                          }`}
                        >
                          {isRouteActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* SECTION: ACTIVE BUSES (LIVE) */}
          <section className="bg-surface-50 dark:bg-surface-800/50 p-4 rounded-3xl border border-surface-200 dark:border-surface-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
                <Bus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Active Shuttles ({activeBuses.length})</span>
              </div>
              {activeBuses.length > 0 && (
                <span className="badge bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold animate-pulse">
                  Live Broadcasting
                </span>
              )}
            </div>

            {activeBuses.length === 0 ? (
              <div className="p-6 bg-white dark:bg-[#1f1f23] rounded-2xl border border-surface-200 dark:border-surface-700 text-center text-xs text-surface-500 dark:text-surface-400">
                No shuttles running right now
              </div>
            ) : (
              <div className="space-y-2">
                {activeBuses.map((shuttle) => {
                  const live = liveBuses[shuttle.tripId] || shuttle;
                  const pingAge = live?.updatedAt
                    ? Math.max(0, Math.round((Date.now() - new Date(live.updatedAt).getTime()) / 1000))
                    : null;

                  const driverInfo = liveDrivers[shuttle.tripId || shuttle._id] || shuttle.driver || shuttle.driverSnapshot;
                  const driverName = driverInfo?.name || 'Assigned Driver';
                  const driverPhone = driverInfo?.phone || '';
                  const driverLicense = driverInfo?.license || '';
                  const driverPhotoUrl = driverInfo?.photoUrl || (shuttle.tripId ? `/api/trips/${shuttle.tripId}/driver-photo` : null);

                  return (
                    <div
                      key={shuttle._id || shuttle.tripId}
                      className="p-3 bg-white dark:bg-[#1f1f23] rounded-2xl border border-emerald-200/80 dark:border-emerald-800/80 text-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 border border-surface-200 dark:border-surface-700 text-[11px]">
                            {shuttle.bus?.plateNo || 'Vehicle'}
                          </span>
                          <span className="font-bold text-surface-900 dark:text-surface-100">
                            {shuttle.bus?.name || 'Event Shuttle'}
                          </span>
                        </div>

                        {pingAge !== null && (
                          <span className="text-[10px] text-surface-400">
                            Ping: {pingAge}s ago
                          </span>
                        )}
                      </div>

                      {/* Driver Details with Photo */}
                      <div className="p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200/80 dark:border-surface-700/80 flex items-center gap-2.5">
                        <div className="relative w-9 h-9 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-950/80 border border-emerald-500 flex-shrink-0 flex items-center justify-center shadow-soft-xs">
                          {driverPhotoUrl ? (
                            <img
                              src={driverPhotoUrl}
                              alt={driverName}
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
                            style={{ display: driverPhotoUrl ? 'none' : 'flex' }}
                            className="w-full h-full items-center justify-center font-bold text-[11px] text-primary-800 dark:text-primary-200"
                          >
                            {driverName.slice(0, 2).toUpperCase()}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-surface-900 dark:text-surface-100 text-xs truncate">
                            {driverName}
                          </div>
                          <div className="text-[10px] text-surface-500 dark:text-surface-400 flex items-center gap-1.5 font-mono">
                            {driverPhone ? (
                              <a href={`tel:${driverPhone}`} className="hover:underline text-primary-600 dark:text-primary-400">
                                Tel: {driverPhone}
                              </a>
                            ) : (
                              <span>Tel: —</span>
                            )}
                            <span>•</span>
                            <span>Lic: {driverLicense || '—'}</span>
                          </div>
                        </div>

                        <div className="text-right text-[11px] font-semibold text-surface-700 dark:text-surface-300">
                          {live.speedKmh ? `${Math.round(live.speedKmh)} km/h` : '0 km/h'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Action Toolbar */}
          <div className="pt-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleOpenPublicPage}
              className="btn-subtle px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open public page</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onEdit) onEdit(event);
              }}
              className="btn-primary px-4 py-2 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-soft-xs"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Event</span>
            </button>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
