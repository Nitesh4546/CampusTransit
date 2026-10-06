export const mapLink = ({ routeId, stopId, eventId } = {}) => {
  const p = new URLSearchParams();
  if (routeId) p.set('focusRoute', routeId);
  if (stopId) p.set('focusStop', stopId);
  return eventId ? `/events/${eventId}?${p}` : `/?${p}`;
};
