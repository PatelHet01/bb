import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  LogOut, Sun, Moon, Menu, X, ChevronRight,
  BarChart2, Settings, Gift, Megaphone, Receipt, GitBranch, Utensils, QrCode
} from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard',   icon: LayoutDashboard, roles: ['super_admin','admin','developer','manager'] },
  { to: '/admin/billing',   label: 'Billing / POS',icon: ShoppingCart,    roles: ['super_admin','admin','manager'] },
  { to: '/admin/inventory', label: 'Inventory',    icon: Package,         roles: ['super_admin','admin','manager'] },
  { to: '/admin/tables',    label: 'Tables & QR',  icon: QrCode,          roles: ['super_admin','admin','manager'] },
  { to: '/admin/customers', label: 'Customers',    icon: Users,           roles: ['super_admin','admin'] },
  { to: '/admin/salary',    label: 'Salary',       icon: Users,           roles: ['super_admin','admin'] },
  { to: '/admin/rewards',   label: 'Rewards (GHODA)', icon: Gift,      roles: ['super_admin','admin'] },
  { to: '/admin/analytics', label: 'Analytics',    icon: BarChart2, roles: ['super_admin','admin'] },
  { to: '/kitchen',         label: 'Kitchen Display', icon: Utensils,      roles: ['super_admin','admin','manager'] },
  { to: '/admin/branches',  label: 'Branches',     icon: GitBranch, roles: ['super_admin'] },
  { to: '/admin/staff',     label: 'Staff',        icon: Users,           roles: ['super_admin','admin'] },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone,    roles: ['super_admin','admin','manager'] },
  { to: '/admin/expenses',  label: 'Expenses',     icon: Receipt,    roles: ['super_admin','admin'] },
  { to: '/admin/settings',  label: 'Settings',     icon: Settings, roles: ['super_admin','admin'] },
]

const ROLE_LABEL = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  developer: 'Developer',
}

export default function DashboardLayout() {
  const { user, role, branchName, darkMode, toggleDark, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/admin', { replace: true })
  }

  const visibleNav = NAV.filter(n => n.roles.includes(role))

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-dash-border dark:border-dash-borderDark">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-dash-primary dark:bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-sm">🪑</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-dash-text dark:text-dash-textDark text-sm truncate">Bombay Bethak</p>
            <p className="text-[10px] text-dash-muted dark:text-dash-mutedDark font-medium uppercase tracking-wider">{branchName}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 text-[9px] font-bold text-dash-muted dark:text-dash-mutedDark uppercase tracking-widest mb-2">Navigation</p>
        {visibleNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Icon size={15} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 pt-3 border-t border-dash-border dark:border-dash-borderDark space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-dash-primary dark:bg-white flex items-center justify-center flex-shrink-0">
            <span className="text-white dark:text-dash-primary font-bold text-xs uppercase">{user?.username?.[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-dash-text dark:text-dash-textDark truncate capitalize">{user?.username}</p>
            <span className="badge-default text-[9px]">{ROLE_LABEL[role] || role}</span>
          </div>
        </div>
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
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
