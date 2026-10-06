import { create } from 'zustand';

export const useAnnouncementStore = create((set, get) => ({
  announcements: [],   // published announcements
  drafts: [],          // drafts visible to admin

  addAnnouncement: (ann) => set(s => ({
    announcements: [ann, ...s.announcements.filter(a => a._id !== ann._id)].slice(0, 50),
  })),

  addDraft: (draft) => set(s => ({
    drafts: [draft, ...s.drafts.filter(d => d._id !== draft._id)].slice(0, 20),
  })),

  setAnnouncements: (announcements) => set({ announcements }),

  publishDraft: (id) => set(s => {
    const draft = s.drafts.find(d => d._id === id);
    const published = draft ? { ...draft, status: 'published', publishedAt: new Date().toISOString() } : null;
    return {
      drafts: s.drafts.filter(d => d._id !== id),
      announcements: published ? [published, ...s.announcements] : s.announcements,
    };
  }),

  getLatestForRoute: (routeId) =>
    get().announcements.find(a => a.routeId === routeId || a.routeId?._id === routeId),

  clearAll: () => set({ announcements: [], drafts: [] }),
}));
