import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'md:w-[480px]',
  className = '',
}) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Handle Escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      // Trap focus
      if (e.key === 'Tab' && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus first focusable element or drawer container
    const timer = setTimeout(() => {
      if (drawerRef.current) {
        const firstFocusable = drawerRef.current.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          drawerRef.current.focus();
        }
      }
    }, 50);

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'drawer-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container:
          Desktop: Right slide-over (top-0 bottom-0 right-0)
          Mobile: Bottom sheet (bottom-0 left-0 right-0 max-h-[90vh] rounded-t-3xl)
      */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={`fixed z-50 flex flex-col bg-white dark:bg-[#28292c] text-surface-900 dark:text-surface-100 shadow-soft-2xl border-surface-200 dark:border-surface-800 transition-transform duration-200 ease-out outline-none
          /* Mobile Bottom Sheet */
          inset-x-0 bottom-0 max-h-[90vh] rounded-t-3xl border-t
          /* Desktop Slide-Over */
          md:inset-y-0 md:left-auto md:right-0 md:max-h-full md:rounded-none md:border-t-0 md:border-l ${width} ${className}`}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-300 dark:bg-surface-600" />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-800 sticky top-0 bg-white/95 dark:bg-[#28292c]/95 backdrop-blur-sm z-10">
          <div className="min-w-0 pr-4">
            {title && (
              <h3 id="drawer-title" className="text-base sm:text-lg font-bold text-surface-900 dark:text-surface-100 truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}
