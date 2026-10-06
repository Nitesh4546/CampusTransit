import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';

export default function ThemeToggle({ className = '', variant = 'icon' }) {
  const { isDark, toggleTheme } = useTheme();

  if (variant === 'button') {
    return (
      <button
        onClick={toggleTheme}
        id="theme-toggle-btn"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
          isDark
            ? 'bg-surface-800 text-surface-200 border-surface-700 hover:bg-surface-700'
            : 'bg-white text-surface-700 border-surface-300 hover:bg-surface-100'
        } ${className}`}
        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label="Toggle theme"
      >
        {isDark ? (
          <>
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Light Mode</span>
          </>
        ) : (
          <>
            <Moon className="w-3.5 h-3.5 text-surface-600" />
            <span>Dark Mode</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      id="theme-toggle-btn"
      className={`p-2 rounded-full border transition-all duration-150 flex items-center justify-center ${
        isDark
          ? 'bg-surface-800 text-amber-400 border-surface-700 hover:bg-surface-700 hover:text-amber-300'
          : 'bg-white text-surface-600 border-surface-300 hover:bg-surface-100 hover:text-surface-900 shadow-soft-xs'
      } ${className}`}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 transition-transform hover:-rotate-12" />
      )}
    </button>
  );
}
