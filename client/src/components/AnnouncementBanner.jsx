import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAnnouncementStore } from '../store/announcementStore.js';

export default function AnnouncementBanner({ routeId }) {
  const { announcements } = useAnnouncementStore();
  const [dismissed, setDismissed] = React.useState(new Set());

  const relevant = announcements.filter(a =>
    (a.routeId === routeId || a.routeId?._id === routeId || !routeId) &&
    !dismissed.has(a._id)
  ).slice(0, 3);

  if (!relevant.length) return null;

  return (
    <div className="absolute top-16 left-3 right-3 z-[900] flex flex-col gap-2.5 animate-slide-up md:left-auto md:right-6 md:w-96 pointer-events-none">
      {relevant.map(ann => {
        const isDelay = ann.kind === 'delay';
        const isCancel = ann.kind === 'cancellation';
        const isEvent = ann.kind === 'event';

        const borderClass = isDelay ? 'border-amber-200' : isCancel ? 'border-red-200' : isEvent ? 'border-primary-200' : 'border-surface-200';
        const badgeClass = isDelay ? 'bg-amber-50 text-amber-800 border-amber-200' : isCancel ? 'bg-red-50 text-red-800 border-red-200' : isEvent ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-surface-100 text-surface-700 border-surface-200';
        const iconColor = isDelay ? 'text-amber-600' : isCancel ? 'text-red-600' : isEvent ? 'text-primary-600' : 'text-surface-500';

        return (
          <div
            key={ann._id}
            className={`pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-3.5 border ${borderClass} shadow-soft-md flex items-start gap-3 transition-all`}
          >
            <div className="p-1.5 rounded-full bg-surface-50 mt-0.5 flex-shrink-0">
              <AlertTriangle className={`w-4 h-4 ${iconColor}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeClass}`}>
                  {ann.kind}
                </span>
                {ann.source === 'gemini' && (
                  <span className="text-[10px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200/60">
                    ✦ AI Advisory
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-surface-800 font-medium leading-snug">
                {ann.textShort || ann.text}
              </p>
            </div>

            <button
              id={`dismiss-ann-${ann._id}`}
              onClick={() => setDismissed(s => new Set([...s, ann._id]))}
              className="text-surface-400 hover:text-surface-700 p-1 rounded-full hover:bg-surface-100 transition-colors flex-shrink-0"
              title="Dismiss announcement"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
