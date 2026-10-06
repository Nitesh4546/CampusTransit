import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

let socket = null;

export function getSocket() {
  if (!socket) {
    const token = useAuthStore.getState().token;
    socket = io(SOCKET_URL, {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => console.log('[Socket] Connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('[Socket] Disconnected:', reason));
    socket.on('connect_error', (err) => console.warn('[Socket] Error:', err.message));
  }
  return socket;
}

export function reconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  return getSocket();
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
