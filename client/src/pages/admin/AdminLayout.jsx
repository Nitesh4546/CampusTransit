import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Route,
  MapPin,
  Bus,
  Calendar,
  Bell,
  Users,
  LogOut,
  Map as MapIcon,
  Menu,
  X,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';

const navItems = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, exact: true },
  { name: 'Routes', path: '/admin/routes', icon: Route },
  { name: 'Stops', path: '/admin/stops', icon: MapPin },
  { name: 'Buses', path: '/admin/buses', icon: Bus },
  { name: 'Events', path: '/admin/events', icon: Calendar },
  { name: 'Announcements', path: '/admin/announcements', icon: Bell },
  { name: 'Users', path: '/admin/users', icon: Users },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/driver/login');
  };

  return (
    <div className="min-h-dvh flex bg-surface-50 dark:bg-[#1f1f1f] text-surface-900 dark:text-surface-100 font-sans transition-colors duration-150">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-surface-200 dark:border-surface-800 bg-white dark:bg-[#28292c] p-5 sticky top-0 h-screen select-none shadow-soft-xs z-30 transition-colors duration-150">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1 py-1 mb-5 border-b border-surface-200 dark:border-surface-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-800/60 flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-soft-xs">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-surface-900 dark:text-surface-100 tracking-tight">LiveBus Control</div>
              <div className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold uppercase tracking-wider">Campus Transit Admin</div>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-semibold border border-primary-200/70 dark:border-primary-800/60 shadow-soft-xs'
                      : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-surface-200 dark:border-surface-800 space-y-3">
          <Link
            to="/"
            state={{ from: location.pathname + location.search }}
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-surface-700 dark:text-surface-300 bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 border border-surface-200/80 dark:border-surface-700 transition-colors"
          >
            <span className="flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-google-green" />
              <span>Open Student Map</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-surface-400" />
          </Link>

          <div className="p-3 rounded-2xl bg-surface-50 dark:bg-surface-800/70 border border-surface-200/80 dark:border-surface-700 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-bold text-surface-900 dark:text-surface-100 truncate">{user?.name || 'Administrator'}</div>
              <div className="text-[11px] text-surface-500 dark:text-surface-400 truncate">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-xl text-surface-400 hover:text-google-red hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Mobile Header */}
        <header className="md:hidden bg-white dark:bg-[#28292c] border-b border-surface-200 dark:border-surface-800 p-4 flex items-center justify-between sticky top-0 z-40 shadow-soft-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <Bus className="w-4 h-4" />
            </div>
            <span className="font-bold text-surface-900 dark:text-surface-100 text-sm">LiveBus Admin</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-surface-600 dark:text-surface-300 hover:text-surface-900 hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-[#28292c] border-b border-surface-200 dark:border-surface-800 p-4 space-y-1.5 shadow-soft-md">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                      isActive
                        ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-semibold border border-primary-200 dark:border-primary-800'
                        : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
            <div className="pt-3 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between">
              <Link
                to="/"
                state={{ from: location.pathname + location.search }}
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs text-primary-600 dark:text-primary-400 font-semibold p-2"
              >
                Open Student Map
              </Link>
              <button
                onClick={handleLogout}
                className="text-xs text-google-red font-semibold p-2 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
