import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

// Attach token from store
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401s
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

export default api;

// Typed API helpers
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

export const routesApi = {
  list: (params) => api.get('/routes', { params }),
  get: (id) => api.get(`/routes/${id}`),
  create: (data) => api.post('/routes', data),
  update: (id, data) => api.put(`/routes/${id}`, data),
  delete: (id) => api.delete(`/routes/${id}`),
  buildPolyline: (id) => api.post(`/routes/${id}/build-polyline`),
  setEventMode: (id, data) => api.post(`/routes/${id}/event-mode`, data),
};

export const stopsApi = {
  list: () => api.get('/stops'),
  get: (id) => api.get(`/stops/${id}`),
  create: (data) => api.post('/stops', data),
  update: (id, data) => api.put(`/stops/${id}`, data),
  delete: (id) => api.delete(`/stops/${id}`),
};

export const busesApi = {
  list: () => api.get('/buses'),
  get: (id) => api.get(`/buses/${id}`),
  getStats: (id) => api.get(`/buses/${id}/stats`),
  create: (data) => api.post('/buses', data),
  update: (id, data) => api.put(`/buses/${id}`, data),
  delete: (id) => api.delete(`/buses/${id}`),
};

export const tripsApi = {
  start: (data) => api.post('/trips/start', data),
  end: (id) => api.post(`/trips/${id}/end`),
  active: () => api.get('/trips/active'),
  get: (id) => api.get(`/trips/${id}`),
};

export const eventsApi = {
  list: () => api.get('/events'),
  listAll: () => api.get('/events/all'),
  get: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
};

export const announcementsApi = {
  list: (params) => api.get('/announcements', { params }),
  drafts: () => api.get('/announcements/drafts'),
  create: (data) => api.post('/announcements', data),
  generateDelay: (tripId, reason) => api.post('/announcements/generate-delay', { tripId, reason }),
  publish: (id) => api.patch(`/announcements/${id}/publish`),
};

export const usersApi = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const etaApi = {
  forRoute: (routeId) => api.get(`/eta/${routeId}`),
};

export const driverApi = {
  uploadPhoto: (formData) => api.post('/driver/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};
