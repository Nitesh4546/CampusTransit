import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bus,
  Navigation,
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  Play,
  Square,
  LogOut,
  MapPin,
  CheckCircle2,
  Clock,
  Shield,
  Send,
  X,
  User,
  Phone,
  CreditCard,
  Route as RouteIcon,
  Camera,
  Info,
  Lock
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { busesApi, routesApi, tripsApi, announcementsApi, authApi } from '../../api/index.js';
import { useGeolocationSender } from '../../hooks/useGeolocationSender.js';
import { useWakeLock } from '../../hooks/useWakeLock.js';
import { getSocket } from '../../socket/socket.js';
import LoadingSpinner from '../../components/ui/LoadingSpinner.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';
import StartTripSheet from '../../components/StartTripSheet.jsx';

export default function DriverHome() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  
  const [activeTrip, setActiveTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Start trip sheet state
  const [showStartTripSheet, setShowStartTripSheet] = useState(false);

  // Manual delay report modal state
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [delaySubmitting, setDelaySubmitting] = useState(false);
  const [delaySuccess, setDelaySuccess] = useState(false);

  // Wake lock keeps driver screen on
  const { active: wakeLockActive, acquire: acquireWakeLock } = useWakeLock();

  // Socket status
  const [isConnected, setIsConnected] = useState(getSocket().connected);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Fetch initial data & check for ongoing active trip
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [meRes, busesRes, routesRes, activeTripsRes] = await Promise.all([
          authApi.me().catch(() => null),
          busesApi.list(),
          routesApi.list(),
          tripsApi.active()
        ]);

        const currentUser = meRes?.data?.user || user;
        const allBuses = busesRes.data || [];
        const allRoutes = routesRes.data || [];

        setBuses(allBuses);
        setRoutes(allRoutes);

        // Determine driver's assigned bus:
        // 1. From currentUser.assignedBus
        // 2. Or from buses list (for driver, GET /buses returns only their assigned bus)
        let assignedBusId = '';
        if (currentUser?.assignedBus) {
          assignedBusId = typeof currentUser.assignedBus === 'object' ? currentUser.assignedBus._id : currentUser.assignedBus;
        } else if (allBuses.length > 0) {
          assignedBusId = allBuses[0]._id;
        }
        setSelectedBusId(assignedBusId);

        // Determine driver's assigned route:
        // 1. From currentUser.assignedRoute
        // 2. From assigned bus's defaultRouteId or currentRouteId
        let assignedRouteId = '';
        if (currentUser?.assignedRoute) {
          assignedRouteId = typeof currentUser.assignedRoute === 'object' ? currentUser.assignedRoute._id : currentUser.assignedRoute;
        }
        if (!assignedRouteId && assignedBusId) {
          const matchedBus = allBuses.find(b => b._id === assignedBusId);
          if (matchedBus?.defaultRouteId) {
            assignedRouteId = typeof matchedBus.defaultRouteId === 'object' ? matchedBus.defaultRouteId._id : matchedBus.defaultRouteId;
          } else if (matchedBus?.currentRouteId) {
            assignedRouteId = typeof matchedBus.currentRouteId === 'object' ? matchedBus.currentRouteId._id : matchedBus.currentRouteId;
          }
        }
        setSelectedRouteId(assignedRouteId);

        // Check if there is an existing trip started by this driver
        const myActiveTrip = activeTripsRes.data?.find(
          t => (typeof t.driverId === 'object' ? t.driverId._id : t.driverId) === currentUser?.id ||
               (typeof t.driverId === 'object' ? t.driverId._id : t.driverId) === currentUser?._id
        );

        if (myActiveTrip) {
          setActiveTrip(myActiveTrip);
          setSelectedBusId(typeof myActiveTrip.busId === 'object' ? myActiveTrip.busId._id : myActiveTrip.busId);
          setSelectedRouteId(typeof myActiveTrip.routeId === 'object' ? myActiveTrip.routeId._id : myActiveTrip.routeId);
          
          // Join trip room in socket
          getSocket().emit('driver:join', { tripId: myActiveTrip._id });
        }
      } catch (err) {
        console.error('Error loading driver dashboard:', err);
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [user]);

  // Hook to stream geolocation
  const geoStatus = useGeolocationSender(activeTrip?._id, !!activeTrip);

  const currentBus = buses.find(b => b._id === selectedBusId) || (typeof user?.assignedBus === 'object' ? user.assignedBus : null);
  const currentRoute = routes.find(r => r._id === selectedRouteId) || (typeof user?.assignedRoute === 'object' ? user.assignedRoute : null);

  // Effective driver details
  const driverName = currentBus?.driver?.name || user?.name || 'Driver';
  const driverPhone = currentBus?.driver?.phone || user?.phone || '';
  const driverLicense = currentBus?.driver?.license || '';
  const isDriverIncomplete = !currentBus?.driver?.phone || !currentBus?.driver?.license;

  const handleOpenStartTripSheet = () => {
    if (!selectedBusId || !selectedRouteId) {
      setError('A bus and route must be assigned by dispatch before you can start a trip.');
      return;
    }
    setError(null);
    setShowStartTripSheet(true);
  };

  const handleStartTripWithPhoto = async (photoId) => {
    if (acquireWakeLock) {
      try {
        await acquireWakeLock();
      } catch (e) {
        console.warn('Wake lock gesture request failed:', e);
      }
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await tripsApi.start({
        busId: selectedBusId,
        routeId: selectedRouteId,
        photoId,
      });

      const newTrip = res.data;
      setActiveTrip(newTrip);
      getSocket().emit('driver:join', { tripId: newTrip._id });
    } catch (err) {
      console.error('Failed to start trip with photo:', err);
      const msg = err.response?.data?.error?.message || err.message || 'Could not start trip.';
      setError(msg);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;
    if (!window.confirm('Are you sure you want to end this trip? Telemetry broadcast will cease and driver photo will be removed.')) return;

    try {
      setActionLoading(true);
      await tripsApi.end(activeTrip._id);
      setActiveTrip(null);
    } catch (err) {
      console.error('Failed to end trip:', err);
      setError(err.response?.data?.error?.message || 'Could not end trip.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportDelay = async (e) => {
    e.preventDefault();
    if (!activeTrip) return;
    try {
      setDelaySubmitting(true);
      await announcementsApi.generateDelay(activeTrip._id, delayReason);
      setDelaySuccess(true);
      setTimeout(() => {
        setDelaySuccess(false);
        setShowDelayModal(false);
        setDelayReason('');
      }, 2000);
    } catch (err) {
      console.error('Failed to report delay:', err);
      alert(err.response?.data?.error?.message || 'Failed to submit delay notification.');
    } finally {
      setDelaySubmitting(false);
    }
  };

  const handleLogout = () => {
    if (activeTrip) {
      if (!window.confirm('You have an active trip running! Logging out will not stop the trip. Continue?')) {
        return;
      }
    }
    logout();
    navigate('/driver/login');
  };

  const formatLiveSince = (trip) => {
    if (!trip) return '';
    const d = new Date(trip.startTime || trip.createdAt || Date.now());
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <LoadingSpinner fullscreen />;

  return (
    <div className="min-h-dvh flex flex-col bg-surface-50 dark:bg-[#1f1f1f] text-surface-900 dark:text-surface-100 font-sans transition-colors duration-150">
      {/* Chrome Style Top Header */}
      <header className="bg-white dark:bg-[#28292c] border-b border-surface-200 dark:border-surface-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-soft-xs transition-colors duration-150">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-800/60 flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-soft-xs">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-surface-500 dark:text-surface-400 font-medium">Driver Portal</div>
            <div className="font-bold text-surface-900 dark:text-surface-100 text-sm flex items-center gap-2">
              <span>{driverName}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-bold uppercase tracking-wider border border-primary-200 dark:border-primary-800/60">
                Driver
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Socket Connection Badge */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-semibold ${
            isConnected
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/60'
          }`}>
            {isConnected ? <Wifi className="w-3.5 h-3.5 text-google-green" /> : <WifiOff className="w-3.5 h-3.5 text-google-red" />}
            <span className="hidden sm:inline">{isConnected ? 'Server Online' : 'Connecting...'}</span>
          </div>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          <button
            onClick={handleLogout}
            id="driver-logout-btn"
            className="p-2 rounded-full text-surface-500 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 sm:p-6 flex flex-col justify-start space-y-5">
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-200 text-sm flex items-start gap-3 font-medium">
            <AlertTriangle className="w-5 h-5 text-google-red flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* WakeLock Warning / Info Banner */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-amber-800 dark:text-amber-300">Keep this screen open while on trip: </span>
            Mobile browsers throttle background GPS transmission. Screen Wake Lock is {wakeLockActive ? 'active' : 'inactive'}.
          </div>
        </div>

        {/* ALWAYS-VISIBLE DRIVER DETAILS CARD */}
        <div className="bg-white dark:bg-[#28292c] p-5 sm:p-6 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {activeTrip ? (
                /* Verified Photo Thumbnail */
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-soft-xs bg-surface-100 dark:bg-surface-800 flex-shrink-0">
                  <img
                    src={`/api/trips/${activeTrip._id}/driver-photo`}
                    alt={driverName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextSibling) {
                        e.currentTarget.nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                  <div
                    style={{ display: 'none' }}
                    className="w-full h-full items-center justify-center font-bold text-base text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-950/60"
                  >
                    {driverName ? driverName.slice(0, 2).toUpperCase() : 'DR'}
                  </div>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-600 dark:text-surface-300">
                  <User className="w-6 h-6" />
                </div>
              )}
              <div>
                <h2 className="text-base font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                  <span>{driverName}</span>
                </h2>
                {activeTrip ? (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Live since {formatLiveSince(activeTrip)}</span>
                  </div>
                ) : (
                  <div className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    Assigned Operator
                  </div>
                )}
              </div>
            </div>

            {activeTrip ? (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                <span className="live-dot" />
                Live Trip
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider bg-surface-100 dark:bg-surface-800 px-3 py-1 rounded-full border border-surface-200 dark:border-surface-700">
                Standby
              </span>
            )}
          </div>

          {/* Details list: Phone, License, Bus, Route */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-surface-100 dark:border-surface-800 text-xs">
            <div className="p-2.5 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200/80 dark:border-surface-700/70">
              <span className="text-[10px] text-surface-500 dark:text-surface-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3 h-3 text-primary-500" /> Phone
              </span>
              <span className="font-bold text-surface-900 dark:text-surface-100 truncate block mt-0.5">
                {driverPhone || 'Not set'}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200/80 dark:border-surface-700/70">
              <span className="text-[10px] text-surface-500 dark:text-surface-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-primary-500" /> License
              </span>
              <span className="font-bold text-surface-900 dark:text-surface-100 truncate block mt-0.5">
                {driverLicense || 'Not set'}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200/80 dark:border-surface-700/70">
              <span className="text-[10px] text-surface-500 dark:text-surface-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <Bus className="w-3 h-3 text-google-green" /> Bus
              </span>
              <span className="font-bold text-surface-900 dark:text-surface-100 truncate block mt-0.5">
                {currentBus ? `${currentBus.name} (${currentBus.plateNo})` : 'None'}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200/80 dark:border-surface-700/70">
              <span className="text-[10px] text-surface-500 dark:text-surface-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <RouteIcon className="w-3 h-3 text-blue-500" /> Route
              </span>
              <span className="font-bold text-surface-900 dark:text-surface-100 truncate block mt-0.5">
                {currentRoute ? currentRoute.name : 'None'}
              </span>
            </div>
          </div>

          {/* Incomplete warning banner */}
          {isDriverIncomplete && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs">
              <Info className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Incomplete driver profile (phone or license missing). Ask admin to add your details.</span>
            </div>
          )}

          {/* Quick End Trip button on card when trip is active */}
          {activeTrip && (
            <div className="pt-2">
              <button
                onClick={handleEndTrip}
                disabled={actionLoading}
                id="driver-card-end-trip-btn"
                className="btn-danger w-full py-3 px-6 rounded-full font-bold text-xs shadow-soft-xs hover:shadow-soft-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-red-800 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>End Live Trip</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {!activeTrip ? (
          /* ASSIGNED DUTY & TRIP LAUNCH CARD */
          <div className="bg-white dark:bg-[#28292c] p-6 sm:p-8 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-sm space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">Assigned Duty</h2>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Assigned by Dispatch
                  </span>
                </div>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                  Your vehicle and route are assigned by dispatch. No manual selection permitted.
                </p>
              </div>

              {currentBus && currentRoute ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-google-green" />
                  Ready to Depart
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800/60 flex-shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Assignment Required
                </span>
              )}
            </div>

            {/* Display Assigned Vehicle & Route (No dropdown selection) */}
            <div className="space-y-3.5">
              {/* Assigned Vehicle Card */}
              <div className="p-4 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200/90 dark:border-surface-700/80 transition-all">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-[11px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Bus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Assigned Vehicle
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                    Designated Bus
                  </span>
                </div>

                {currentBus ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                        <Bus className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                          <span>{currentBus.name}</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300">
                            {currentBus.plateNo}
                          </span>
                        </div>
                        <div className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 flex items-center gap-2">
                          <span>Capacity: {currentBus.capacity || 40} seats</span>
                          <span>•</span>
                          <span className="capitalize">{currentBus.status === 'idle' ? 'Ready (Idle)' : currentBus.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>No vehicle assigned to your profile. Contact transit dispatch to assign a bus.</span>
                  </div>
                )}
              </div>

              {/* Assigned Service Route Card */}
              <div className="p-4 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200/90 dark:border-surface-700/80 transition-all">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-[11px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                    <RouteIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Assigned Service Route
                  </span>
                  <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/60">
                    Designated Line
                  </span>
                </div>

                {currentRoute ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow-soft-xs"
                          style={{ backgroundColor: currentRoute.color || '#3b82f6' }}
                        >
                          <RouteIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-base font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                            <span>{currentRoute.name}</span>
                            {currentRoute.type === 'event' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                                Event Shuttle
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                            {currentRoute.stops?.length || 0} scheduled stops along line
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stops overview */}
                    {currentRoute.stops && currentRoute.stops.length > 0 && (
                      <div className="pt-2 border-t border-surface-200/70 dark:border-surface-700/60 flex items-center gap-1.5 text-xs text-surface-600 dark:text-surface-400 overflow-hidden">
                        <MapPin className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                        <span className="font-semibold text-surface-800 dark:text-surface-200 truncate">
                          {currentRoute.stops[0]?.stopId?.name || 'Origin'}
                        </span>
                        <span className="text-surface-400">→</span>
                        <span className="font-semibold text-surface-800 dark:text-surface-200 truncate">
                          {currentRoute.stops[currentRoute.stops.length - 1]?.stopId?.name || 'Destination'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>No service route assigned to your vehicle. Contact transit dispatch to assign a route.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Error or Assignment Incomplete Warning */}
            {(!selectedBusId || !selectedRouteId) && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Departure Restricted: </span>
                  Drivers cannot start trips without an assigned vehicle and route. Please contact your dispatch administrator to configure your duty assignment.
                </div>
              </div>
            )}

            {/* Start Live Trip Button */}
            <button
              onClick={handleOpenStartTripSheet}
              disabled={actionLoading || !selectedBusId || !selectedRouteId}
              id="start-trip-btn"
              className="btn-success w-full py-3.5 px-6 rounded-full font-bold text-sm shadow-soft-xs hover:shadow-soft-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? (
                <div className="w-5 h-5 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
              ) : !selectedBusId || !selectedRouteId ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Assignment Required to Start Trip</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Verify Photo & Start Live Trip</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* ACTIVE TRIP STATUS MONITOR */
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#28292c] border-2 border-emerald-500/30 p-6 sm:p-7 rounded-3xl shadow-soft-md space-y-6">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                  <span className="live-dot" />
                  Trip Active & Streaming
                </span>
                <span className="text-xs text-surface-500 dark:text-surface-400 font-mono">
                  ID: #{activeTrip._id.slice(-6)}
                </span>
              </div>

              {/* Route & Bus Details */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-surface-200 dark:border-surface-800">
                <div>
                  <div className="text-xs text-surface-500 dark:text-surface-400 font-medium">Current Route</div>
                  <div className="text-base font-bold text-surface-900 dark:text-surface-100 truncate mt-0.5">{currentRoute?.name || 'Assigned Route'}</div>
                </div>
                <div>
                  <div className="text-xs text-surface-500 dark:text-surface-400 font-medium">Assigned Bus</div>
                  <div className="text-base font-bold text-surface-900 dark:text-surface-100 truncate mt-0.5">{currentBus?.name || 'Bus Vehicle'}</div>
                </div>
              </div>

              {/* Telemetry Dashboard Stats */}
              <div className="grid grid-cols-2 gap-3">
                {/* GPS Accuracy */}
                <div className="p-4 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200/90 dark:border-surface-700/80">
                  <div className="text-[11px] font-semibold text-surface-500 dark:text-surface-400 mb-1 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" /> GPS Accuracy
                  </div>
                  <div className="text-xl font-extrabold text-surface-900 dark:text-surface-100">
                    {geoStatus.accuracy != null ? `±${Math.round(geoStatus.accuracy)} m` : 'Acquiring...'}
                  </div>
                  <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                    {geoStatus.accuracy && geoStatus.accuracy < 25 ? 'High Precision' : 'Acceptable'}
                  </div>
                </div>

                {/* Transmitted */}
                <div className="p-4 rounded-2xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200/90 dark:border-surface-700/80">
                  <div className="text-[11px] font-semibold text-surface-500 dark:text-surface-400 mb-1 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-google-green" /> Broadcast Rate
                  </div>
                  <div className="text-xl font-extrabold text-surface-900 dark:text-surface-100">
                    {geoStatus.lastSent ? 'Every ~4s' : 'Waiting...'}
                  </div>
                  <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                    {geoStatus.lastSent ? `${new Date(geoStatus.lastSent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'No ping yet'}
                  </div>
                </div>
              </div>

              {/* Coordinates */}
              {geoStatus.lat != null && (
                <div className="p-3 rounded-xl bg-surface-50 dark:bg-[#1f1f23] border border-surface-200/80 dark:border-surface-700/80 font-mono text-xs text-surface-600 dark:text-surface-300 flex items-center justify-between">
                  <span>Lat: {geoStatus.lat.toFixed(5)}</span>
                  <span>Lng: {geoStatus.lng.toFixed(5)}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => setShowDelayModal(true)}
                  id="report-delay-btn"
                  className="btn-secondary w-full py-3 rounded-full text-xs font-semibold flex items-center justify-center gap-2 border-amber-300 text-amber-900 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Report Traffic Delay (AI Advisory)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* StartTripSheet Drawer Modal */}
        {showStartTripSheet && (
          <StartTripSheet
            isOpen={showStartTripSheet}
            onClose={() => setShowStartTripSheet(false)}
            driver={{ name: driverName, phone: driverPhone, license: driverLicense }}
            bus={currentBus}
            route={currentRoute}
            onStartTrip={handleStartTripWithPhoto}
          />
        )}

        {/* Modal for manual delay announcement */}
        {showDelayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#28292c] max-w-md w-full p-6 sm:p-7 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" /> Report Traffic Delay
                </h3>
                <button
                  onClick={() => setShowDelayModal(false)}
                  className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 p-1 rounded-full hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">
                Trigger Gemini AI to draft a calm, concise passenger advisory for students waiting at stops on this route.
              </p>

              {delaySuccess ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-google-green" /> Delay advisory drafted successfully!
                </div>
              ) : (
                <form onSubmit={handleReportDelay} className="space-y-4">
                  <div>
                    <label className="label">
                      Reason for Delay (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Heavy campus event traffic, road construction..."
                      value={delayReason}
                      onChange={(e) => setDelayReason(e.target.value)}
                      className="input"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDelayModal(false)}
                      className="btn-subtle px-4 py-2 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={delaySubmitting}
                      className="btn-primary px-5 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                      {delaySubmitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Generate & Send</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
