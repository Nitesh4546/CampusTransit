import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import LoadingSpinner from './components/ui/LoadingSpinner.jsx';

// Lazy-loaded pages
const MapPage = lazy(() => import('./pages/student/MapPage.jsx'));
const RouteDetail = lazy(() => import('./pages/student/RouteDetail.jsx'));
const EventsPage = lazy(() => import('./pages/student/EventsPage.jsx'));
const EventDetail = lazy(() => import('./pages/student/EventDetail.jsx'));

const DriverLogin = lazy(() => import('./pages/driver/DriverLogin.jsx'));
const DriverHome = lazy(() => import('./pages/driver/DriverHome.jsx'));

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const RoutesAdmin = lazy(() => import('./pages/admin/RoutesAdmin.jsx'));
const StopsAdmin = lazy(() => import('./pages/admin/StopsAdmin.jsx'));
const BusesAdmin = lazy(() => import('./pages/admin/BusesAdmin.jsx'));
const EventsAdmin = lazy(() => import('./pages/admin/EventsAdmin.jsx'));
const AnnouncementsAdmin = lazy(() => import('./pages/admin/AnnouncementsAdmin.jsx'));
const UsersAdmin = lazy(() => import('./pages/admin/UsersAdmin.jsx'));

function RequireAuth({ children, role }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/driver/login" replace />;
  if (role && user?.role !== role && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequireAdmin({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner fullscreen />}>
        <Routes>
          {/* Student routes (public) */}
          <Route path="/" element={<MapPage />} />
          <Route path="/routes/:id" element={<RouteDetail />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetail />} />

          {/* Login routes (Admin & Driver) */}
          <Route path="/login" element={<DriverLogin />} />
          <Route path="/admin/login" element={<DriverLogin />} />
          <Route path="/driver/login" element={<DriverLogin />} />
          <Route path="/driver" element={
            <RequireAuth role="driver">
              <DriverHome />
            </RequireAuth>
          } />

          {/* Admin routes */}
          <Route path="/admin" element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="routes" element={<RoutesAdmin />} />
            <Route path="stops" element={<StopsAdmin />} />
            <Route path="buses" element={<BusesAdmin />} />
            <Route path="events" element={<EventsAdmin />} />
            <Route path="announcements" element={<AnnouncementsAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
