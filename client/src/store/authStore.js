import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      updateUser: (updates) => set(s => ({ user: { ...s.user, ...updates } })),
    }),
    {
      name: 'bus-tracker-auth',
      partialize: state => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
