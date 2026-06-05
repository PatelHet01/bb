import { create } from 'zustand'

export const useNotificationStore = create((set) => ({
  notifications: [],   // [{id, type, title, body, time, read}]
  unreadCount: 0,

  addNotification: (n) => set((s) => {
    const next = [
      { ...n, id: Date.now() + Math.random(), time: new Date(), read: false },
      ...s.notifications,
    ].slice(0, 50) // keep max 50
    return { notifications: next, unreadCount: s.unreadCount + 1 }
  }),

  markAllRead: () => set((s) => ({
    notifications: s.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}))
