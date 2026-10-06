import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

/**
 * BackToAdmin pill button
 * Only visible to users with role === 'admin' on student-facing pages.
 * Navigates back to location.state?.from, falling back to '/admin'.
 */
export default function BackToAdmin({ className = '' }) {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  const handleBack = () => {
    const destination = location.state?.from || '/admin';
    navigate(destination);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      id="back-to-admin-btn"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-900 text-white dark:bg-surface-100 dark:text-surface-900 hover:bg-surface-800 dark:hover:bg-white shadow-soft-sm transition-all flex-shrink-0 cursor-pointer ${className}`}
      title="Back to Admin Dashboard"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>Back to admin</span>
    </button>
  );
}
