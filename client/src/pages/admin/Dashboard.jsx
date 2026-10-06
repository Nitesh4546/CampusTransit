import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Route,
  MapPin,
  Bus,
  Calendar,
  Bell,
  Users,
  Activity,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Send,
  Eye,
  RefreshCw
} from 'lucide-react';
import {
  routesApi,
  stopsApi,
  busesApi,
  eventsApi,
  announcementsApi,
  tripsApi,
  usersApi
} from '../../api/index.js';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';

export default function AdminDashboard() {
  const location = useLocation();
  const [stats, setStats] = useState({
    routesCount: 0,
    stopsCount: 0,
    busesCount: 0,
    eventsCount: 0,
    usersCount: 0,
    activeTrips: [],
    draftAnnouncements: [],
  });
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState(null);

  const fetchStats = async () => {
    try {
      const [
        routesRes,
        stopsRes,
        busesRes,
        eventsRes,
        tripsRes,
        draftsRes,
        usersRes
      ] = await Promise.all([
        routesApi.list(),
        stopsApi.list(),
        busesApi.list(),
        eventsApi.listAll ? eventsApi.listAll() : eventsApi.list(),
        tripsApi.active(),
        announcementsApi.drafts(),
        usersApi.list(),
      ]);

      setStats({
        routesCount: routesRes.data?.length || 0,
        stopsCount: stopsRes.data?.length || 0,
        busesCount: busesRes.data?.length || 0,
        eventsCount: eventsRes.data?.length || 0,
        usersCount: usersRes.data?.length || 0,
        activeTrips: tripsRes.data || [],
        draftAnnouncements: draftsRes.data || [],
      });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handlePublishDraft = async (id) => {
    try {
      setPublishingId(id);
      await announcementsApi.publish(id);
      await fetchStats();
    } catch (err) {
      console.error('Failed to publish draft:', err);
      alert('Failed to publish announcement draft.');
    } finally {
      setPublishingId(null);
    }
  };

  if (loading) return <LoadingSpinner fullscreen />;

  const metricCards = [
    { title: 'Active Trips', value: stats.activeTrips.length, icon: Activity, color: 'text-google-green', bg: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60', link: '/admin/buses' },
    { title: 'Total Routes', value: stats.routesCount, icon: Route, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50/70 dark:bg-primary-950/30 border-primary-200/80 dark:border-primary-800/60', link: '/admin/routes' },
    { title: 'Active Stops', value: stats.stopsCount, icon: MapPin, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60', link: '/admin/stops' },
    { title: 'Bus Fleet', value: stats.busesCount, icon: Bus, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200/80 dark:border-teal-800/60', link: '/admin/buses' },
    { title: 'Events', value: stats.eventsCount, icon: Calendar, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-200/80 dark:border-purple-800/60', link: '/admin/events' },
    { title: 'System Users', value: stats.usersCount, icon: Users, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200/80 dark:border-sky-800/60', link: '/admin/users' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight">System Overview</h1>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">Real-time telemetry and transit operations monitoring</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/announcements"
            className="btn-primary rounded-full py-2 px-4 text-xs font-semibold shadow-soft-xs flex items-center gap-2"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>New Announcement</span>
          </Link>
          <Link
            to="/"
            state={{ from: location.pathname + location.search }}
            className="btn-secondary rounded-full py-2 px-4 text-xs font-semibold flex items-center gap-2"
          >
            <Eye className="w-3.5 h-3.5 text-surface-500 dark:text-surface-400" />
            <span>Live Map</span>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Link
              key={i}
              to={card.link}
              className={`p-5 rounded-3xl border ${card.bg} hover:shadow-soft-sm transition-all flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-surface-600 dark:text-surface-400 uppercase tracking-wider">{card.title}</span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="text-3xl font-black text-surface-900 dark:text-surface-100">{card.value}</div>
            </Link>
          );
        })}
      </div>

      {/* Pending AI Draft Announcements */}
      {stats.draftAnnouncements.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 p-6 rounded-3xl space-y-4 shadow-soft-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-surface-900 dark:text-surface-100">
                  Gemini AI Delay Advisories ({stats.draftAnnouncements.length} Pending)
                </h2>
                <p className="text-xs text-surface-600 dark:text-surface-400">Autonomous traffic slowdown notifications awaiting admin approval</p>
              </div>
            </div>
            <Link to="/admin/announcements" className="text-xs text-amber-800 dark:text-amber-300 font-semibold hover:underline">
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.draftAnnouncements.map((draft) => (
              <div
                key={draft._id}
                className="p-5 rounded-2xl bg-white dark:bg-[#28292c] border border-amber-200 dark:border-amber-800/70 shadow-soft-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                      ✦ {draft.source || 'gemini'}
                    </span>
                    <span className="text-xs text-surface-500 dark:text-surface-400 font-medium">
                      {new Date(draft.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200 leading-snug">{draft.text}</p>
                  {draft.textShort && (
                    <div className="mt-2.5 text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800/60 p-2.5 rounded-xl border border-surface-200/80 dark:border-surface-700">
                      <span className="font-semibold text-surface-700 dark:text-surface-300">Display summary: </span>{draft.textShort}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-100 dark:border-surface-800">
                  <button
                    onClick={() => handlePublishDraft(draft._id)}
                    disabled={publishingId === draft._id}
                    className="btn-success text-xs font-semibold py-1.5 px-3.5 rounded-full flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{publishingId === draft._id ? 'Publishing...' : 'Approve & Broadcast'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Trips Table */}
      <div className="bg-white dark:bg-[#28292c] p-6 sm:p-7 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-google-green dark:text-emerald-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-surface-900 dark:text-surface-100">
                Live Active Bus Trips ({stats.activeTrips.length})
              </h2>
              <p className="text-xs text-surface-500 dark:text-surface-400">Vehicles actively transmitting GPS telemetry</p>
            </div>
          </div>
          <button
            onClick={fetchStats}
            className="btn-secondary rounded-full py-1 px-3 text-xs font-semibold flex items-center gap-1.5"
            title="Refresh active trips"
          >
            <RefreshCw className="w-3.5 h-3.5 text-surface-500 dark:text-surface-400" />
            <span>Refresh</span>
          </button>
        </div>

        {stats.activeTrips.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200/80 dark:border-surface-700 text-surface-500 dark:text-surface-400 text-sm">
            <Bus className="w-10 h-10 mx-auto mb-2 text-surface-400 dark:text-surface-500" />
            <div className="font-semibold text-surface-800 dark:text-surface-200">No active trips running right now</div>
            <div className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">Use the telemetry simulator or a logged-in driver to begin trips.</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-surface-200/90 dark:border-surface-700">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-50/80 dark:bg-surface-800/70 border-b border-surface-200 dark:border-surface-700 text-xs text-surface-600 dark:text-surface-300 uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Bus Vehicle</th>
                  <th className="py-3 px-4 font-semibold">Service Route</th>
                  <th className="py-3 px-4 font-semibold">Assigned Driver</th>
                  <th className="py-3 px-4 font-semibold">Started At</th>
                  <th className="py-3 px-4 font-semibold">Current Progress</th>
                  <th className="py-3 px-4 font-semibold text-right">Live Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200/70 dark:divide-surface-700/60 text-surface-700 dark:text-surface-300">
                {stats.activeTrips.map((trip) => {
                  const bus = typeof trip.busId === 'object' ? trip.busId : null;
                  const route = typeof trip.routeId === 'object' ? trip.routeId : null;
                  const driver = typeof trip.driverId === 'object' ? trip.driverId : null;
                  const driverName = trip.driver?.name || trip.driverSnapshot?.name || driver?.name || 'Driver';
                  const driverPhone = trip.driver?.phone || trip.driverSnapshot?.phone || '';
                  const driverLicense = trip.driver?.license || trip.driverSnapshot?.license || '';
                  const driverPhotoUrl = trip.driver?.photoUrl || (trip.driverPhotoId ? `/api/trips/${trip._id}/driver-photo` : null);

                  return (
                    <tr key={trip._id} className="hover:bg-surface-50/60 dark:hover:bg-surface-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-surface-900 dark:text-surface-100">
                        {bus?.name || 'Bus'}{' '}
                        <span className="text-xs font-normal text-surface-500 dark:text-surface-400">
                          ({bus?.plateNo || trip.busId})
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="badge bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200/80 dark:border-primary-800/60">
                          {route?.name || trip.routeId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="relative w-9 h-9 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-950/80 border border-surface-200 dark:border-surface-700 flex-shrink-0 flex items-center justify-center">
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
                              className="w-full h-full items-center justify-center font-bold text-xs text-primary-800 dark:text-primary-200"
                            >
                              {driverName.slice(0, 2).toUpperCase()}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-surface-900 dark:text-surface-100 truncate">
                              {driverName}
                            </div>
                            <div className="text-[11px] text-surface-500 dark:text-surface-400 flex items-center gap-1.5 font-mono">
                              {driverPhone ? (
                                <a href={`tel:${driverPhone}`} className="hover:underline text-primary-600 dark:text-primary-400">
                                  {driverPhone}
                                </a>
                              ) : (
                                <span>No phone</span>
                              )}
                              <span>•</span>
                              <span>{driverLicense || 'No lic'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-surface-500 dark:text-surface-400">
                        {new Date(trip.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-surface-700 dark:text-surface-300">
                        Stop index #{trip.nextStopIndex ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="badge-success">
                          <span className="live-dot" />
                          <span>Streaming</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
