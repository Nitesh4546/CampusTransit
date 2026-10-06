import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bus, KeyRound, Mail, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { authApi } from '../../api/index.js';
import { useAuthStore } from '../../store/authStore.js';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';

export default function DriverLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const { user, isAuthenticated, login, logout } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await authApi.login(email.trim(), password);
      const { user: authedUser, token } = res.data;
      login(authedUser, token);

      if (authedUser.role === 'admin') {
        navigate('/admin');
      } else if (authedUser.role === 'driver') {
        navigate('/driver');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      const serverMsg = err.response?.data?.error?.message;
      if (serverMsg) {
        setError(serverMsg);
      } else if (!err.response) {
        setError('Cannot connect to backend server. Please verify the server is running on port 5000.');
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-dvh flex flex-col justify-between items-center p-4 sm:p-6 bg-surface-50 dark:bg-[#1f1f1f] text-surface-900 dark:text-surface-100 font-sans transition-colors duration-150">
      {/* Top Navbar */}
      <header className="w-full max-w-4xl flex items-center justify-between py-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 transition-colors p-2 rounded-full hover:bg-surface-100 dark:hover:bg-surface-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Live Map</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="w-full max-w-md my-auto py-6">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white dark:bg-[#28292c] text-primary-600 dark:text-primary-400 border border-surface-200/90 dark:border-surface-800 shadow-soft-xs mb-3">
            <Bus className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-surface-900 dark:text-surface-100">
            Sign In to Portal
          </h1>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
            Access Administrator Controls or Driver Telemetry
          </p>
        </div>

        {/* Existing Session Alert */}
        {isAuthenticated && user && (
          <div className="mb-4 p-4 rounded-2xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800/60 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-primary-900 dark:text-primary-200 block">
                Signed in as {user.name} ({user.role})
              </span>
              <span className="text-primary-700 dark:text-primary-400">{user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(user.role === 'admin' ? '/admin' : '/driver')}
                className="btn-primary py-1 px-3 text-xs rounded-full"
              >
                Go to {user.role === 'admin' ? 'Admin' : 'Driver'}
              </button>
              <button
                type="button"
                onClick={logout}
                className="p-1 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
                title="Sign out of current account"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white dark:bg-[#28292c] p-7 sm:p-9 rounded-3xl border border-surface-200 dark:border-surface-800 shadow-soft-md relative">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 flex items-start gap-3 text-red-800 dark:text-red-300 text-sm font-medium">
              <AlertCircle className="w-5 h-5 text-google-red flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  id="driver-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@campus.edu or driver1@campus.edu"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  id="driver-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="driver-login-btn"
              className="btn-primary w-full py-3 rounded-full text-sm font-bold shadow-soft-xs hover:shadow-soft-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>


        </div>
      </div>

      {/* Footer */}
      <footer className="w-full text-center py-4 text-xs text-surface-400">
        LiveBus Campus Transit System
      </footer>
    </div>
  );
}
