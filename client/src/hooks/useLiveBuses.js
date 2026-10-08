import { useEffect, useRef } from 'react';
import { getSocket } from '../socket/socket.js';
import { useLiveBusStore } from '../store/liveBusStore.js';
import { useAnnouncementStore } from '../store/announcementStore.js';

/**
 * Subscribe to real-time bus updates for the given routeIds.
 * Manages socket subscriptions and updates Zustand stores.
 */
export function useLiveBuses(routeIds = []) {
  const socketRef = useRef(null);
  const { updateBus, setBusOffline, removeBus, updateEtas, setDriver, removeDriver } = useLiveBusStore();
  const { addAnnouncement } = useAnnouncementStore();

  useEffect(() => {
    if (!routeIds.length) return;

    const socket = getSocket();
    socketRef.current = socket;

    // Subscribe
    socket.emit('student:subscribe', { routeIds });

    const onSnapshot = ({ buses = [], announcements = [], drivers = {} }) => {
      buses.forEach(b => updateBus(b));
      announcements.forEach(a => addAnnouncement(a));
      if (drivers) {
        Object.entries(drivers).forEach(([tripId, driverInfo]) => {
          setDriver(tripId, driverInfo);
        });
      }
    };

    const onTripStarted = ({ tripId, driver }) => {
      if (tripId && driver) {
        setDriver(tripId, driver);
      }
    };

    const onTripEnded = ({ tripId }) => {
      if (tripId) {
        removeBus(tripId);
        removeDriver(tripId);
      }
    };

    const onBusUpdate = (busLive) => {
      if (!routeIds.length || routeIds.includes(busLive.routeId)) {
        updateBus(busLive);
      }
    };

    const onBusOffline = ({ tripId }) => {
      setBusOffline(tripId);
      setTimeout(() => {
        removeBus(tripId);
        removeDriver(tripId);
      }, 30000);
    };

    const onEtaUpdate = ({ routeId, tripId, etas }) => {
      if (routeIds.includes(routeId)) {
        updateEtas(routeId, tripId, etas);
      }
    };

    const onAnnouncement = (ann) => addAnnouncement(ann);

    socket.on('snapshot', onSnapshot);
    socket.on('trip:started', onTripStarted);
    socket.on('trip:ended', onTripEnded);
    socket.on('bus:update', onBusUpdate);
    socket.on('bus:offline', onBusOffline);
    socket.on('eta:update', onEtaUpdate);
    socket.on('announcement:new', onAnnouncement);

    return () => {
      socket.emit('student:unsubscribe', { routeIds });
      socket.off('snapshot', onSnapshot);
      socket.off('trip:started', onTripStarted);
      socket.off('trip:ended', onTripEnded);
      socket.off('bus:update', onBusUpdate);
      socket.off('bus:offline', onBusOffline);
      socket.off('eta:update', onEtaUpdate);
      socket.off('announcement:new', onAnnouncement);
    };
  }, [routeIds.join(',')]);
}
