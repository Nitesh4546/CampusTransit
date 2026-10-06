import React, { useState, useEffect } from 'react';
import {
  Bell,
  Plus,
  Send,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Clock,
  Route,
  MessageSquare,
  Radio,
  RefreshCw,
  X
} from 'lucide-react';
import { announcementsApi, routesApi, tripsApi, eventsApi } from '../../api/index.js';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';

export default function AnnouncementsAdmin() {
  const [announcements, setAnnouncements] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeTrips, setActiveTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Manual create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    kind: 'info',
    text: '',
    textShort: '',
    routeId: '',
    eventId: '',
  });

  // AI Generate modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTripId, setAiTripId] = useState('');
  const [aiReason, setAiReason] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [aRes, dRes, rRes, eRes, tRes] = await Promise.all([
        announcementsApi.list(),
        announcementsApi.drafts(),
        routesApi.list(),
        eventsApi.listAll ? eventsApi.listAll() : eventsApi.list(),
        tripsApi.active(),
      ]);

      setAnnouncements(aRes.data || []);
      setDrafts(dRes.data || []);
      setRoutes(rRes.data || []);
      setEvents(eRes.data || []);
      setActiveTrips(tRes.data || []);

      if (tRes.data?.length > 0) {
        setAiTripId(tRes.data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePublishDraft = async (id) => {
    try {
      setActionLoading(true);
      await announcementsApi.publish(id);
      await loadData();
    } catch (err) {
      console.error('Failed to publish draft:', err);
      alert('Failed to publish draft.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await announcementsApi.create({
        ...createForm,
        routeId: createForm.routeId || null,
        eventId: createForm.eventId || null,
      });
      setShowCreateModal(false);
      setCreateForm({ kind: 'info', text: '', textShort: '', routeId: '', eventId: '' });
      await loadData();
    } catch (err) {
      console.error('Failed to post announcement:', err);
      alert(err.response?.data?.error?.message || 'Failed to post announcement.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateAiDelay = async (e) => {
    e.preventDefault();
    if (!aiTripId) {
      alert('Please select an active trip.');
      return;
    }

    try {
      setActionLoading(true);
      await announcementsApi.generateDelay(aiTripId, aiReason);
      setShowAiModal(false);
      setAiReason('');
      alert('Gemini generated announcement advisory successfully!');
      await loadData();
    } catch (err) {
      console.error('Failed to generate delay notice:', err);
      alert(err.response?.data?.error?.message || 'Failed to generate delay notice.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight flex items-center gap-3">
            <Bell className="w-7 h-7 text-primary-600" />
            Announcements & Alerts
          </h1>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
            Broadcast transit advisories, traffic slowdown notices, and autonomous Gemini AI drafts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAiModal(true)}
            id="ai-generate-delay-btn"
            className="btn-secondary rounded-full py-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 shadow-soft-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Draft Delay (AI)</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            id="create-announcement-btn"
            className="btn-primary rounded-full py-2.5 px-5 text-xs font-semibold flex items-center gap-2 shadow-soft-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Broadcast Notice</span>
          </button>
        </div>
      </div>

      {/* PENDING DRAFTS SECTION */}
      {drafts.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 p-6 rounded-3xl space-y-4 shadow-soft-xs">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200 font-bold text-base">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <span>Pending AI Drafts ({drafts.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drafts.map((d) => (
              <div
                key={d._id}
                className="p-5 rounded-2xl bg-white dark:bg-[#28292c] border border-amber-200 dark:border-amber-800/70 shadow-soft-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="badge bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 font-semibold text-[10px]">
                      Source: {d.source || 'gemini'}
                    </span>
                    <span className="text-xs text-surface-500 dark:text-surface-400 font-medium">
                      {new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 leading-snug">{d.text}</p>
                  {d.textShort && (
                    <div className="mt-2 text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800/60 p-2.5 rounded-xl border border-surface-200 dark:border-surface-700">
                      <span className="font-semibold text-surface-800 dark:text-surface-200">Banner text: </span>{d.textShort}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-surface-100 dark:border-surface-700/60 flex items-center justify-end">
                  <button
                    onClick={() => handlePublishDraft(d._id)}
                    disabled={actionLoading}
                    className="btn-success text-xs font-semibold py-1.5 px-4 rounded-full flex items-center gap-1.5 shadow-soft-xs disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Approve & Broadcast</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PUBLISHED ANNOUNCEMENTS FEED */}
      <div className="bg-white dark:bg-[#28292c] p-6 sm:p-7 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xs space-y-4">
        <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100">Live Broadcast Feed ({announcements.length})</h2>

        {announcements.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 text-xs">
            No announcements currently published.
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => {
              const route = routes.find(r => r._id === (ann.routeId?._id || ann.routeId));
              const event = events.find(e => e._id === (ann.eventId?._id || ann.eventId));

              return (
                <div
                  key={ann._id}
                  className="p-4 rounded-2xl bg-surface-50/70 dark:bg-surface-800/40 border border-surface-200/90 dark:border-surface-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50 dark:hover:bg-surface-800/60 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                        ann.kind === 'delay'
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                          : ann.kind === 'cancellation'
                          ? 'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/60'
                          : ann.kind === 'event'
                          ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800/60'
                          : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border-surface-200 dark:border-surface-700'
                      }`}>
                        {ann.kind}
                      </span>
                      {route && (
                        <span className="text-xs text-primary-700 dark:text-primary-300 font-semibold bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded-full border border-primary-200/60 dark:border-primary-800/60">
                          Route: {route.name}
                        </span>
                      )}
                      {event && (
                        <span className="text-xs text-purple-700 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/60">
                          Event: {event.title}
                        </span>
                      )}
                      <span className="text-xs text-surface-500 dark:text-surface-400 font-medium">
                        {new Date(ann.publishedAt || ann.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-sm text-surface-900 dark:text-surface-100 font-medium">{ann.text}</p>
                    {ann.textShort && (
                      <p className="text-xs text-surface-500 dark:text-surface-400 font-mono">Mobile banner: "{ann.textShort}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-[10px] font-mono text-surface-500 dark:text-surface-400 uppercase px-2 py-1 rounded-md bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 font-semibold">
                      {ann.source || 'manual'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MANUAL CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#28292c] max-w-lg w-full p-6 sm:p-7 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">Broadcast Announcement</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="label">
                  Category / Kind
                </label>
                <select
                  value={createForm.kind}
                  onChange={(e) => setCreateForm({ ...createForm, kind: e.target.value })}
                  className="input cursor-pointer"
                >
                  <option value="info">General Info</option>
                  <option value="delay">Traffic / Route Delay</option>
                  <option value="cancellation">Trip Cancellation</option>
                  <option value="event">Event Shuttle Update</option>
                </select>
              </div>

              <div>
                <label className="label">
                  Announcement Body (Full message for students)
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Route 2 will experience minor 10 min delays due to road construction..."
                  value={createForm.text}
                  onChange={(e) => setCreateForm({ ...createForm, text: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">
                  Short Banner Summary (&lt; 90 chars)
                </label>
                <input
                  type="text"
                  maxLength="90"
                  placeholder="e.g. Route 2 running 10m late"
                  value={createForm.textShort}
                  onChange={(e) => setCreateForm({ ...createForm, textShort: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-surface-600 dark:text-surface-300 mb-1">Route (Optional)</label>
                  <select
                    value={createForm.routeId}
                    onChange={(e) => setCreateForm({ ...createForm, routeId: e.target.value })}
                    className="input text-xs cursor-pointer"
                  >
                    <option value="">All Routes</option>
                    {routes.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-600 dark:text-surface-300 mb-1">Event (Optional)</label>
                  <select
                    value={createForm.eventId}
                    onChange={(e) => setCreateForm({ ...createForm, eventId: e.target.value })}
                    className="input text-xs cursor-pointer"
                  >
                    <option value="">None</option>
                    {events.map(ev => <option key={ev._id} value={ev._id}>{ev.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-200 dark:border-surface-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-subtle px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary text-xs font-semibold py-2 px-5 rounded-full shadow-soft-xs"
                >
                  {actionLoading ? 'Broadcasting...' : 'Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GEMINI AI DELAY GENERATION MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#28292c] max-w-md w-full p-6 sm:p-7 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-lg">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span>AI Delay Advisory Generator</span>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-1 rounded-full text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
              Gemini will craft a calm, clear delay advisory based on the trip's live telemetry and stop ETAs.
            </p>

            <form onSubmit={handleGenerateAiDelay} className="space-y-4">
              <div>
                <label className="label">
                  Select Active Trip
                </label>
                {activeTrips.length === 0 ? (
                  <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 text-xs text-surface-500 dark:text-surface-400 font-medium">
                    No active trips running right now to generate delays for.
                  </div>
                ) : (
                  <select
                    value={aiTripId}
                    onChange={(e) => setAiTripId(e.target.value)}
                    className="input cursor-pointer"
                  >
                    {activeTrips.map(t => (
                      <option key={t._id} value={t._id}>
                        {typeof t.busId === 'object' ? t.busId.name : 'Bus'} — {typeof t.routeId === 'object' ? t.routeId.name : 'Route'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="label">
                  Delay Reason / Context (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Campus construction on Main Street"
                  value={aiReason}
                  onChange={(e) => setAiReason(e.target.value)}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-700">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="btn-subtle px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || activeTrips.length === 0}
                  className="btn-primary text-xs font-semibold py-2 px-5 rounded-full flex items-center gap-1.5 shadow-soft-xs disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{actionLoading ? 'Invoking AI...' : 'Generate with Gemini'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
