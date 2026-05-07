import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Plus, Megaphone, Trash2, Globe } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AnnouncementsPage() {
  const { branchId, user, role } = useAuthStore()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', message: '', type: 'info', branch_scope: '' })

  const isSuperAdmin = role === 'super_admin'

  useEffect(() => { fetchAnnouncements() }, [branchId])

  async function fetchAnnouncements() {
    let q = supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (branchId) q = q.or(`branch_scope.eq.${branchId},branch_scope.is.null`)
    const { data } = await q
    setAnnouncements(data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const { error } = await supabase.from('announcements').insert({
      title: form.title,
      message: form.message,
      type: form.type,
      branch_scope: isSuperAdmin ? (form.branch_scope || null) : branchId,
      created_by: user.id
    })
    if (error) return toast.error(error.message)
    toast.success('Announcement broadcasted')
    setShowForm(false)
    setForm({ title: '', message: '', type: 'info', branch_scope: '' })
    fetchAnnouncements()
  }

  async function handleDelete(id) {
    if (!confirm('Delete announcement?')) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) toast.error(error.message)
    else fetchAnnouncements()
  }

  const getTypeColor = (type) => {
    switch(type) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
      case 'warning': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-dash-text dark:text-dash-textDark">Announcements</h1>
        {(isSuperAdmin || role === 'admin') && (
          <button className="btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={16} /> New Broadcast
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4 bg-dash-bg dark:bg-zinc-900 border-dash-border dark:border-dash-borderDark">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <span className="label">Title</span>
              <input required type="text" className="input" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} placeholder="Announcement title" />
            </div>
            <div className="w-full md:w-48">
              <span className="label">Type</span>
              <select className="input" value={form.type} onChange={e=>setForm({...form, type: e.target.value})}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            {isSuperAdmin && (
              <div className="w-full md:w-48">
                <span className="label">Target Branch</span>
                <select className="input" value={form.branch_scope} onChange={e=>setForm({...form, branch_scope: e.target.value})}>
                  <option value="">All Branches</option>
                  <option value="gurukul">Gurukul</option>
                  <option value="bhat">Bhat</option>
                  <option value="visat">Visat</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <span className="label">Message</span>
            <textarea required className="input min-h-[100px]" value={form.message} onChange={e=>setForm({...form, message: e.target.value})} placeholder="Write the announcement details here..."></textarea>
          </div>
          <button type="submit" className="btn-primary">Broadcast Now</button>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {loading ? <p className="text-dash-muted">Loading...</p> : 
         announcements.length === 0 ? <p className="text-dash-muted">No active announcements.</p> :
         announcements.map(ann => (
           <div key={ann.id} className={`card p-5 border-l-4 ${ann.type === 'urgent' ? 'border-l-red-500' : ann.type === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
             <div className="flex justify-between items-start mb-2">
               <div className="flex items-center gap-2">
                 <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${getTypeColor(ann.type)}`}>
                   {ann.type}
                 </span>
                 <span className="text-xs text-dash-muted flex items-center gap-1">
                   {ann.branch_scope ? `Branch: ${ann.branch_scope}` : <><Globe size={12}/> Global</>}
                 </span>
               </div>
               {(isSuperAdmin || role === 'admin') && (
                 <button className="text-dash-muted hover:text-red-500 transition-colors" onClick={() => handleDelete(ann.id)}>
                   <Trash2 size={14} />
                 </button>
               )}
             </div>
             <h3 className="font-bold text-lg text-dash-text dark:text-dash-textDark">{ann.title}</h3>
             <p className="text-sm text-dash-muted mt-2 whitespace-pre-wrap">{ann.message}</p>
             <p className="text-[10px] text-zinc-400 mt-4">{new Date(ann.created_at).toLocaleString()}</p>
           </div>
         ))}
      </div>
    </div>
  )
}
