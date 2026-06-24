import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import toast from 'react-hot-toast'

export function useAdminNotifications() {
  const { role, branchId } = useAuthStore()
  const addNotification = useNotificationStore((s) => s.addNotification)

  useEffect(() => {
    const isAdmin = ['super_admin', 'admin'].includes(role)
    const isManager = role === 'manager'
    if (!isAdmin && !isManager) return

    // ── New Orders ──────────────────────────────────────────────────────────
    const orderFilter = branchId
      ? `branch_id=eq.${branchId}`
      : undefined

    const fireOSNotif = (title, body, iconUrl = '/admin-pwa-192x192.png') => {
      if (!('Notification' in window)) return
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: iconUrl })
      }
    }

    const orderChannel = supabase
      .channel('admin-notif-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: orderFilter },
        (payload) => {
          const o = payload.new
          if (!o || o.status === 'cancelled') return
          const num   = o.order_number ? `#${o.order_number}` : `#${String(o.id).slice(0, 6).toUpperCase()}`
          const total = o.total ? ` · ₹${Math.round(Number(o.total))}` : ''
          const msg   = `New Order ${num}${total}`
          addNotification({ type: 'order', title: 'New Order', body: msg })
          toast.success(msg, { icon: '🧾', duration: 4000, id: `order-${o.id}` })
          fireOSNotif('🧾 New Order Received', msg)
        }
      )
      .subscribe()

    // ── Payment Received (admin only) ───────────────────────────────────────
    let payChannel = null
    if (isAdmin) {
      payChannel = supabase
        .channel('admin-notif-payments')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'order_payments' },
          (payload) => {
            const p = payload.new
            if (!p) return
            const msg = `Payment ₹${Math.round(Number(p.amount))} via ${p.mode}`
            addNotification({ type: 'payment', title: 'Payment Received', body: msg })
            fireOSNotif('💳 Payment Received', msg)
          }
        )
        .subscribe()
    }

    return () => {
      supabase.removeChannel(orderChannel)
      if (payChannel) supabase.removeChannel(payChannel)
    }
  }, [role, branchId]) // eslint-disable-line react-hooks/exhaustive-deps
}
