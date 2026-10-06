import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Edit,
  MapPin,
  Clock,
  Sparkles,
  Route,
  CheckCircle,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { eventsApi, routesApi } from '../../api/index.js';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';
import EventBadge from '../../components/EventBadge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import EventDetailsDrawer from '../../components/EventDetailsDrawer.jsx';

export default function EventsAdmin() {
  const [events, setEvents] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const eventIdParam = searchParams.get('eventId');

  // Drawer state (Feature 5 & Feature A URL sync)
  const [selectedEventId, setSelectedEventId] = useState(null);

  useEffect(() => {
    if (eventIdParam) {
      setSelectedEventId(eventIdParam);
    } else {
      setSelectedEventId(null);
    }
  }, [eventIdParam]);

  const handleOpenEventDrawer = (eventId) => {
    setSelectedEventId(eventId);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('eventId', eventId);
    setSearchParams(newParams);
  };

  const handleCloseEventDrawer = () => {
    setSelectedEventId(null);
    if (searchParams.has('eventId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('eventId');
      setSearchParams(newParams);
    }
  };

  // Modal form state
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    venueName: '',
    venueLat: 28.6139,
    venueLng: 77.2090,
    startsAt: '',
    endsAt: '',
    shuttleFrom: '',
    shuttleUntil: '',
    routeIds: [],
    isPublished: true,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [eRes, rRes] = await Promise.all([
        eventsApi.listAll ? eventsApi.listAll() : eventsApi.list(),
        routesApi.list(),
      ]);
      setEvents(eRes.data || []);
      setRoutes(rRes.data || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingEvent(null);
    const now = new Date();
    const later = new Date(Date.now() + 4 * 3600000);
    setFormData({
      title: '',
      description: '',
      venueName: '',
      venueLat: 28.6139,
      venueLng: 77.2090,
      startsAt: now.toISOString().slice(0, 16),
      endsAt: later.toISOString().slice(0, 16),
      shuttleFrom: new Date(Date.now() - 1800000).toISOString().slice(0, 16),
      shuttleUntil: later.toISOString().slice(0, 16),
      routeIds: [],
      isPublished: true,
    });
    setShowModal(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      venueName: event.venueName,
      venueLat: event.venueLocation?.coordinates?.[1] || 28.6139,
      venueLng: event.venueLocation?.coordinates?.[0] || 77.2090,
      startsAt: event.startsAt ? new Date(event.startsAt).toISOString().slice(0, 16) : '',
      endsAt: event.endsAt ? new Date(event.endsAt).toISOString().slice(0, 16) : '',
      shuttleFrom: event.shuttleWindow?.from ? new Date(event.shuttleWindow.from).toISOString().slice(0, 16) : '',
      shuttleUntil: event.shuttleWindow?.until ? new Date(event.shuttleWindow.until).toISOString().slice(0, 16) : '',
      routeIds: event.routeIds?.map(r => (typeof r === 'object' ? r._id : r)) || [],
      isPublished: Boolean(event.isPublished),
    });
    setShowModal(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        venueName: formData.venueName.trim(),
        venueLocation: {
          type: 'Point',
          coordinates: [Number(formData.venueLng), Number(formData.venueLat)],
        },
        startsAt: new Date(formData.startsAt).toISOString(),
        endsAt: new Date(formData.endsAt).toISOString(),
        shuttleWindow: {
          from: new Date(formData.shuttleFrom).toISOString(),
          until: new Date(formData.shuttleUntil).toISOString(),
        },
        routeIds: formData.routeIds,
        isPublished: formData.isPublished,
      };

      if (editingEvent) {
        await eventsApi.update(editingEvent._id, payload);
      } else {
        await eventsApi.create(payload);
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save event:', err);
      alert(err.response?.data?.error?.message || 'Failed to save event.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      setActionLoading(true);
      await eventsApi.delete(id);
      if (selectedEventId === id || eventIdParam === id) {
        handleCloseEventDrawer();
      }
      await loadData();
    } catch (err) {
      console.error('Failed to delete event:', err);
      alert('Failed to delete event.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleRouteSelection = (routeId) => {
    setFormData(prev => {
      const exists = prev.routeIds.includes(routeId);
      return {
        ...prev,
        routeIds: exists ? prev.routeIds.filter(id => id !== routeId) : [...prev.routeIds, routeId],
      };
    });
  };

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight flex items-center gap-3">
            <Calendar className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            Events & Shuttle Windows
          </h1>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
            Host campus games, symposiums, and festivals with live headway shuttle tracking
          </p>
        </div>

        <button
          onClick={openCreateModal}
          id="create-event-btn"
          className="btn-primary rounded-full py-2.5 px-5 text-sm font-semibold flex items-center gap-2 self-start sm:self-auto shadow-soft-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Event</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {events.map((event) => (
          <div
            key={event._id}
            onClick={() => handleOpenEventDrawer(event._id)}
            className="bg-white dark:bg-[#28292c] p-6 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xs space-y-4 flex flex-col justify-between hover:shadow-soft-md transition-all cursor-pointer group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <EventBadge event={event} />
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                  event.isPublished
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700'
                }`}>
                  {event.isPublished ? 'Published' : 'Draft'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100 mb-1.5 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {event.title}
              </h3>
              {event.description && (
                <p className="text-xs text-surface-600 dark:text-surface-400 line-clamp-2 mb-3 leading-relaxed">
                  {event.description}
                </p>
              )}

              <div className="space-y-2 text-xs text-surface-600 dark:text-surface-400 pt-3 border-t border-surface-100 dark:border-surface-800">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-google-red flex-shrink-0" />
                  <span className="font-semibold text-surface-800 dark:text-surface-200 truncate">{event.venueName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                  <span>
                    {new Date(event.startsAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(event.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Route className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                  <span>{event.routeIds?.length || 0} associated shuttle route(s)</span>
                </div>
              </div>
            </div>

            <div
              className="pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[11px] text-primary-600 dark:text-primary-400 font-semibold group-hover:underline">
                View event drawer →
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(event)}
                  className="p-2 rounded-full text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  title="Edit Event"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteEvent(event._id)}
                  className="p-2 rounded-full text-surface-400 hover:text-google-red hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  title="Delete Event"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FEATURE 5: EVENT DETAILS DRAWER */}
      <EventDetailsDrawer
        isOpen={Boolean(selectedEventId)}
        onClose={handleCloseEventDrawer}
        eventId={selectedEventId}
        onEdit={(ev) => openEditModal(ev)}
      />

      {/* CREATE / EDIT EVENT MODAL */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEvent ? 'Edit Event' : 'Create Campus Event'}
        subtitle="Manage event schedule, venue location, and assigned shuttle lines"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveEvent} className="space-y-4">
          <div>
            <label className="label">Event Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Annual Tech Symposium 2026"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              rows="2"
              placeholder="Information for attending students..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">Venue Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Main Auditorium"
                value={formData.venueName}
                onChange={(e) => setFormData({ ...formData, venueName: e.target.value })}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">Venue Lat</label>
              <input
                type="number"
                step="any"
                required
                value={formData.venueLat}
                onChange={(e) => setFormData({ ...formData, venueLat: parseFloat(e.target.value) })}
                className="input text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">Venue Lng</label>
              <input
                type="number"
                step="any"
                required
                value={formData.venueLng}
                onChange={(e) => setFormData({ ...formData, venueLng: parseFloat(e.target.value) })}
                className="input text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">Starts At</label>
              <input
                type="datetime-local"
                required
                value={formData.startsAt}
                onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">Ends At</label>
              <input
                type="datetime-local"
                required
                value={formData.endsAt}
                onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                className="input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">Shuttles Run From</label>
              <input
                type="datetime-local"
                required
                value={formData.shuttleFrom}
                onChange={(e) => setFormData({ ...formData, shuttleFrom: e.target.value })}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">Shuttles Run Until</label>
              <input
                type="datetime-local"
                required
                value={formData.shuttleUntil}
                onChange={(e) => setFormData({ ...formData, shuttleUntil: e.target.value })}
                className="input text-xs"
              />
            </div>
          </div>

          {/* Shuttle Routes Association */}
          <div>
            <label className="label">Assigned Shuttle Routes</label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {routes.map(r => (
                <label
                  key={r._id}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    formData.routeIds.includes(r._id)
                      ? 'bg-primary-50 dark:bg-primary-950/60 border-primary-300 dark:border-primary-800 text-primary-900 dark:text-primary-200 font-semibold'
                      : 'bg-surface-50 dark:bg-surface-800/60 border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.routeIds.includes(r._id)}
                    onChange={() => toggleRouteSelection(r._id)}
                    className="accent-primary-600"
                  />
                  <span className="truncate">{r.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700">
            <span className="text-xs font-semibold text-surface-900 dark:text-surface-100">Publish to Student App</span>
            <input
              type="checkbox"
              checked={formData.isPublished}
              onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
              className="w-4 h-4 accent-primary-600 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-200 dark:border-surface-800">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn-subtle px-4 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="btn-primary text-xs font-semibold py-2 px-5 rounded-full shadow-soft-xs disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
