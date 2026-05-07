import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'

const HARDCODED_USERS = {
  superadmin: { password: 'Bethak@SuperAdmin#2025', role: 'super_admin', branchId: null,     branchName: 'All Branches' },
  gurukul:    { password: '1234567890',             role: 'admin',       branchId: 'gurukul', branchName: 'Gurukul' },
  bhat:       { password: '1234567890',             role: 'admin',       branchId: 'bhat',    branchName: 'Bhat' },
  visat:      { password: '1234567890',             role: 'admin',       branchId: 'visat',   branchName: 'Visat' },
  dev:        { password: 'DevAccess@2025',         role: 'developer',   branchId: null,     branchName: 'System' },
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth, user } = useAuthStore()
  const navigate = useNavigate()

  if (user) { return <Navigate to="/admin/dashboard" replace /> }

  async function handleLogin(e) {
    e.preventDefault()
    const u = username.trim().toLowerCase()
    setLoading(true)
    
    const record = HARDCODED_USERS[u]
    if (record && record.password === password) {
      setAuth({ username: u, id: `hardcoded-${u}` }, record.role, record.branchId, record.branchName)
      toast.success(`Signed in as ${u}`)
      navigate('/admin/dashboard', { replace: true })
      setLoading(false)
      return
    }

    // DB check for Staff/Managers created via StaffPage
    const { data } = await supabase.from('users').select('*').eq('username', u).eq('is_active', true).single()
    if (data && data.password_hash === password) {
      setAuth({ username: data.username, id: data.id }, data.role, data.branch_id, data.branch_id ? data.branch_id.toUpperCase() : 'All Branches')
      toast.success(`Signed in as ${data.username}`)
      navigate('/admin/dashboard', { replace: true })
      setLoading(false)
      return
    }

    toast.error('Invalid credentials or account disabled')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-12 border-r border-zinc-800">
        <div>
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-8">
            <span className="text-lg">🪑</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Bombay<br />Bethak
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Billing & Inventory Management<br />
            Paan Parlour · Smoke Lounge · BB Cafe
          </p>
        </div>

        <div className="space-y-4">
          {['Gurukul', 'Bhat', 'Visat'].map(b => (
            <div key={b} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              <span className="text-zinc-500 text-sm">{b}</span>
            </div>
          ))}
          <p className="text-[10px] text-zinc-700 mt-6 uppercase tracking-widest">3 Branches · Production Ready</p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile brand */}
          <div className="lg:hidden text-center mb-8">
            <span className="text-4xl">🪑</span>
            <h1 className="text-2xl font-bold text-white mt-2">Bombay Bethak</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Sign in</h2>
            <p className="text-zinc-500 text-sm mt-1">Admin & staff access only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label text-zinc-500" htmlFor="username">Username</label>
              <input
                id="username"
                className="input bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-white focus:ring-white/10"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="gurukul / bhat / visat / superadmin"
                required
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <label className="label text-zinc-500" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  className="input bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-white focus:ring-white/10 pr-10"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  onClick={() => setShowPw(!showPw)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="btn-login"
              type="submit"
              className="btn-primary w-full btn-lg mt-2 group"
              disabled={loading}
            >
              {loading ? 'Signing in…' : (
                <>
                  Sign In
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-zinc-700 mt-8 uppercase tracking-widest">
            Bombay Bethak · Confidential
          </p>
        </div>
      </div>
    </div>
  )
}
