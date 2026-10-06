import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Clock, Bus, ChevronRight } from 'lucide-react';
import { eventsApi } from '../../api/index.js';
import EventBadge from '../../components/EventBadge.jsx';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';
import BackToAdmin from '../../components/BackToAdmin.jsx';

export default function EventsPage() {
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventsApi.list().then(res => setEvents(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="min-h-dvh bg-surface-50 dark:bg-[#1f1f1f] text-surface-900 dark:text-surface-100 font-sans transition-colors duration-150">
      {/* Top Header Navbar */}
      <header className="bg-white dark:bg-[#28292c] border-b border-surface-200 dark:border-surface-800 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-soft-xs transition-colors duration-150">
        <div className="flex items-center gap-4">
          <BackToAdmin />
          <Link
            to="/"
            state={location.state}
            className="p-2 rounded-full text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            title="Back to Live Map"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-surface-900 dark:text-surface-100 leading-tight">
              Events & Shuttles
            </h1>
            <p className="text-xs text-surface-500 dark:text-surface-400 font-medium">Campus events featuring dedicated loop shuttle service</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <Link
            to="/"
            state={location.state}
            className="btn-secondary rounded-full py-1.5 px-3.5 text-xs font-semibold"
          >
            Live Map
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight">
            Special Campus Events
          </h2>
          <p className="text-surface-600 dark:text-surface-400 text-sm sm:text-base mt-1.5 max-w-xl">
            Live headway tracking, direct routes, and venue stations for campus games, symposiums, and festivals.
          </p>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16 px-6 rounded-3xl bg-white dark:bg-[#28292c] border border-surface-200/90 dark:border-surface-800 shadow-soft-xs max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-400 mx-auto mb-3">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100 mb-1">No upcoming events</h3>
            <p className="text-surface-500 dark:text-surface-400 text-sm max-w-xs mx-auto mb-6">
              There are currently no active or upcoming special events with shuttle service.
            </p>
            <Link to="/" className="btn-secondary">
              Return to Map
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map(event => (
              <Link
                key={event._id}
                to={`/events/${event._id}`}
                state={location.state}
                id={`event-card-${event._id}`}
                className="group block rounded-3xl bg-white dark:bg-[#28292c] border border-surface-200/90 dark:border-surface-800 p-6 sm:p-7 shadow-soft-xs hover:shadow-soft-md hover:border-surface-300 dark:hover:border-surface-700 transition-all duration-150"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <EventBadge event={event} />
                      {event.routeIds?.length > 0 && (
                        <span className="badge bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60">
                          <Bus className="w-3 h-3" />
                          <span>{event.routeIds.length} shuttle route{event.routeIds.length !== 1 ? 's' : ''}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {event.title}
                    </h3>

                    {event.description && (
                      <p className="text-surface-600 dark:text-surface-400 text-sm mt-2 line-clamp-2 leading-relaxed">
                        {event.description}
                      </p>
                    )}

                    <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-surface-600 dark:text-surface-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-google-red" />
                        <span className="font-semibold text-surface-800 dark:text-surface-200">{event.venueName}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-surface-400" />
                        <span>
                          {new Date(event.startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          {' – '}
                          {new Date(event.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="self-end sm:self-center">
                    <span className="btn-secondary rounded-full text-xs font-semibold py-2 px-4 group-hover:bg-primary-50 group-hover:text-primary-700 group-hover:border-primary-200 transition-all flex items-center gap-1">
                      <span>View Shuttles</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
