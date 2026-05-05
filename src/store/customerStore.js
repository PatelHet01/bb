import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Customer-facing auth store (separate from admin)
export const useCustomerStore = create(
  persist(
    (set) => ({
      customer: null, // { id, username, name, mobile_number, ghoda_coins, dob }
      setCustomer: (c) => set({ customer: c }),
      logout: () => set({ customer: null }),
    }),
    { name: 'bb-customer' }
  )
)
