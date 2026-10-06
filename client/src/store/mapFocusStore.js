import { create } from 'zustand';

export const useMapFocusStore = create((set) => ({
  target: null,

  focusRoute: (id) =>
    set((state) => ({
      target: {
        type: 'route',
        id,
        nonce: (state.target?.nonce || 0) + 1,
      },
    })),

  focusStop: (id) =>
    set((state) => ({
      target: {
        type: 'stop',
        id,
        nonce: (state.target?.nonce || 0) + 1,
      },
    })),

  clear: () => set({ target: null }),
  clearTarget: () => set({ target: null }),
}));
