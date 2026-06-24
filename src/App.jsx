import AppRoutes from './routes/AppRoutes'
import { useAutoLogout } from './hooks/useAutoLogout'
import { useAuthStore } from './store/authStore'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const { showWarning, extendSession } = useAutoLogout()
  const { user, role, branchId, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) {
      document.getElementById('manifest-link')?.setAttribute('href', '/admin-manifest.json')
      document.getElementById('apple-touch-icon')?.setAttribute('href', '/admin-pwa-192x192.png')
      document.getElementById('theme-color-meta')?.setAttribute('content', '#fcd34d')
    }
  }, [window.location.pathname])

  function handleLogout() {
    if (user) {
      supabase.from('auth_logs').insert({
        user_id: user.id,
        username: user.username,
        branch_id: branchId,
        event: 'LOGOUT',
        reason: `manual_signout [Role: ${role}]`
      }).then()
    }
    logout()
    navigate('/admin', { replace: true })
  }

  return (
    <>
      <AppRoutes />
      
      {/* Global Auto-logout warning modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center animate-scale-up">
            <div className="text-4xl mb-4">⏱️</div>
            <h2 className="font-bold text-lg mb-2 text-zinc-900 dark:text-white">Session Expiring Soon</h2>
            <p className="text-zinc-500 text-sm mb-6">Your session will expire in 5 minutes due to inactivity.</p>
            <div className="flex gap-3">
              <button onClick={extendSession} className="btn-primary flex-1">Continue Session</button>
              <button onClick={handleLogout} className="btn-secondary flex-1">Logout Now</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
