import React, { useState, useEffect, useMemo } from 'react';
import {
  Route as RouteIcon,
  Plus,
  Trash2,
  Edit,
  Sparkles,
  MapPin,
  Clock,
  Layers,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  X,
  GripVertical,
  Navigation
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';

import { useSearchParams } from 'react-router-dom';
import { routesApi, stopsApi, eventsApi } from '../../api/index.js';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';
import Modal from '../../components/ui/Modal.jsx';
import RouteTimeline from '../../components/RouteTimeline.jsx';

/**
 * Sortable stop row item for the create/edit form
 */
function SortableStopRow({
  id,
  stop,
  index,
  totalStops,
  stopObj,
  onOffsetChange,
  onRemove,
  isOverlay = false,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const isSource = index === 0;
  const isDestination = index === totalStops - 1 && totalStops > 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 rounded-2xl border text-xs transition-colors ${
        isDragging
          ? 'opacity-40 bg-surface-100 dark:bg-surface-800 border-dashed border-primary-500'
          : isOverlay
          ? 'bg-white dark:bg-[#28292c] border-primary-500 shadow-soft-lg ring-2 ring-primary-500/20'
          : 'bg-surface-50 dark:bg-surface-800/60 border-surface-200 dark:border-surface-700/80 hover:border-surface-300 dark:hover:border-surface-600'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Drag Handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder stop"
          className="cursor-grab active:cursor-grabbing p-1 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 rounded touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Order Number */}
        <span className="w-5 h-5 rounded-full bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
          {index + 1}
        </span>

        {/* Stop Name & Badges */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="font-semibold text-surface-900 dark:text-surface-100 truncate">
            {stopObj?.name || stop.stopId}
          </span>
          {stopObj?.code && (
            <span className="font-mono text-[10px] text-surface-500 dark:text-surface-400">
              ({stopObj.code})
            </span>
          )}
          {isSource && (
            <span className="badge bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800 text-[9px] font-bold uppercase tracking-wider py-0 px-1.5">
              Source
            </span>
          )}
          {isDestination && (
            <span className="badge bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[9px] font-bold uppercase tracking-wider py-0 px-1.5">
              Destination
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
        <div className="flex items-center gap-1 text-[11px] text-surface-500 dark:text-surface-400">
          <span>+</span>
          <input
            type="number"
            min="0"
            value={stop.scheduledOffsetMin ?? 0}
            onChange={(e) => onOffsetChange(index, Number(e.target.value))}
            className="w-12 p-1 rounded-lg bg-white dark:bg-[#1f1f23] border border-surface-300 dark:border-surface-600 text-surface-900 dark:text-surface-100 text-center font-mono font-semibold"
            title="Scheduled offset in minutes"
          />
          <span>min</span>
        </div>

        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-surface-400 hover:text-google-red p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          title="Remove stop"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function RoutesAdmin() {
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const routeIdParam = searchParams.get('routeId');

  // Timeline modal state (Feature 2 & Feature A URL sync)
  const [timelineRoute, setTimelineRoute] = useState(null);

  useEffect(() => {
    if (routeIdParam && routes.length > 0) {
      const found = routes.find((r) => r._id === routeIdParam);
      if (found) setTimelineRoute(found);
    } else if (!routeIdParam) {
      setTimelineRoute(null);
    }
  }, [routeIdParam, routes]);

  const handleOpenTimeline = (route) => {
    setTimelineRoute(route);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('routeId', route._id);
    setSearchParams(newParams);
  };

  const handleCloseTimeline = () => {
    setTimelineRoute(null);
    if (searchParams.has('routeId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('routeId');
      setSearchParams(newParams);
    }
  };

  // Form modal state (Feature 3)
  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [isPathOutdated, setIsPathOutdated] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#1a73e8',
    type: 'regular',
    isLoop: false,
    stops: [], // [{ id, stopId, order, dwellSec, scheduledOffsetMin, projectedDistM }]
  });

  // Event Mode modal state
  const [showEventModeModal, setShowEventModeModal] = useState(false);
  const [targetRoute, setTargetRoute] = useState(null);
  const [eventModeData, setEventModeData] = useState({
    enabled: true,
    eventId: '',
    headwayMin: 15,
    activeFrom: '',
    activeUntil: '',
  });

  // DnD Sensors: pointer, touch, keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [rRes, sRes, eRes] = await Promise.all([
        routesApi.list(),
        stopsApi.list(),
        eventsApi.listAll ? eventsApi.listAll() : eventsApi.list(),
      ]);
      setRoutes(rRes.data || []);
      setStops(sRes.data || []);
      setEvents(eRes.data || []);
    } catch (err) {
      console.error('Failed to load routes data:', err);
      setError('Failed to fetch routes data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingRoute(null);
    setIsPathOutdated(false);
    setFormData({
      name: '',
      color: '#1a73e8',
      type: 'regular',
      isLoop: false,
      stops: [],
    });
    setShowModal(true);
  };

  const openEditModal = (route) => {
    setEditingRoute(route);
    setIsPathOutdated(false);
    setFormData({
      name: route.name,
      color: route.color || '#1a73e8',
      type: route.type || 'regular',
      isLoop: Boolean(route.isLoop),
      stops: route.stops?.map((s, idx) => ({
        id: `stop-${s.stopId?._id || s.stopId}-${idx}`,
        stopId: typeof s.stopId === 'object' ? s.stopId._id : s.stopId,
        order: s.order ?? idx,
        dwellSec: s.dwellSec || 30,
        scheduledOffsetMin: s.scheduledOffsetMin || (idx * 5),
        projectedDistM: s.projectedDistM || 0,
      })) || [],
    });
    setShowModal(true);
  };

  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (over && active.id !== over.id) {
      setFormData((prev) => {
        const oldIndex = prev.stops.findIndex((item) => item.id === active.id);
        const newIndex = prev.stops.findIndex((item) => item.id === over.id);
        const newStops = arrayMove(prev.stops, oldIndex, newIndex).map((s, idx) => ({
          ...s,
          order: idx,
        }));
        return { ...prev, stops: newStops };
      });
      setIsPathOutdated(true);
    }
  };

  const addStopToRoute = (stopId) => {
    if (!stopId) return;
    setFormData((prev) => {
      const order = prev.stops.length;
      const newStop = {
        id: `stop-${stopId}-${order}-${Date.now()}`,
        stopId,
        order,
        dwellSec: 30,
        scheduledOffsetMin: order * 5,
        projectedDistM: 0,
      };
      return {
        ...prev,
        stops: [...prev.stops, newStop],
      };
    });
    setIsPathOutdated(true);
  };

  const removeStopFromRoute = (index) => {
    setFormData((prev) => {
      const updated = prev.stops
        .filter((_, i) => i !== index)
        .map((s, idx) => ({ ...s, order: idx }));
      return { ...prev, stops: updated };
    });
    setIsPathOutdated(true);
  };

  const handleOffsetChange = (index, value) => {
    setFormData((prev) => ({
      ...prev,
      stops: prev.stops.map((st, i) => (i === index ? { ...st, scheduledOffsetMin: value } : st)),
    }));
  };

  // Check if non-loop route's stops are in increasing distance
  const nonLoopDistanceOutOfOrder = useMemo(() => {
    if (formData.isLoop || formData.stops.length < 2) return false;
    let lastDist = -1;
    for (const s of formData.stops) {
      if (typeof s.projectedDistM === 'number' && s.projectedDistM > 0) {
        if (s.projectedDistM < lastDist) {
          return true;
        }
        lastDist = s.projectedDistM;
      }
    }
    return false;
  }, [formData.stops, formData.isLoop]);

  // Handle Snap to roads from inside the form
  const handleSnapToRoadsInForm = async () => {
    if (formData.stops.length < 2) {
      alert('Add at least 2 stops before snapping to roads.');
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        name: formData.name,
        color: formData.color,
        type: formData.type,
        isLoop: formData.isLoop,
        stops: formData.stops.map((s, idx) => ({
          stopId: s.stopId,
          order: idx,
          dwellSec: s.dwellSec || 30,
          scheduledOffsetMin: s.scheduledOffsetMin || (idx * 5),
        })),
      };

      let targetId = editingRoute?._id;
      if (targetId) {
        await routesApi.update(targetId, payload);
      } else {
        const created = await routesApi.create(payload);
        targetId = created.data._id;
        setEditingRoute(created.data);
      }

      // Build polyline via OSRM & auto-fill scheduledOffsetMin
      const polyRes = await routesApi.buildPolyline(targetId);
      const updatedRoute = polyRes.data?.route;

      if (updatedRoute?.stops) {
        setFormData((prev) => ({
          ...prev,
          stops: updatedRoute.stops.map((s, idx) => ({
            id: `stop-${s.stopId?._id || s.stopId}-${idx}`,
            stopId: typeof s.stopId === 'object' ? s.stopId._id : s.stopId,
            order: s.order ?? idx,
            dwellSec: s.dwellSec || 30,
            scheduledOffsetMin: s.scheduledOffsetMin || (idx * 5),
            projectedDistM: s.projectedDistM || 0,
          })),
        }));
      }

      setIsPathOutdated(false);
      await loadData();
      alert('Road snap complete! Stops ordered and scheduled offset times recalculated.');
    } catch (err) {
      console.error('Road snap failed:', err);
      alert(err.response?.data?.error?.message || 'Failed to snap to roads via OSRM.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveRoute = async (e) => {
    e.preventDefault();
    if (formData.stops.length < 2) {
      alert('Please add at least 2 stops to define a valid route.');
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        name: formData.name,
        color: formData.color,
        type: formData.type,
        isLoop: formData.isLoop,
        stops: formData.stops.map((s, idx) => ({
          stopId: s.stopId,
          order: idx,
          dwellSec: s.dwellSec || 30,
          scheduledOffsetMin: s.scheduledOffsetMin || (idx * 5),
        })),
      };

      let routeId = editingRoute?._id;
      if (editingRoute) {
        await routesApi.update(routeId, payload);
        if (isPathOutdated) {
          try {
            await routesApi.buildPolyline(routeId);
          } catch (osrmErr) {
            console.warn('Polyline rebuild fallback:', osrmErr);
          }
        }
      } else {
        const created = await routesApi.create(payload);
        routeId = created.data._id;
        try {
          await routesApi.buildPolyline(routeId);
        } catch (osrmErr) {
          console.warn('Polyline rebuild fallback:', osrmErr);
        }
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save route:', err);
      alert(err.response?.data?.error?.message || 'Failed to save route.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRoute = async (id) => {
    if (!window.confirm('Are you sure you want to delete this route?')) return;
    try {
      setActionLoading(true);
      await routesApi.delete(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete route:', err);
      alert('Failed to delete route.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuildPolyline = async (routeId) => {
    try {
      setActionLoading(true);
      await routesApi.buildPolyline(routeId);
      alert('Polyline built successfully from OSRM!');
      await loadData();
    } catch (err) {
      console.error('Polyline build error:', err);
      alert(err.response?.data?.error?.message || 'Failed to build polyline via OSRM.');
    } finally {
      setActionLoading(false);
    }
  };

  const openEventMode = (route) => {
    setTargetRoute(route);
    setEventModeData({
      enabled: route.eventMode?.enabled ?? true,
      eventId: route.eventMode?.eventId?._id || route.eventMode?.eventId || events[0]?._id || '',
      headwayMin: route.eventMode?.headwayMin || 15,
      activeFrom: route.eventMode?.activeFrom
        ? new Date(route.eventMode.activeFrom).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      activeUntil: route.eventMode?.activeUntil
        ? new Date(route.eventMode.activeUntil).toISOString().slice(0, 16)
        : new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 16),
    });
    setShowEventModeModal(true);
  };

  const handleSaveEventMode = async (e) => {
    e.preventDefault();
    if (!targetRoute) return;

    try {
      setActionLoading(true);
      await routesApi.setEventMode(targetRoute._id, {
        enabled: eventModeData.enabled,
        eventId: eventModeData.eventId || null,
        headwayMin: Number(eventModeData.headwayMin),
        activeFrom: eventModeData.activeFrom ? new Date(eventModeData.activeFrom).toISOString() : null,
        activeUntil: eventModeData.activeUntil ? new Date(eventModeData.activeUntil).toISOString() : null,
      });
      setShowEventModeModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to configure event mode:', err);
      alert('Failed to update event mode.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner fullscreen />;

  const activeDragStop = formData.stops.find((s) => s.id === activeDragId);
  const activeDragStopObj = stops.find((item) => item._id === activeDragStop?.stopId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight flex items-center gap-3">
            <RouteIcon className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            Route Management
          </h1>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
            Configure campus bus lines, polyline geometries, and event shuttle modes
          </p>
        </div>

        <button
          onClick={openCreateModal}
          id="create-route-btn"
          className="btn-primary rounded-full py-2.5 px-5 text-sm font-semibold flex items-center gap-2 self-start sm:self-auto shadow-soft-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Route</span>
        </button>
      </div>

      {/* Routes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {routes.map((route) => {
          const isEventModeActive = route.eventMode?.enabled;
          const isLoop = Boolean(
            route.isLoop ||
            (route.stops?.length > 1 &&
              (route.stops[0]?.stopId?._id || route.stops[0]?.stopId) ===
              (route.stops[route.stops.length - 1]?.stopId?._id || route.stops[route.stops.length - 1]?.stopId))
          );

          return (
            <div
              key={route._id}
              onClick={() => handleOpenTimeline(route)}
              className="bg-white dark:bg-[#28292c] p-6 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xs space-y-4 flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-soft-md cursor-pointer group"
            >
              {/* Route Color Pill Indicator */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: route.color || '#1a73e8' }}
              />

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="badge bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border-surface-200 dark:border-surface-700 uppercase font-semibold text-[10px]">
                      {route.type}
                    </span>
                    <span className={`badge uppercase font-semibold text-[10px] ${
                      isLoop
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border-surface-200 dark:border-surface-700'
                    }`}>
                      {isLoop ? 'Loop' : 'Linear'}
                    </span>
                  </div>

                  {isEventModeActive && (
                    <span className="badge bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 flex items-center gap-1 text-[10px]">
                      <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Shuttle
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: route.color || '#1a73e8' }}
                  />
                  <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {route.name}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-surface-600 dark:text-surface-400 pt-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                    <span>{route.stops?.length || 0} stops</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-google-green" />
                    <span>{route.polyline?.length ? `${route.polyline.length} coords` : 'No polyline'}</span>
                  </div>
                </div>

                {isEventModeActive && (
                  <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300 space-y-1">
                    <div className="font-semibold text-amber-800 dark:text-amber-200">
                      Frequency: ~{route.eventMode.headwayMin} min headway
                    </div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400">
                      Active: {new Date(route.eventMode.activeFrom).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(route.eventMode.activeUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div
                className="pt-4 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => openEventMode(route)}
                  className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 transition-colors"
                  title="Configure Event Shuttle Mode"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Event</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleBuildPolyline(route._id)}
                    className="p-2 rounded-full bg-surface-50 dark:bg-surface-800 hover:bg-primary-50 dark:hover:bg-primary-950/60 text-surface-600 dark:text-surface-300 hover:text-primary-600 dark:hover:text-primary-400 border border-surface-200 dark:border-surface-700 transition-colors"
                    title="Snap polyline using OSRM"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openEditModal(route)}
                    className="p-2 rounded-full bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-100 border border-surface-200 dark:border-surface-700 transition-colors"
                    title="Edit Route"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRoute(route._id)}
                    className="p-2 rounded-full bg-surface-50 dark:bg-surface-800 hover:bg-red-50 dark:hover:bg-red-950/60 text-surface-500 dark:text-surface-400 hover:text-google-red border border-surface-200 dark:border-surface-700 transition-colors"
                    title="Delete Route"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FEATURE 2: ROUTE TIMELINE MODAL */}
      <Modal
        isOpen={Boolean(timelineRoute)}
        onClose={handleCloseTimeline}
        maxWidth="max-w-xl"
      >
        {timelineRoute && (
          <RouteTimeline
            route={timelineRoute}
            allStops={stops}
            onClose={handleCloseTimeline}
            onEditRoute={openEditModal}
          />
        )}
      </Modal>

      {/* FEATURE 3: CREATE / EDIT ROUTE MODAL WITH DRAG-AND-DROP REORDERING */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRoute ? 'Edit Route' : 'Create New Route'}
        subtitle="Configure route name, stops sequence, and road geometry"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveRoute} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Route Name</label>
              <input
                type="text"
                required
                placeholder="e.g. North Campus Shuttle"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Route Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-10 h-10 rounded-xl border border-surface-300 dark:border-surface-600 cursor-pointer p-0.5 bg-transparent"
                />
                <span className="font-mono text-xs text-surface-700 dark:text-surface-300 font-semibold">
                  {formData.color}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/80">
            <div>
              <div className="text-xs font-semibold text-surface-900 dark:text-surface-100">
                Loop Route
              </div>
              <div className="text-[11px] text-surface-500 dark:text-surface-400">
                Returns to the starting stop continuously
              </div>
            </div>
            <input
              type="checkbox"
              checked={formData.isLoop}
              onChange={(e) => {
                setFormData({ ...formData, isLoop: e.target.checked });
                setIsPathOutdated(true);
              }}
              className="w-4 h-4 accent-primary-600 cursor-pointer"
            />
          </div>

          {/* Stop Selector */}
          <div>
            <label className="label">Add Stops to Route</label>
            <select
              id="add-stop-select"
              onChange={(e) => {
                addStopToRoute(e.target.value);
                e.target.value = '';
              }}
              className="input cursor-pointer"
            >
              <option value="">-- Choose Stop to Add --</option>
              {stops.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code}) {s.isEventStop ? '★ Event' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Sortable Stops Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
                  Stops Sequence ({formData.stops.length})
                </span>
                {isPathOutdated && (
                  <span className="badge bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    Path outdated
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={actionLoading || formData.stops.length < 2}
                onClick={handleSnapToRoadsInForm}
                className="px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-950/60 hover:bg-primary-100 dark:hover:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs font-semibold border border-primary-200 dark:border-primary-800 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Snap to roads using OSRM and auto-calculate offsets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                <span>Snap to roads</span>
              </button>
            </div>

            {nonLoopDistanceOutOfOrder && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Notice: Stops may not be in increasing distance along the road path. Please verify sequence or snap to roads.
                </span>
              </div>
            )}

            {formData.stops.length === 0 ? (
              <div className="p-6 rounded-2xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-800 text-center text-xs text-surface-500 dark:text-surface-400">
                No stops added yet. Select stops from the dropdown above to add them to this route.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={formData.stops.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {formData.stops.map((s, idx) => {
                      const stopObj = stops.find((item) => item._id === s.stopId);
                      return (
                        <SortableStopRow
                          key={s.id}
                          id={s.id}
                          stop={s}
                          index={idx}
                          totalStops={formData.stops.length}
                          stopObj={stopObj}
                          onOffsetChange={handleOffsetChange}
                          onRemove={removeStopFromRoute}
                        />
                      );
                    })}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activeDragStop ? (
                    <SortableStopRow
                      id={activeDragStop.id}
                      stop={activeDragStop}
                      index={formData.stops.findIndex((s) => s.id === activeDragId)}
                      totalStops={formData.stops.length}
                      stopObj={activeDragStopObj}
                      onOffsetChange={() => {}}
                      onRemove={() => {}}
                      isOverlay
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-800">
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
              className="btn-primary text-xs font-semibold py-2 px-5 rounded-full flex items-center gap-2 shadow-soft-xs disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : editingRoute ? 'Update Route' : 'Create Route'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EVENT MODE CONFIG MODAL */}
      <Modal
        isOpen={showEventModeModal}
        onClose={() => setShowEventModeModal(false)}
        title="Event Shuttle Mode"
        subtitle={`Configure event shuttle frequency for ${targetRoute?.name || 'route'}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveEventMode} className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/80">
            <span className="text-xs font-semibold text-surface-900 dark:text-surface-100">
              Enable Event Shuttle Mode
            </span>
            <input
              type="checkbox"
              checked={eventModeData.enabled}
              onChange={(e) => setEventModeData({ ...eventModeData, enabled: e.target.checked })}
              className="w-5 h-5 accent-primary-600 cursor-pointer"
            />
          </div>

          <div>
            <label className="label">Associated Campus Event</label>
            <select
              value={eventModeData.eventId}
              onChange={(e) => setEventModeData({ ...eventModeData, eventId: e.target.value })}
              className="input cursor-pointer"
            >
              <option value="">-- Choose Event --</option>
              {events.map((ev) => (
                <option key={ev._id} value={ev._id}>
                  {ev.title} ({ev.venueName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Shuttle Headway (Frequency in Minutes)</label>
            <input
              type="number"
              min="3"
              max="60"
              value={eventModeData.headwayMin}
              onChange={(e) => setEventModeData({ ...eventModeData, headwayMin: Number(e.target.value) })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-surface-600 dark:text-surface-400 mb-1">
                Active From
              </label>
              <input
                type="datetime-local"
                value={eventModeData.activeFrom}
                onChange={(e) => setEventModeData({ ...eventModeData, activeFrom: e.target.value })}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-surface-600 dark:text-surface-400 mb-1">
                Active Until
              </label>
              <input
                type="datetime-local"
                value={eventModeData.activeUntil}
                onChange={(e) => setEventModeData({ ...eventModeData, activeUntil: e.target.value })}
                className="input text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-800">
            <button
              type="button"
              onClick={() => setShowEventModeModal(false)}
              className="btn-subtle px-4 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="btn-primary text-xs font-semibold py-2 px-5 rounded-full flex items-center gap-1.5 shadow-soft-xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{actionLoading ? 'Saving...' : 'Apply Mode'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
