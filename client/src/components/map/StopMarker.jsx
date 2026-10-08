import React, { forwardRef, useRef, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

function createStopIcon(isEvent = false) {
  const color = isEvent ? '#f9ab00' : '#5f6368';
  const fillColor = isEvent ? '#fef7e0' : '#ffffff';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
      <circle cx="11" cy="11" r="9" fill="${fillColor}" stroke="${color}" stroke-width="2.5"/>
      <circle cx="11" cy="11" r="4" fill="${color}"/>
    </svg>`;

  return L.divIcon({
    className: 'stop-marker cursor-pointer',
    html: svg,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

const StopMarker = forwardRef(function StopMarker(
  { lat, lng, name, code, isEvent = false, onClick },
  ref
) {
  const isPinnedRef = useRef(false);
  const closeTimerRef = useRef(null);

  const eventHandlers = useMemo(
    () => ({
      mouseover: (e) => {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
        e.target.openPopup();
      },
      mouseout: (e) => {
        if (!isPinnedRef.current) {
          closeTimerRef.current = setTimeout(() => {
            if (!isPinnedRef.current) {
              e.target.closePopup();
            }
          }, 150);
        }
      },
      click: (e) => {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
        isPinnedRef.current = true;
        e.target.openPopup();
        onClick?.(e);
      },
      popupclose: () => {
        isPinnedRef.current = false;
      },
    }),
    [onClick]
  );

  return (
    <Marker
      ref={ref}
      position={[lat, lng]}
      icon={createStopIcon(isEvent)}
      eventHandlers={eventHandlers}
    >
      <Popup autoPan={false}>
        <div className="text-sm p-1 font-sans">
          <div className="font-bold text-surface-900">{name}</div>
          {code && <div className="text-surface-600 text-xs mt-0.5">Stop Code: #{code}</div>}
          {isEvent && (
            <div className="mt-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full inline-block border border-amber-200">
              Event Shuttle Hub
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
});

export default StopMarker;
