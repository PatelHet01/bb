import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      role: null,
      branchId: null,
      branchName: null,
      darkMode: false,

      setAuth: (user, role, branchId, branchName) =>
        set({ user, role, branchId, branchName }),

      toggleDark: () => set((s) => {
        const next = !s.darkMode
        document.documentElement.classList.toggle('dark', next)
        return { darkMode: next }
      }),

      logout: () => set({ user: null, role: null, branchId: null, branchName: null }),
    }),
    {
      name: 'bb-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.darkMode) document.documentElement.classList.add('dark')
      },
    }
  )
)
