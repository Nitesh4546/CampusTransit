import { create } from 'zustand';

export const useLiveBusStore = create((set, get) => ({
  buses: {},          // { [tripId]: BusLive }
  etas: {},           // { [routeId]: { [tripId]: EtaData } }
  drivers: {},        // { [tripId]: { name, photoUrl, phone?, license? } }
  selectedRouteIds: [],
  offlineIds: new Set(),

  updateBus: (busLive) => set(s => ({
    buses: { ...s.buses, [busLive.tripId]: busLive },
  })),

  setDriver: (tripId, driverInfo) => set(s => ({
    drivers: { ...s.drivers, [tripId]: driverInfo },
  })),

  removeDriver: (tripId) => set(s => {
    const drivers = { ...s.drivers };
    delete drivers[tripId];
    return { drivers };
  }),

  setBusOffline: (tripId) => set(s => {
    const buses = { ...s.buses };
    if (buses[tripId]) buses[tripId] = { ...buses[tripId], offline: true };
    return { buses, offlineIds: new Set([...s.offlineIds, tripId]) };
  }),

  removeBus: (tripId) => set(s => {
    const buses = { ...s.buses };
    delete buses[tripId];
    const drivers = { ...s.drivers };
    delete drivers[tripId];
    const offlineIds = new Set(s.offlineIds);
    offlineIds.delete(tripId);
    return { buses, drivers, offlineIds };
  }),

  updateEtas: (routeId, tripId, etas) => set(s => ({
    etas: {
      ...s.etas,
      [routeId]: { ...(s.etas[routeId] || {}), [tripId]: etas },
    },
  })),

  setSelectedRoutes: (routeIds) => set({ selectedRouteIds: routeIds }),
  addSelectedRoute: (routeId) => set(s => ({
    selectedRouteIds: s.selectedRouteIds.includes(routeId)
      ? s.selectedRouteIds
      : [...s.selectedRouteIds, routeId],
  })),
  removeSelectedRoute: (routeId) => set(s => ({
    selectedRouteIds: s.selectedRouteIds.filter(id => id !== routeId),
  })),

  getBusesForRoute: (routeId) => {
    const { buses } = get();
    return Object.values(buses).filter(b => b.routeId === routeId);
  },

  getAllActiveBuses: () => Object.values(get().buses),

  getDriverForTrip: (tripId) => get().drivers[tripId] || null,

  clearAll: () => set({ buses: {}, etas: {}, drivers: {} }),
}));
