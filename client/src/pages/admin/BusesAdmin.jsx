import React, { useState, useEffect } from 'react';
import {
  Bus,
  Plus,
  Trash2,
  Edit,
  Users,
  Route,
  Activity,
  Star,
  Phone,
  CreditCard,
  X,
  AlertCircle
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { busesApi, routesApi } from '../../api/index.js';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';
import Modal from '../../components/ui/Modal.jsx';
import BusDetailsDrawer from '../../components/BusDetailsDrawer.jsx';

export default function BusesAdmin() {
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const busIdParam = searchParams.get('busId');

  // Drawer state (Feature 4c & Feature A URL sync)
  const [selectedBus, setSelectedBus] = useState(null);

  useEffect(() => {
    if (busIdParam && buses.length > 0) {
      const found = buses.find((b) => b._id === busIdParam);
      if (found) setSelectedBus(found);
    } else if (!busIdParam) {
      setSelectedBus(null);
    }
  }, [busIdParam, buses]);

  const handleOpenBusDrawer = (bus) => {
    setSelectedBus(bus);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('busId', bus._id);
    setSearchParams(newParams);
  };

  const handleCloseBusDrawer = () => {
    setSelectedBus(null);
    if (searchParams.has('busId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('busId');
      setSearchParams(newParams);
    }
  };

  // Form modal state (Feature 4a)
  const [showModal, setShowModal] = useState(false);
  const [editingBus, setEditingBus] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    plateNo: '',
    name: '',
    capacity: 40,
    status: 'idle',
    currentRouteId: '',
    driver: {
      name: '',
      phone: '',
      license: '',
    },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [bRes, rRes] = await Promise.all([
        busesApi.list(),
        routesApi.list(),
      ]);
      setBuses(bRes.data || []);
      setRoutes(rRes.data || []);
    } catch (err) {
      console.error('Failed to load buses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingBus(null);
    setFormErrors({});
    setFormData({
      plateNo: `BUS-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      capacity: 40,
      status: 'idle',
      currentRouteId: '',
      driver: {
        name: '',
        phone: '',
        license: '',
      },
    });
    setShowModal(true);
  };

  const openEditModal = (bus) => {
    setEditingBus(bus);
    setFormErrors({});
    setFormData({
      plateNo: bus.plateNo,
      name: bus.name,
      capacity: bus.capacity || 40,
      status: bus.status || 'idle',
      currentRouteId: bus.defaultRouteId?._id || bus.defaultRouteId || bus.currentRouteId?._id || bus.currentRouteId || '',
      driver: {
        name: bus.driver?.name || '',
        phone: bus.driver?.phone || '',
        license: bus.driver?.license || '',
      },
    });
    setShowModal(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Bus name is required';
    if (!formData.plateNo.trim()) errors.plateNo = 'Plate number is required';
    if (!formData.driver?.name?.trim()) errors.driverName = 'Driver name is required';

    const phone = formData.driver?.phone?.trim() || '';
    if (!phone) {
      errors.driverPhone = 'Driver phone is required';
    } else if (!/^\+?[0-9]{10,15}$/.test(phone)) {
      errors.driverPhone = 'Phone must be 10–15 digits (optional leading +)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveBus = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setActionLoading(true);
      const payload = {
        plateNo: formData.plateNo.trim().toUpperCase(),
        name: formData.name.trim(),
        capacity: Number(formData.capacity),
        status: formData.status,
        defaultRouteId: formData.currentRouteId || null,
        currentRouteId: formData.currentRouteId || null,
        driver: {
          name: formData.driver.name.trim(),
          phone: formData.driver.phone.trim(),
          license: formData.driver.license?.trim() || '',
        },
      };

      if (editingBus) {
        await busesApi.update(editingBus._id, payload);
      } else {
        await busesApi.create(payload);
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save bus:', err);
      alert(err.response?.data?.error?.message || 'Failed to save bus.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBus = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bus?')) return;
    try {
      setActionLoading(true);
      await busesApi.delete(id);
      if (selectedBus?._id === id || busIdParam === id) {
        handleCloseBusDrawer();
      }
      await loadData();
    } catch (err) {
      console.error('Failed to delete bus:', err);
      alert('Failed to delete bus.');
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
            <Bus className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            Bus Fleet Management
          </h1>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
            Track transit vehicles, driver assignments, punctuality ratings, and operational status
          </p>
        </div>

        <button
          onClick={openCreateModal}
          id="create-bus-btn"
          className="btn-primary rounded-full py-2.5 px-5 text-sm font-semibold flex items-center gap-2 self-start sm:self-auto shadow-soft-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Vehicle</span>
        </button>
      </div>

      {/* Fleet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {buses.map((bus) => {
          const route = routes.find(
            (r) => r._id === (bus.defaultRouteId?._id || bus.defaultRouteId || bus.currentRouteId?._id || bus.currentRouteId)
          );
          const isLive = bus.status === 'on_trip';
          const isIdle = bus.status === 'idle';

          return (
            <div
              key={bus._id}
              onClick={() => handleOpenBusDrawer(bus)}
              className="bg-white dark:bg-[#28292c] p-6 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-xs space-y-4 flex flex-col justify-between hover:shadow-soft-md transition-all cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700">
                    {bus.plateNo}
                  </span>

                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                      isLive
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : isIdle
                        ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800'
                        : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isLive ? 'bg-emerald-500 animate-ping' : 'bg-current'
                      }`}
                    />
                    {bus.status ? bus.status.replace('_', ' ') : 'idle'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100 mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {bus.name}
                </h3>

                {/* Specs & Driver Details */}
                <div className="space-y-1.5 text-xs text-surface-600 dark:text-surface-400">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                    <span>
                      Capacity: <strong className="text-surface-800 dark:text-surface-200">{bus.capacity} seats</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Route className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                    <span className="truncate">
                      Line: <strong className="text-surface-800 dark:text-surface-200">{route?.name || 'Unassigned'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                    <span className="truncate">
                      Driver: <strong className="text-surface-800 dark:text-surface-200">{bus.driver?.name || 'Unassigned'}</strong>
                    </span>
                  </div>
                </div>

                {/* Punctuality Rating Pill on Card */}
                <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-surface-500 dark:text-surface-400 font-medium">Punctuality</span>
                  {bus.rating !== null && bus.rating !== undefined ? (
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span className="text-surface-900 dark:text-surface-100">{bus.rating.toFixed(1)}</span>
                      <span className="text-surface-400 text-[10px]">({bus.onTimePct}% on time)</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-surface-400 italic">Not enough data yet</span>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div
                className="pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] text-primary-600 dark:text-primary-400 font-semibold group-hover:underline">
                  View details & stats →
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(bus)}
                    className="p-2 rounded-full text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                    title="Edit Bus"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteBus(bus._id)}
                    className="p-2 rounded-full text-surface-400 hover:text-google-red hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    title="Delete Bus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FEATURE 4c: BUS DETAILS DRAWER */}
      <BusDetailsDrawer
        isOpen={Boolean(selectedBus)}
        onClose={handleCloseBusDrawer}
        bus={selectedBus}
        routes={routes}
        onEdit={(b) => openEditModal(b)}
        onDelete={(id) => handleDeleteBus(id)}
      />

      {/* FEATURE 4a: CREATE / EDIT BUS MODAL */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingBus ? 'Edit Vehicle' : 'Add New Vehicle'}
        subtitle="Manage fleet vehicle specifications and assigned driver details"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveBus} className="space-y-4">
          <div>
            <label className="label">Bus Name / Model Identifier</label>
            <input
              type="text"
              required
              placeholder="e.g. Campus Express 101"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (formErrors.name) setFormErrors({ ...formErrors, name: null });
              }}
              className={`input ${formErrors.name ? 'border-red-500' : ''}`}
            />
            {formErrors.name && (
              <p className="text-[11px] text-google-red mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>{formErrors.name}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">License Plate / Reg.</label>
              <input
                type="text"
                required
                placeholder="e.g. DL-01-AB-1234"
                value={formData.plateNo}
                onChange={(e) => {
                  setFormData({ ...formData, plateNo: e.target.value });
                  if (formErrors.plateNo) setFormErrors({ ...formErrors, plateNo: null });
                }}
                className={`input font-mono uppercase ${formErrors.plateNo ? 'border-red-500' : ''}`}
              />
              {formErrors.plateNo && (
                <p className="text-[11px] text-google-red mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{formErrors.plateNo}</span>
                </p>
              )}
            </div>

            <div>
              <label className="label">Passenger Capacity</label>
              <input
                type="number"
                min="10"
                max="100"
                required
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="input font-mono"
              />
            </div>
          </div>

          {/* Driver Information Section */}
          <div className="p-4 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700/80 space-y-3">
            <div className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
              Driver Details (Required)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Driver Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.driver.name}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      driver: { ...formData.driver, name: e.target.value },
                    });
                    if (formErrors.driverName) setFormErrors({ ...formErrors, driverName: null });
                  }}
                  className={`input ${formErrors.driverName ? 'border-red-500' : ''}`}
                />
                {formErrors.driverName && (
                  <p className="text-[11px] text-google-red mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{formErrors.driverName}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="label">Driver Phone *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +919876543210"
                  value={formData.driver.phone}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      driver: { ...formData.driver, phone: e.target.value },
                    });
                    if (formErrors.driverPhone) setFormErrors({ ...formErrors, driverPhone: null });
                  }}
                  className={`input font-mono ${formErrors.driverPhone ? 'border-red-500' : ''}`}
                />
                {formErrors.driverPhone && (
                  <p className="text-[11px] text-google-red mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{formErrors.driverPhone}</span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="label">Driving License No. (Optional)</label>
              <input
                type="text"
                placeholder="e.g. DL-KA-2019-0012"
                value={formData.driver.license}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    driver: { ...formData.driver, license: e.target.value },
                  })
                }
                className="input font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Default Line Assignment</label>
              <select
                value={formData.currentRouteId}
                onChange={(e) => setFormData({ ...formData, currentRouteId: e.target.value })}
                className="input cursor-pointer"
              >
                <option value="">-- No Default Route --</option>
                {routes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Operational Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input cursor-pointer"
              >
                <option value="idle">Idle (Stationary / Off-duty)</option>
                <option value="on_trip">On Trip (Active & Broadcasting)</option>
                <option value="offline">Offline (Maintenance)</option>
              </select>
            </div>
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
              {actionLoading ? 'Saving...' : editingBus ? 'Update Vehicle' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
