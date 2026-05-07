import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Plus, Users, Shield, ShieldAlert, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function StaffPage() {
  const { role, branchId } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'manager', branch_id: branchId || 'gurukul' })
  const [saving, setSaving] = useState(false)

  const isSuperAdmin = role === 'super_admin'
  const canAddStaff = isSuperAdmin || role === 'admin'

  useEffect(() => { fetchUsers() }, [branchId])

  async function fetchUsers() {
    let q = supabase.from('users').select('*').order('created_at', { ascending: false })
    if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setUsers(data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const usernameClean = form.username.toLowerCase()
    const { error } = await supabase.from('users').insert({
      username: usernameClean,
      email: `${usernameClean}-${Date.now()}@bb.local`, // Auto-generated to satisfy DB schema
      password_hash: form.password,
      role: form.role,
      branch_id: form.branch_id
    })
    
    setSaving(false)
    if (error) {
      if (error.code === '23505') return toast.error('Username already taken')
      return toast.error(error.message)
    }
    
    toast.success('User account created')
    setShowForm(false)
    setForm({ username: '', password: '', role: 'manager', branch_id: branchId || 'gurukul' })
    fetchUsers()
  }

  async function toggleStatus(id, currentStatus) {
    await supabase.from('users').update({ is_active: !currentStatus }).eq('id', id)
    fetchUsers()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-dash-text dark:text-dash-textDark">System Access & Staff</h1>
        {canAddStaff && (
          <button className="btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4 bg-dash-bg dark:bg-zinc-900 border-dash-border dark:border-dash-borderDark">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <span className="label">Username</span>
              <input required type="text" className="input lowercase" value={form.username} onChange={e=>setForm({...form, username: e.target.value.replace(/\s+/g,'_')})} placeholder="e.g. bhat_manager" />
            </div>
            <div className="flex-1">
              <span className="label">Password</span>
              <input required type="text" className="input" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} placeholder="Set password" />
            </div>
            <div className="w-full md:w-48">
              <span className="label">Role</span>
              <select className="input" value={form.role} onChange={e=>setForm({...form, role: e.target.value})} disabled={!isSuperAdmin}>
                <option value="manager">Manager</option>
                {isSuperAdmin && <option value="admin">Admin</option>}
              </select>
            </div>
            {isSuperAdmin && (
              <div className="w-full md:w-48">
                <span className="label">Branch</span>
                <select className="input" value={form.branch_id} onChange={e=>setForm({...form, branch_id: e.target.value})}>
                  <option value="gurukul">Gurukul</option>
                  <option value="bhat">Bhat</option>
                  <option value="visat">Visat</option>
                </select>
              </div>
            )}
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Account'}</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="tbl-head">Username</th>
              <th className="tbl-head">Role</th>
              <th className="tbl-head">Branch</th>
              <th className="tbl-head text-center">Status</th>
              <th className="tbl-head text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="5" className="tbl-cell text-center">Loading...</td></tr> : 
             users.map(u => (
               <tr key={u.id} className="tbl-row">
                 <td className="tbl-cell font-bold">{u.username}</td>
                 <td className="tbl-cell">
                   <span className={`badge ${u.role === 'super_admin' ? 'badge-dark' : 'badge-default'}`}>
                     {u.role === 'super_admin' ? <ShieldAlert size={10} className="mr-1"/> : <Shield size={10} className="mr-1"/>} {u.role}
                   </span>
                 </td>
                 <td className="tbl-cell uppercase">{u.branch_id || 'ALL'}</td>
                 <td className="tbl-cell text-center">
                   {u.is_active ? <span className="badge-success">Active</span> : <span className="badge-danger">Disabled</span>}
                 </td>
                 <td className="tbl-cell text-right">
                   {canAddStaff && (
                     <button 
                       onClick={() => toggleStatus(u.id, u.is_active)}
                       className={`text-xs font-bold px-3 py-1 rounded border ${u.is_active ? 'text-red-500 border-red-200 bg-red-50 hover:bg-red-100' : 'text-emerald-500 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'}`}
                     >
                       {u.is_active ? 'Disable' : 'Enable'}
                     </button>
                   )}
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
