import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  LogOut, Sun, Moon, Menu, X, ChevronRight,
  BarChart2, Settings, Gift, Megaphone, Receipt, GitBranch, Utensils, QrCode, Coffee, Shield,
  ClipboardList, Truck, ArrowLeftRight, Banknote, Clock, ShieldCheck, MessageCircle, Download
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import OrderNotificationOverlay from './OrderNotificationOverlay'
import NotificationBell from './NotificationBell'
import BBLogo from './BBLogo'
import toast from 'react-hot-toast'
import { useAdminNotifications } from '../../hooks/useAdminNotifications'


const NAV_GROUPS = [
  {
    title: null,
    items: [
      { to: '/admin/dashboard', label: 'Dashboard',   icon: LayoutDashboard, roles: ['super_admin','admin','developer','manager'], feature: 'dashboard' },
      { to: '/admin/billing',   label: 'Billing / POS',icon: ShoppingCart,    roles: ['super_admin','admin','manager'], feature: 'billing' }
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { to: '/admin/inventory', label: 'Inventory',    icon: Package,         roles: ['super_admin','admin','manager'], feature: 'inventory' },
      { to: '/admin/offers',    label: 'Offers',       icon: Gift,            roles: ['super_admin','admin','manager'], feature: 'inventory' },
      { to: '/admin/orders',    label: 'Orders',        icon: ClipboardList,   roles: ['super_admin','admin'], feature: 'orders' },
      { to: '/admin/sessions',  label: 'Sessions',     icon: Clock,           roles: ['super_admin','admin'], feature: 'sessions' },
      { to: null,               label: 'Kitchen Display', icon: Utensils,      roles: ['super_admin','admin','manager'], feature: 'billing', newTab: true }
    ]
  },
  {
    title: 'PEOPLE',
    items: [
      { to: '/admin/customers', label: 'Customers',    icon: Users,           roles: ['super_admin','admin'], feature: 'customers' },
      { to: '/admin/whatsapp',  label: 'WhatsApp',     icon: MessageCircle,   roles: ['super_admin','admin'], feature: 'customers' },
      { to: '/admin/hr',        label: 'HR & Operations', icon: Users,        roles: ['super_admin','admin'], feature: 'salary' },
      { to: '/admin/vendors',   label: 'Vendors',      icon: Truck,           roles: ['super_admin','admin'], feature: 'vendors' }
    ]
  },
  {
    title: 'FINANCE',
    items: [
      { to: '/admin/expenses',  label: 'Expenses',       icon: Receipt,        roles: ['super_admin','admin'], feature: 'expenses' },
      { to: '/admin/analytics', label: 'Analytics',      icon: BarChart2,      roles: ['super_admin','admin'], feature: 'analytics' },
      { to: '/admin/cash',      label: 'Cash Tracking',  icon: Banknote,       roles: ['super_admin','admin'], feature: 'cash_tracking' },
      { to: '/admin/ledger',    label: 'Internal Ledger',icon: ArrowLeftRight, roles: ['super_admin','admin'], feature: 'internal_ledger' }
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      { to: '/admin/audit',     label: 'Audit Trail',  icon: ShieldCheck,     roles: ['super_admin','admin'], feature: 'audit' },
      { to: '/admin/settings',  label: 'Settings',     icon: Settings,        roles: ['super_admin','admin'], feature: 'settings' },
      { to: '/admin/branches',  label: 'Branches',     icon: GitBranch,       roles: ['super_admin'], feature: 'branches' }
    ]
  }
]

const ROLE_LABEL = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  developer: 'Developer',
  worker: 'Worker',
}

export default function DashboardLayout() {
  const { user, role, branchName, branchId, darkMode, toggleDark, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Realtime notifications for admins
  useAdminNotifications()
  const [permissions, setPermissions] = useState(null)
  const [staffPerms, setStaffPerms] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileUsername, setProfileUsername] = useState('')
  const [profileFullName, setProfileFullName] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  async function handleInstallClick() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstallable(false)
    }
    setDeferredPrompt(null)
  }  useEffect(() => {
    // Check if the logged in user actually exists in DB
    async function verifyUser() {
      if (!user?.id) return
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!error && !data) {
        toast.error('Session expired or database reset. Please log in again.')
        handleLogout()
      }
    }
    verifyUser()

    // Fetch feature permissions
    async function getPerms() {
      const { data } = await supabase.from('system_settings').select('*').eq('key', 'role_permissions').single()
      if (data) setPermissions(data.value)

      const { data: staffData } = await supabase.from('system_settings').select('*').eq('key', 'staff_permissions').single()
      if (staffData) setStaffPerms(staffData.value)
    }
    getPerms()
  }, [user])

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

  async function handleProfileSave(e) {
    e.preventDefault()
    if (!profileUsername.trim()) return toast.error('Username cannot be empty')
    if (profileUsername.length < 3) return toast.error('Username too short')
    
    setProfileLoading(true)
    try {
      const updates = {
        username: profileUsername.trim().toLowerCase(),
        full_name: profileFullName.trim() || null,
      }
      if (profilePassword.trim()) {
        updates.password_hash = profilePassword.trim()
      }
      
      if (isRealUser(user?.id)) {
        const { error } = await supabase.from('users').update(updates).eq('id', user.id)
        if (error) {
          if (error.code === '23505') throw new Error('Username already taken')
          throw error
        }
      }

      // Update local state
      const { setAuth } = useAuthStore.getState()
      setAuth({ username: updates.username, id: user.id, name: updates.full_name }, role, branchId, branchName)
      
      toast.success('Profile updated successfully')
      setShowProfileModal(false)
      setProfilePassword('')
    } catch (err) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const isRealUser = (id) => {
    if (!id || typeof id !== 'string') return false
    if (id.startsWith('hardcoded')) return false
    // UUID v4 pattern
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  }

  async function openProfileModal() {
    if (isRealUser(user?.id)) {
      const { data } = await supabase.from('users').select('full_name').eq('id', user.id).maybeSingle()
      setProfileFullName(data?.full_name || '')
    } else {
      setProfileFullName('')
    }
    setProfileUsername(user?.username || '')
    setProfilePassword('')
    setShowProfileModal(true)
    setSidebarOpen(false)
  }

  const renderNavGroups = () => {
    return NAV_GROUPS.map((group, idx) => {
      const groupItems = group.items.filter(n => {
        if (role === 'super_admin' || role === 'developer') return true
        
        // 1. Check user-level override
        if (user?.id && staffPerms && staffPerms[user.id]) {
          if (!n.feature) return true
          return staffPerms[user.id].includes(n.feature)
        }

        // 2. Standard role check
        if (!n.roles.includes(role)) return false
        if (!n.feature) return true
        if (permissions && permissions[role]) return permissions[role].includes(n.feature)
        return true
      })

      if (groupItems.length === 0) return null

      return (
        <div key={idx} className={idx > 0 ? 'mt-4' : ''}>
          {group.title && (
            <p className="px-3 text-[9px] font-bold text-dash-muted dark:text-dash-mutedDark uppercase tracking-widest mb-2">
              — {group.title} —
            </p>
          )}
          <div className="space-y-0.5">
            {groupItems.map(({ to, label, icon: Icon, newTab }) => (
              newTab ? (
                <button
                  key={label}
                  onClick={() => { window.open('/kitchen', '_blank'); setSidebarOpen(false) }}
                  className="nav-link w-full text-left"
                >
                  <Icon size={15} strokeWidth={2} />
                  {label}
                </button>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={15} strokeWidth={2} />
                  {label}
                </NavLink>
              )
            ))}
          </div>
        </div>
      )
    })
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-dash-border dark:border-dash-borderDark">
        <div className="flex items-center gap-3">
          <BBLogo size={38} animate />
          <div className="min-w-0">
            <p className="font-bold text-dash-text dark:text-dash-textDark text-sm truncate">Bombay Bethak</p>
            <p className="text-[10px] text-dash-muted dark:text-dash-mutedDark font-medium uppercase tracking-wider">{branchName}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {renderNavGroups()}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 pt-3 border-t border-dash-border dark:border-dash-borderDark space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-dash-primary dark:bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-white dark:text-dash-primary font-bold text-xs uppercase">
              {(user?.name || user?.username)?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-dash-text dark:text-dash-textDark truncate">{user?.name || user?.username}</p>
            {user?.name && <p className="text-[9px] text-ink-400 truncate">@{user?.username}</p>}
            <span className="badge-default text-[9px]">{ROLE_LABEL[role] || role}</span>
          </div>
        </div>
        <button
          onClick={openProfileModal}
          className="nav-link w-full text-dash-text dark:text-dash-textDark hover:bg-dash-border dark:hover:bg-dash-borderDark"
        >
          <Settings size={15} />
          Edit Profile
        </button>
        <button
          onClick={handleLogout}
          className="nav-link w-full text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600"
          id="btn-logout"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-dash-bg dark:bg-dash-bgDark">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 bg-dash-sidebar dark:bg-dash-sidebarDark border-r border-dash-border dark:border-dash-borderDark">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex animate-fade-in">
          <aside className="w-60 flex-shrink-0 bg-dash-sidebar dark:bg-dash-sidebarDark border-r border-dash-border dark:border-dash-borderDark flex flex-col animate-slide-up">
            <SidebarContent />
          </aside>
          <div className="flex-1 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between h-14 px-4 md:px-6 bg-dash-sidebar dark:bg-dash-sidebarDark border-b border-dash-border dark:border-dash-borderDark">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden btn-ghost p-2 rounded-lg"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              id="btn-mobile-menu"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="hidden md:flex items-center gap-1.5 text-sm">
              <span className="text-dash-text dark:text-dash-textDark font-semibold">Bombay Bethak</span>
              <ChevronRight size={13} className="text-dash-muted dark:text-dash-mutedDark" />
              <span className="text-dash-muted dark:text-dash-mutedDark">{branchName}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors mr-2"
                title="Install BB Admin App"
              >
                <Download size={14} />
                Install App
              </button>
            )}
            {/* Mobile install icon */}
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="md:hidden p-2 text-amber-600 dark:text-amber-400 btn-ghost rounded-lg mr-1"
                title="Install App"
              >
                <Download size={16} />
              </button>
            )}
            
            {['super_admin','admin','manager'].includes(role) && <NotificationBell />}
            <button
              onClick={toggleDark}
              className="btn-ghost p-2 rounded-lg"
              id="btn-dark-mode"
              title="Toggle dark mode"
            >
              {darkMode
                ? <Sun size={16} className="text-dash-muted dark:text-dash-mutedDark" />
                : <Moon size={16} className="text-dash-muted dark:text-dash-mutedDark" />
              }
            </button>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-dash-bg dark:bg-dash-bgDark">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-full">
            <Outlet />
          </div>
        </main>

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <form onSubmit={handleProfileSave} className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-slide-up">
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-zinc-900 dark:text-white">Edit Profile</h3>
                <button type="button" onClick={() => setShowProfileModal(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Avatar preview */}
                <div className="flex items-center gap-3 pb-2">
                  <div className="w-12 h-12 rounded-full bg-ember flex items-center justify-center text-white font-black text-lg uppercase">
                    {(profileFullName || profileUsername)?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-white">{profileFullName || profileUsername || 'No name set'}</p>
                    <p className="text-xs text-zinc-400">{ROLE_LABEL[role] || role} · {branchName}</p>
                  </div>
                </div>
                <div>
                  <label className="label">Full Name</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Your display name"
                    value={profileFullName} 
                    onChange={e => setProfileFullName(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="label">Username</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={profileUsername} 
                    onChange={e => setProfileUsername(e.target.value)} 
                    required
                  />
                </div>
                <div>
                  <label className="label">New Password</label>
                  <input 
                    type="password" 
                    className="input" 
                    placeholder="Leave blank to keep same"
                    value={profilePassword} 
                    onChange={e => setProfilePassword(e.target.value)} 
                  />
                </div>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setShowProfileModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={profileLoading} className="btn-primary">
                  {profileLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        <OrderNotificationOverlay />
      </div>
    </div>
  )
}
