import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useSessionStore = create(persist(
  (set) => ({
    currentSession: null,  // { id, branch_id, session_date, opening_balance, status, start_time }
    setSession: (s) => set({ currentSession: s }),
    clearSession: () => set({ currentSession: null }),
  }),
  { name: 'bb-session' }
))
