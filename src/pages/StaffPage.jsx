import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Plus, Users, Shield, ShieldAlert, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function StaffPage() {
  const { role } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const isSuperAdmin = role === 'super_admin'

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-dash-text dark:text-dash-textDark">System Access & Staff</h1>
        {isSuperAdmin && (
          <button className="btn-primary btn-sm" onClick={() => toast('User creation handled via Supabase Auth currently.')}>
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="tbl-head">Username</th>
              <th className="tbl-head">Email</th>
              <th className="tbl-head">Role</th>
              <th className="tbl-head">Branch</th>
              <th className="tbl-head">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="5" className="tbl-cell text-center">Loading...</td></tr> : 
             users.map(u => (
               <tr key={u.id} className="tbl-row">
                 <td className="tbl-cell font-bold">{u.username}</td>
                 <td className="tbl-cell text-dash-muted">{u.email}</td>
                 <td className="tbl-cell">
                   <span className={`badge ${u.role === 'super_admin' ? 'badge-dark' : 'badge-default'}`}>
                     {u.role === 'super_admin' ? <ShieldAlert size={10} className="mr-1"/> : <Shield size={10} className="mr-1"/>} {u.role}
                   </span>
                 </td>
                 <td className="tbl-cell uppercase">{u.branch_id || 'ALL'}</td>
                 <td className="tbl-cell">
                   {u.is_active ? <span className="badge-success">Active</span> : <span className="badge-danger">Disabled</span>}
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
