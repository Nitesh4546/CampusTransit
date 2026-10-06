import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket/socket.js';

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 2000,
  timeout: 10000,
};

const SEND_INTERVAL_MS = 4000;
const BUFFER_MAX = 20;

/**
 * Hook for driver GPS sending via Socket.io.
 * @param {string} tripId - active trip ID
 * @param {boolean} active - whether sending is active
 */
export function useGeolocationSender(tripId, active) {
  const [status, setStatus] = useState({ lat: null, lng: null, accuracy: null, lastSent: null, error: null });
  const watchRef = useRef(null);
  const lastSentRef = useRef(0);
  const bufferRef = useRef([]);

  useEffect(() => {
    if (!active || !tripId) {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setStatus(s => ({ ...s, error: 'Geolocation not supported by this browser.' }));
      return;
    }

    const socket = getSocket();

    function sendLocation(pos) {
      const { latitude: lat, longitude: lng, speed, heading, accuracy } = pos.coords;
      const now = Date.now();

      setStatus({ lat, lng, accuracy, lastSent: new Date(), error: null });

      const payload = {
        tripId,
        lat,
        lng,
        speed: speed ? speed * 3.6 : 0, // m/s → km/h
        heading: heading || 0,
        accuracy: accuracy || 50,
        ts: now,
      };

      if (socket.connected) {
        // Flush buffer first
        bufferRef.current.forEach(p => socket.emit('driver:location', p));
        bufferRef.current = [];

        if (now - lastSentRef.current >= SEND_INTERVAL_MS) {
          socket.emit('driver:location', payload);
          lastSentRef.current = now;
        }
      } else {
        // Buffer while disconnected
        bufferRef.current = [...bufferRef.current, payload].slice(-BUFFER_MAX);
      }
    }

    function onError(err) {
      setStatus(s => ({ ...s, error: err.message }));
    }

    watchRef.current = navigator.geolocation.watchPosition(sendLocation, onError, GEO_OPTIONS);

    // Flush buffer on reconnect
    socket.on('connect', () => {
      bufferRef.current.forEach(p => socket.emit('driver:location', p));
      bufferRef.current = [];
    });

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [tripId, active]);

  return status;
}
