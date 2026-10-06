import React from 'react';
import { Clock, AlertTriangle, CheckCircle, MapPin } from 'lucide-react';
import { useMapFocusStore } from '../store/mapFocusStore.js';

export default function EtaList({ etas = [], busName }) {
  const focusStop = useMapFocusStore((state) => state.focusStop);

  if (!etas.length) {
    return (
      <div className="text-center py-4 text-surface-500 dark:text-surface-400 text-sm">
        No ETA data available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {busName && (
        <div className="text-xs text-surface-600 dark:text-surface-400 mb-2 font-medium flex items-center gap-1.5">
          <span className="text-primary-600 dark:text-primary-400 font-semibold">{busName}</span>
          <span>• Live estimated arrivals</span>
        </div>
      )}
      {etas.map((eta, idx) => {
        const isArrived = eta.status === 'arrived';
        const isDelayed = eta.status === 'delayed';

        return (
          <div
            key={eta.stopId || idx}
            id={`eta-stop-${eta.stopId || idx}`}
            onClick={() => eta.stopId && focusStop(eta.stopId)}
            title="Click to focus stop on map"
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
              isArrived
                ? 'bg-surface-50/70 dark:bg-surface-800/40 border-surface-200/60 dark:border-surface-700/60 opacity-60'
                : isDelayed
                ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60 hover:border-amber-300'
                : 'bg-white dark:bg-[#1f1f1f] border-surface-200/80 dark:border-surface-700/80 hover:border-primary-400 dark:hover:border-primary-500 shadow-soft-xs hover:shadow-soft-sm'
            }`}
          >
            {/* Status Icon */}
            <div className={`p-1.5 rounded-full flex-shrink-0 ${
              isArrived
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-google-green'
                : isDelayed
                ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300'
            }`}>
              {isArrived ? (
                <CheckCircle className="w-4 h-4" />
              ) : isDelayed ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
            </div>

            {/* Stop Name */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{eta.stopName}</div>
              {isDelayed && eta.delayMin > 0 ? (
                <div className="text-xs font-medium text-amber-700 dark:text-amber-400">+{eta.delayMin} min delay</div>
              ) : (
                <div className="text-[11px] text-surface-500 dark:text-surface-400">Stop #{idx + 1}</div>
              )}
            </div>

            {/* ETA Pill */}
            <div className="flex items-center gap-1.5 text-right flex-shrink-0">
              {isArrived ? (
                <span className="badge-success text-xs font-bold">Arrived</span>
              ) : eta.etaMinutes != null ? (
                <div className="flex items-center gap-1">
                  <Clock className={`w-3.5 h-3.5 ${isDelayed ? 'text-amber-600' : 'text-primary-600 dark:text-primary-400'}`} />
                  <span className={`font-mono text-sm font-bold ${
                    isDelayed ? 'text-amber-700 dark:text-amber-300' : 'text-primary-700 dark:text-primary-300'
                  }`}>
                    {eta.etaMinutes} min
                  </span>
                </div>
              ) : (
                <span className="text-xs text-surface-400">--</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
