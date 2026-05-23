import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TIMEOUT_MS = 60 * 60 * 1000  // 1 hour
const WARNING_MS = 55 * 60 * 1000  // 55 min — warn 5 min before

export function useAutoLogout() {
  const { user, role, branchId, logout } = useAuthStore()
  const navigate = useNavigate()
  const timerRef = useRef(null)
  const warnRef = useRef(null)
  const [showWarning, setShowWarning] = useState(false)

  const resetTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    clearTimeout(warnRef.current)
    setShowWarning(false)

    warnRef.current = setTimeout(() => {
      setShowWarning(true)
    }, WARNING_MS)

    timerRef.current = setTimeout(async () => {
      // Log auto-logout event (fire and forget)
      supabase.from('auth_logs').insert({
        user_id: user?.id || null,
        username: user?.username || null,
        branch_id: branchId || null,
        event: 'AUTO_LOGOUT',
        reason: `inactivity [Role: ${role}]`
      }).then()

      logout()
      navigate('/admin', { replace: true })
    }, TIMEOUT_MS)
  }, [user, role, branchId, logout, navigate])

  useEffect(() => {
    if (!user) return

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      clearTimeout(timerRef.current)
      clearTimeout(warnRef.current)
    }
  }, [user, resetTimer])

  return { showWarning, extendSession: resetTimer }
}
