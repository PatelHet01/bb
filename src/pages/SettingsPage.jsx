import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Shield, Lock, CheckCircle, Save, Settings as SettingsIcon, Clock, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import AnnouncementsPage from './AnnouncementsPage'
import RewardsPage from './RewardsPage'
import BranchTransfersPage from './BranchTransfersPage'

const FEATURES = [
  { id: 'dashboard', label: 'Dashboard Overview' },
  { id: 'billing', label: 'Billing / POS System' },
  { id: 'inventory', label: 'Inventory & Stock' },
  { id: 'customers', label: 'Customer Database' },
  { id: 'salary', label: 'Staff & Salary' },
  { id: 'analytics', label: 'Financial Analytics' },
  { id: 'expenses', label: 'Expense Tracking' },
  { id: 'orders', label: 'Orders Management' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'cash_tracking', label: 'Cash Tracking' },
  { id: 'internal_ledger', label: 'Internal Ledger' },
  { id: 'sessions', label: 'Session Management' },
  { id: 'settings', label: 'System Settings' }
]

const ROLES = ['manager', 'admin']
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DEFAULT_HOURS = DAYS.reduce((acc, d) => ({
  ...acc,
  [d]: { open: '10:00', close: '23:00', isOpen: true }
}), {})

export default function SettingsPage() {
  const { role } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [businessHours, setBusinessHours] = useState(DEFAULT_HOURS)
  const [hoursSaving, setHoursSaving] = useState(false)

  // Staff Permissions overrides state
  const [staffUsers, setStaffUsers] = useState([])
  const [staffPerms, setStaffPerms] = useState({})
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [savingStaff, setSavingStaff] = useState(false)
  
  const activeTab = searchParams.get('tab') || 'permissions'
  const isSuperAdmin = role === 'super_admin' || role === 'admin'

  useEffect(() => {
    fetchPermissions()
    fetchBusinessHours()
  }, [])

  useEffect(() => {
    if (activeTab === 'staff_perms') {
      fetchStaffData()
    }
  }, [activeTab])

  async function fetchStaffData() {
    setLoadingStaff(true)
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id, username, role')
        .eq('is_active', true)
        .in('role', ['manager', 'worker'])
      setStaffUsers(users || [])

      const { data: staffData } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'staff_permissions')
        .maybeSingle()
      if (staffData?.value) {
        setStaffPerms(staffData.value)
      } else {
        setStaffPerms({})
      }
    } catch (e) {
      toast.error('Failed to load staff list: ' + e.message)
    } finally {
      setLoadingStaff(false)
    }
  }

  const toggleStaffPermission = (userId, featureId) => {
    if (!isSuperAdmin) return
    setStaffPerms(prev => {
      const current = prev[userId] || []
      const updated = current.includes(featureId)
        ? current.filter(id => id !== featureId)
        : [...current, featureId]
      return { ...prev, [userId]: updated }
    })
  }

  async function handleSaveStaffPerms() {
    if (!isSuperAdmin) return toast.error('Only Super Admin can change staff overrides')
    setSavingStaff(true)
    try {
      const { error } = await supabase.from('system_settings').upsert({
        key: 'staff_permissions',
        value: staffPerms,
        updated_at: new Date().toISOString()
      })
      if (error) throw error
      toast.success('Staff overrides saved successfully!')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSavingStaff(false)
    }
  }

  async function fetchPermissions() {
    setLoading(true)
    try {
      const { data } = await supabase.from('system_settings').select('*').eq('key', 'role_permissions').single()
      if (data) {
        setPermissions(data.value)
      } else {
        const defaultPerms = {}
        ROLES.forEach(r => { defaultPerms[r] = ['dashboard', 'billing', 'inventory'] })
        setPermissions(defaultPerms)
      }
    } catch (e) {
      console.error('No permissions found, using defaults')
    } finally {
      setLoading(false)
    }
  }

  async function fetchBusinessHours() {
    try {
      const { data } = await supabase.from('system_settings').select('*').eq('key', 'business_hours').single()
      if (data?.value) setBusinessHours({ ...DEFAULT_HOURS, ...data.value })
    } catch (e) { /* use defaults */ }
  }

  async function handleSave() {
    if (!isSuperAdmin) return toast.error('Only Super Admin can change permissions')
    setSaving(true)
    try {
      const { error } = await supabase.from('system_settings').upsert({
        key: 'role_permissions',
        value: permissions,
        updated_at: new Date().toISOString()
      })
      if (error) throw error
      toast.success('Permissions updated successfully')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveBusinessHours() {
    if (!isSuperAdmin) return toast.error('Only Super Admin can change business hours')
    setHoursSaving(true)
    try {
      const { error } = await supabase.from('system_settings').upsert({
        key: 'business_hours',
        value: businessHours,
        updated_at: new Date().toISOString()
      })
      if (error) throw error
      toast.success('Business hours saved')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setHoursSaving(false)
    }
  }

  const togglePermission = (roleId, featureId) => {
    if (!isSuperAdmin) return
    setPermissions(prev => {
      const current = prev[roleId] || []
      const updated = current.includes(featureId)
        ? current.filter(id => id !== featureId)
        : [...current, featureId]
      return { ...prev, [roleId]: updated }
    })
  }

  const updateHours = (day, field, value) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }))
  }

  const TABS = [
    ['permissions', 'Role Permissions'],
    ['staff_perms', 'Staff Permissions'],
    ['hours', 'Business Hours'],
    ['announcements', 'Announcements'],
    ['rewards', 'Rewards (GHODA)'],
    ['transfers', 'Branch Transfers'],
    ['security', 'Security & Password']
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight flex items-center gap-2">
            <SettingsIcon className="text-ember" /> System Configuration
          </h1>
          <p className="text-sm font-semibold text-ink-500 mt-1 uppercase tracking-widest">Admin Settings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-200 dark:border-ink-800 overflow-x-auto no-scrollbar">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setSearchParams({ tab: key })}
            className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${activeTab === key ? 'border-ember text-ember' : 'border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Role Permissions Tab */}
      {activeTab === 'permissions' && (
        <>
          <div className="flex justify-end">
            {isSuperAdmin && (
              <button onClick={handleSave} disabled={saving}
                className="btn-primary py-2.5 px-6 shadow-lg shadow-ember/20 flex items-center gap-2">
                <Save size={18} /> {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            )}
          </div>
          <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50">
              <div className="flex items-center gap-3 text-amber-600">
                <Shield size={20} />
                <p className="text-sm font-bold">Manage feature access for different staff roles. Super Admins always have full access.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-ink-100 dark:border-ink-800">
                    <th className="px-6 py-4 text-xs font-black text-ink-400 uppercase tracking-widest bg-ink-50/30 dark:bg-ink-950/30">Feature / Module</th>
                    {ROLES.map(r => (
                      <th key={r} className="px-6 py-4 text-xs font-black text-ink-900 dark:text-white uppercase tracking-widest text-center border-l border-ink-50 dark:border-ink-800 bg-ink-50/30 dark:bg-ink-950/30">
                        {r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 dark:divide-ink-800">
                  {FEATURES.map(f => (
                    <tr key={f.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm text-ink-900 dark:text-white">{f.label}</p>
                        <p className="text-[10px] text-ink-400 font-mono">{f.id}</p>
                      </td>
                      {ROLES.map(r => {
                        const isChecked = (permissions[r] || []).includes(f.id)
                        return (
                          <td key={r} className="px-6 py-4 text-center border-l border-ink-50 dark:border-ink-800">
                            <label className="relative inline-flex items-center cursor-pointer group">
                              <input type="checkbox" className="sr-only peer" checked={isChecked}
                                onChange={() => togglePermission(r, f.id)} disabled={!isSuperAdmin} />
                              <div className={`w-11 h-6 rounded-full transition-all duration-300 peer 
                                ${isChecked ? 'bg-ember' : 'bg-ink-200 dark:bg-ink-700'} 
                                after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all 
                                peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-ember/20
                                ${!isSuperAdmin && 'opacity-50 cursor-not-allowed'}`}>
                              </div>
                            </label>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Business Hours Tab */}
      {activeTab === 'hours' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {isSuperAdmin && (
              <button onClick={saveBusinessHours} disabled={hoursSaving}
                className="btn-primary py-2.5 px-6 flex items-center gap-2">
                <Clock size={18} /> {hoursSaving ? 'Saving...' : 'Save Business Hours'}
              </button>
            )}
          </div>
          <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50">
              <div className="flex items-center gap-3 text-blue-600">
                <Clock size={20} />
                <p className="text-sm font-bold">Set business operating hours. Closed days will exclude that day's stats from analytics filters.</p>
              </div>
            </div>
            <div className="divide-y divide-ink-100 dark:divide-ink-800">
              {DAYS.map(day => {
                const hrs = businessHours[day] || { open: '10:00', close: '23:00', isOpen: true }
                return (
                  <div key={day} className="flex items-center gap-4 px-6 py-4">
                    <div className="w-28">
                      <p className="font-bold text-sm text-ink-900 dark:text-white">{day}</p>
                    </div>
                    <button onClick={() => isSuperAdmin && updateHours(day, 'isOpen', !hrs.isOpen)}
                      className={`flex items-center gap-2 text-xs font-bold transition-all px-2 py-1 rounded-lg ${hrs.isOpen ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'} ${!isSuperAdmin && 'cursor-not-allowed opacity-50'}`}>
                      {hrs.isOpen ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
                      {hrs.isOpen ? 'Open' : 'Closed'}
                    </button>
                    {hrs.isOpen && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-ink-500 font-semibold">Opens</label>
                          <input type="time" className="input text-sm py-1.5 w-28" value={hrs.open}
                            onChange={e => updateHours(day, 'open', e.target.value)} disabled={!isSuperAdmin} />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-ink-500 font-semibold">Closes</label>
                          <input type="time" className="input text-sm py-1.5 w-28" value={hrs.close}
                            onChange={e => updateHours(day, 'close', e.target.value)} disabled={!isSuperAdmin} />
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 shadow-xl overflow-hidden min-h-[60vh]">
          <AnnouncementsPage isEmbedded={true} />
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 shadow-xl overflow-hidden min-h-[60vh]">
          <RewardsPage isEmbedded={true} />
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 shadow-xl overflow-hidden min-h-[60vh]">
          <AnnouncementsPage isEmbedded={true} />
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 shadow-xl overflow-hidden min-h-[60vh]">
          <RewardsPage isEmbedded={true} />
        </div>
      )}

      {activeTab === 'transfers' && (
        <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 shadow-xl overflow-hidden min-h-[60vh]">
          <BranchTransfersPage isEmbedded={true} />
        </div>
      )}

      {activeTab === 'staff_perms' && (
        <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 shadow-xl overflow-hidden p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-ink-100 dark:border-ink-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-ink-900 dark:text-white">Staff-Specific Feature Overrides</h2>
              <p className="text-xs text-ink-500 font-semibold mt-1">Directly control feature access for managers and workers on a granular, per-user basis.</p>
            </div>
            <button
              onClick={handleSaveStaffPerms}
              disabled={savingStaff}
              className="btn-primary py-2 px-5 font-black text-xs flex items-center gap-1.5"
            >
              <Save size={14} /> {savingStaff ? 'Saving...' : 'Save Overrides'}
            </button>
          </div>

          {loadingStaff ? (
            <div className="py-12 text-center text-ink-400 animate-pulse font-bold">Loading staff data...</div>
          ) : staffUsers.length === 0 ? (
            <div className="py-12 text-center text-ink-400 font-bold">No active managers or workers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-ink-50 dark:bg-ink-950 text-ink-500 text-[10px] font-black uppercase tracking-widest border-b border-ink-100 dark:border-ink-800">
                    <th className="px-6 py-3">Staff Username</th>
                    <th className="px-6 py-3">Role</th>
                    {FEATURES.filter(f => f.id !== 'settings').map(f => (
                      <th key={f.id} className="px-4 py-3 text-center whitespace-nowrap">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {staffUsers.map(u => {
                    const userPerms = staffPerms[u.id] || []
                    return (
                      <tr key={u.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-950/30">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-ink-900 dark:text-white">{u.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-ink-400 capitalize">{u.role}</td>
                        {FEATURES.filter(f => f.id !== 'settings').map(f => {
                          const hasPerm = userPerms.includes(f.id)
                          return (
                            <td key={f.id} className="px-4 py-4 text-center">
                              <button
                                type="button"
                                disabled={!isSuperAdmin}
                                onClick={() => toggleStaffPermission(u.id, f.id)}
                                className={`inline-flex items-center justify-center p-1 rounded-lg transition-colors ${
                                  hasPerm 
                                    ? 'text-emerald-500 hover:text-emerald-600' 
                                    : 'text-zinc-300 dark:text-zinc-700 hover:text-zinc-400'
                                }`}
                              >
                                {hasPerm ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 shadow-xl overflow-hidden max-w-lg p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Lock className="text-ember" size={20} /> Change Password</h2>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.target)
            const newPassword = fd.get('new_password')
            const { user, role, branchId, branchName } = useAuthStore.getState()
            
            if (newPassword.length < 6) return toast.error('Password too short')
            
            setSaving(true)
            // Insert or update DB record for this user
            const { error } = await supabase.from('users').upsert({
              username: user.username,
              password_hash: newPassword,
              role: role,
              branch_id: branchId === 'All Branches' ? null : branchId,
              is_active: true
            }, { onConflict: 'username' })
            
            setSaving(false)
            if (error) {
              toast.error(error.message)
            } else {
              toast.success('Password changed successfully')
              e.target.reset()
            }
          }} className="space-y-4">
            <div>
              <label className="label text-sm">New Password</label>
              <input name="new_password" type="password" required className="input w-full" placeholder="••••••••" minLength={6} />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      {!isSuperAdmin && ['permissions', 'hours'].includes(activeTab) && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30 text-xs font-bold">
          <Lock size={14} />
          Note: You do not have permission to modify these settings. Please contact a Super Admin.
        </div>
      )}
    </div>
  )
}

