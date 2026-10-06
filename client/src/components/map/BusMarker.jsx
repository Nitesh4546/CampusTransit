import React, { useRef, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useLiveBusStore } from '../../store/liveBusStore.js';
import DriverChip from '../DriverChip.jsx';

function createBusIcon(heading = 0, color = '#1a73e8') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="17" fill="white" stroke="${color}" stroke-width="2.5"/>
      <circle cx="19" cy="19" r="13" fill="${color}"/>
      <polygon points="19,8 23,17 19,15 15,17" fill="white" transform="rotate(${heading}, 19, 19)"/>
    </svg>`;

  return L.divIcon({
    className: 'bus-marker',
    html: svg,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });
}

export default function BusMarker({ bus, onBusClick }) {
  const markerRef = useRef(null);
  const driver = useLiveBusStore((state) => state.drivers[bus.tripId]);

  useEffect(() => {
    if (markerRef.current) {
      const icon = createBusIcon(bus.heading || 0);
      markerRef.current.setIcon(icon);
    }
  }, [bus.heading]);

  if (!bus.lat || !bus.lng) return null;

  const busLabel = bus.busName || (bus.busId ? `Bus #${bus.busId.slice(-6)}` : 'Campus Shuttle');

  return (
    <Marker
      ref={markerRef}
      position={[bus.lat, bus.lng]}
      icon={createBusIcon(bus.heading || 0)}
    >
      <Popup className="custom-popup">
        <div className="text-sm p-1.5 min-w-[220px] space-y-2 font-sans">
          <div
            onClick={() => onBusClick?.(bus)}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            title="Click to view full bus details"
          >
            <div className="font-bold text-surface-900 dark:text-surface-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate pr-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="font-bold text-xs truncate">{busLabel}</span>
              </div>
              <span className="text-[11px] font-semibold text-surface-600 dark:text-surface-300 flex-shrink-0">
                {Math.round(bus.speedKmh || 0)} km/h
              </span>
            </div>
            {bus.plateNo && (
              <div className="text-[10px] font-mono text-surface-500 dark:text-surface-400 mt-0.5">
                Plate: {bus.plateNo}
              </div>
            )}
          </div>

          <div className="pt-1.5 border-t border-surface-200 dark:border-surface-700">
            <DriverChip
              driver={driver || { name: 'Assigned Driver' }}
              busLabel={bus.plateNo ? `Plate: ${bus.plateNo}` : `Bus #${bus.busId?.slice(-6) || ''}`}
            />
          </div>

          <div className="text-surface-500 dark:text-surface-400 text-[10px] flex items-center justify-between pt-1 border-t border-surface-100 dark:border-surface-800">
            <span>Live telemetry</span>
            <span>{new Date(bus.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          {bus.offline && <div className="text-red-600 font-medium text-xs">⚠ Signal lost</div>}

          {onBusClick && (
            <button
              type="button"
              onClick={() => onBusClick(bus)}
              className="w-full btn-primary text-xs py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-soft-xs mt-2 font-bold cursor-pointer"
            >
              <span>View Bus Details</span>
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
