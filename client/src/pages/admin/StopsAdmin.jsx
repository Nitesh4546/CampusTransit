import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Edit,
  Sparkles,
  Search,
  CheckCircle,
  ExternalLink,
  Map as MapIcon,
  X
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { stopsApi, eventsApi } from '../../api/index.js';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { mapLink } from '../../utils/mapLinks.js';

function LocationPicker({ position, onChange }) {
  useMapEvents({
    click(e) {
      onChange([e.latlng.lat, e.latlng.lng]);
    },
  });

  if (!position) return null;

  const pinIcon = L.divIcon({
    className: 'custom-pin-icon',
    html: `<div style="background-color: #1a73e8; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(26,115,232,0.6);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  return <Marker position={position} icon={pinIcon} />;
}

export default function StopsAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [stops, setStops] = useState([]);
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingStop, setEditingStop] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    lat: 28.6139,
    lng: 77.2090,
    isEventStop: false,
    eventId: '',
  });

  const loadStops = async () => {
    try {
      setLoading(true);
      const [sRes, eRes] = await Promise.all([
        stopsApi.list(),
        eventsApi.listAll ? eventsApi.listAll() : eventsApi.list(),
      ]);
      setStops(sRes.data || []);
      setEvents(eRes.data || []);
    } catch (err) {
      console.error('Failed to load stops:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStops();
  }, []);

  const openCreateModal = () => {
    setEditingStop(null);
    setFormData({
      name: '',
      code: `STP-${Math.floor(100 + Math.random() * 900)}`,
      lat: stops[0]?.location?.coordinates ? stops[0].location.coordinates[1] : 28.6139,
      lng: stops[0]?.location?.coordinates ? stops[0].location.coordinates[0] : 77.2090,
      isEventStop: false,
      eventId: '',
    });
    setShowModal(true);
  };

  const openEditModal = (stop) => {
    setEditingStop(stop);
    setFormData({
      name: stop.name,
      code: stop.code,
      lat: stop.location?.coordinates?.[1] || 28.6139,
      lng: stop.location?.coordinates?.[0] || 77.2090,
      isEventStop: !!stop.isEventStop,
      eventId: stop.eventId || '',
    });
    setShowModal(true);
  };

  const handleSaveStop = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        location: {
          type: 'Point',
          coordinates: [Number(formData.lng), Number(formData.lat)],
        },
        isEventStop: formData.isEventStop,
        eventId: formData.eventId || null,
      };

      if (editingStop) {
        await stopsApi.update(editingStop._id, payload);
      } else {
        await stopsApi.create(payload);
      }

      setShowModal(false);
      await loadStops();
    } catch (err) {
      console.error('Failed to save stop:', err);
      alert(err.response?.data?.error?.message || 'Failed to save stop.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStop = async (id) => {
    if (!window.confirm('Are you sure you want to delete this stop?')) return;
    try {
      setActionLoading(true);
      await stopsApi.delete(id);
      await loadStops();
    } catch (err) {
      console.error('Failed to delete stop:', err);
      alert('Failed to delete stop.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredStops = stops.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight flex items-center gap-3">
            <MapPin className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            Bus Stops & Stations
          </h1>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
            Manage physical bus shelters, geo-coordinates, and event transit hubs
          </p>
        </div>

        <button
          onClick={openCreateModal}
          id="create-stop-btn"
          className="btn-primary rounded-full py-2.5 px-5 text-sm font-semibold flex items-center gap-2 self-start sm:self-auto shadow-soft-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Stop</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-surface-400 dark:text-surface-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter by stop name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Stops Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStops.map((stop) => (
          <div
            key={stop._id}
            className="bg-white dark:bg-[#28292c] p-5 sm:p-6 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xs space-y-3 flex flex-col justify-between hover:shadow-soft-sm transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700">
                  #{stop.code}
                </span>
                {stop.isEventStop && (
                  <span className="badge bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1 font-bold text-[10px]">
                    <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Event Hub
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">{stop.name}</h3>

              <div className="mt-2 text-xs font-mono text-surface-500 dark:text-surface-400 flex items-center gap-3">
                <span>Lat: {stop.location?.coordinates?.[1]?.toFixed(4)}</span>
                <span>Lng: {stop.location?.coordinates?.[0]?.toFixed(4)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate(mapLink({ stopId: stop._id }), { state: { from: location.pathname + location.search } })}
                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>View on map</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openEditModal(stop)}
                  className="p-2 rounded-full text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  title="Edit Stop"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteStop(stop._id)}
                  className="p-2 rounded-full text-surface-400 hover:text-google-red hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  title="Delete Stop"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-[#28292c] max-w-lg w-full p-6 sm:p-7 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xl space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                {editingStop ? 'Edit Stop' : 'Create New Stop'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStop} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Stop Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Science Complex"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Code (Unique)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. STP-01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="input font-mono uppercase"
                  />
                </div>
              </div>

              {/* Coordinates Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-600 dark:text-surface-300 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                    className="input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-600 dark:text-surface-300 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) })}
                    className="input font-mono"
                  />
                </div>
              </div>

              {/* Mini Interactive Map Picker */}
              <div>
                <div className="text-xs text-surface-600 dark:text-surface-300 mb-1.5 flex items-center justify-between font-medium">
                  <span>Click on map to pin coordinates:</span>
                  <span className="text-[11px] text-primary-600 dark:text-primary-400 font-semibold">Interactive Leaflet</span>
                </div>
                <div className="h-44 rounded-2xl overflow-hidden border border-surface-300 dark:border-surface-700 shadow-soft-xs">
                  <MapContainer
                    center={[formData.lat, formData.lng]}
                    zoom={15}
                    className="w-full h-full"
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <LocationPicker
                      position={[formData.lat, formData.lng]}
                      onChange={([lat, lng]) => setFormData(prev => ({ ...prev, lat, lng }))}
                    />
                  </MapContainer>
                </div>
              </div>

              {/* Event Stop Option */}
              <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-surface-900 dark:text-surface-100">Event Transit Hub</span>
                  <input
                    type="checkbox"
                    checked={formData.isEventStop}
                    onChange={(e) => setFormData({ ...formData, isEventStop: e.target.checked })}
                    className="w-4 h-4 accent-amber-600 cursor-pointer"
                  />
                </div>
                {formData.isEventStop && (
                  <select
                    value={formData.eventId}
                    onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                    className="input text-xs"
                  >
                    <option value="">-- Associate with Event (Optional) --</option>
                    {events.map(ev => (
                      <option key={ev._id} value={ev._id}>
                        {ev.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-200 dark:border-surface-700">
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
                  className="btn-primary text-xs font-semibold py-2 px-5 rounded-full shadow-soft-xs"
                >
                  {actionLoading ? 'Saving...' : editingStop ? 'Update Stop' : 'Create Stop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
