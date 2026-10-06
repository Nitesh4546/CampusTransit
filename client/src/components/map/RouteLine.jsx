import React from 'react';
import { Polyline } from 'react-leaflet';

export default function RouteLine({ polyline = [], color = '#1a73e8', isSelected = false, onClick }) {
  if (polyline.length < 2) return null;

  return (
    <Polyline
      positions={polyline}
      eventHandlers={onClick ? { click: onClick } : undefined}
      pathOptions={{
        color,
        weight: isSelected ? 5 : 3.5,
        opacity: isSelected ? 0.95 : 0.6,
        dashArray: isSelected ? null : '6 6',
        className: 'route-line cursor-pointer',
      }}
    />
  );
}
