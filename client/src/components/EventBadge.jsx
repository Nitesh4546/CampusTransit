import React from 'react';
import { Calendar, Clock } from 'lucide-react';

export default function EventBadge({ event, showTime = true }) {
  const now = new Date();
  const starts = new Date(event.startsAt);
  const ends = new Date(event.endsAt);
  const isOngoing = now >= starts && now <= ends;
  const isUpcoming = now < starts;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
      isOngoing
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : isUpcoming
        ? 'bg-primary-50 text-primary-700 border-primary-200'
        : 'bg-surface-100 text-surface-600 border-surface-200'
    }`}>
      {isOngoing ? (
        <span className="live-dot w-2 h-2 flex-shrink-0" />
      ) : (
        <Calendar className="w-3 h-3" />
      )}
      {isOngoing ? 'Live Now' : isUpcoming ? 'Upcoming' : 'Ended'}
      {showTime && isUpcoming && (
        <span className="text-current/70">
          · {starts.toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>
      )}
    </div>
  );
}
