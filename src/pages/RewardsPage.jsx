import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Plus, Gift, Trash2, Edit2, Search, History, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RewardsPage() {
  const { branchId, role } = useAuthStore()
  const [rewards, setRewards] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState('manage') // manage, history
  const [form, setForm] = useState({ name: '', description: '', cost_in_ghoda: '', stock_quantity: -1, branch_scope: branchId || null })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const isAdmin = role === 'admin' || role === 'super_admin'

  useEffect(() => {
    fetchData()
  }, [branchId, activeTab])

  async function fetchData() {
    setLoading(true)
    try {
      if (activeTab === 'manage') {
        let q = supabase.from('rewards').select('*').order('created_at', { ascending: false })
        if (branchId) q = q.or(`branch_scope.eq.${branchId},branch_scope.is.null`)
        const { data } = await q
        setRewards(data || [])
      } else {
        let q = supabase.from('ghoda_transactions').select('*, customers(name, mobile_number)').eq('type', 'spend').order('created_at', { ascending: false })
        if (branchId) q = q.eq('branch_id', branchId)
        const { data } = await q
        setHistory(data || [])
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        cost_in_ghoda: parseInt(form.cost_in_ghoda),
        stock_quantity: parseInt(form.stock_quantity),
        branch_scope: form.branch_scope || null,
        is_active: true
      }

      if (editingId) {
        const { error } = await supabase.from('rewards').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Reward updated')
      } else {
        const { error } = await supabase.from('rewards').insert(payload)
        if (error) throw error
        toast.success('Reward added')
      }

      setShowForm(false)
      setEditingId(null)
      setForm({ name: '', description: '', cost_in_ghoda: '', stock_quantity: -1, branch_scope: branchId || null })
      fetchData()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteReward(id) {
    if (!confirm('Are you sure? This will hide the reward from customers.')) return
    const { error } = await supabase.from('rewards').update({ is_active: false }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Reward deactivated'); fetchData() }
  }

  function startEdit(r) {
    setForm({
      name: r.name,
      description: r.description || '',
      cost_in_ghoda: r.cost_in_ghoda,
      stock_quantity: r.stock_quantity,
      branch_scope: r.branch_scope
    })
    setEditingId(r.id)
    setShowForm(true)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight">GHODA Rewards System</h1>
          <div className="flex gap-4 mt-3">
            <button onClick={() => setActiveTab('manage')} className={`flex items-center gap-2 text-sm font-bold pb-2 border-b-2 transition-all ${activeTab === 'manage' ? 'border-ember text-ember' : 'border-transparent text-ink-400 hover:text-ink-600'}`}>
              <Gift size={16} /> Manage Rewards
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 text-sm font-bold pb-2 border-b-2 transition-all ${activeTab === 'history' ? 'border-ember text-ember' : 'border-transparent text-ink-400 hover:text-ink-600'}`}>
              <History size={16} /> Redemption History
            </button>
          </div>
        </div>
        {activeTab === 'manage' && isAdmin && (
          <button className="btn-primary py-2.5 px-6 shadow-lg shadow-ember/20" onClick={() => setShowForm(true)}>
            <Plus size={18} className="mr-2" /> Create Reward
          </button>
        )}
      </div>

      {activeTab === 'manage' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? Array(6).fill(0).map((_, i) => <div key={i} className="skeleton h-48 w-full rounded-2xl" />) :
           rewards.length === 0 ? <div className="col-span-full py-20 text-center text-ink-400 italic">No rewards configured yet.</div> :
           rewards.map(r => (
            <div key={r.id} className={`group relative bg-white dark:bg-ink-900 rounded-2xl border-2 p-5 transition-all hover:shadow-xl ${r.is_active ? 'border-ink-100 dark:border-ink-800' : 'border-red-100 opacity-60'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-ember/10 text-ember rounded-xl flex items-center justify-center">
                  <Gift size={24} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(r)} className="p-2 text-ink-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16}/></button>
                  <button onClick={() => deleteReward(r.id)} className="p-2 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                </div>
              </div>
              
              <h3 className="font-black text-lg text-ink-900 dark:text-white leading-tight">{r.name}</h3>
              <p className="text-xs text-ink-500 mt-1 line-clamp-2 min-h-[2.5rem]">{r.description || 'No description available.'}</p>
              
              <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Cost</p>
                  <p className="text-xl font-black text-ember">🪙 {r.cost_in_ghoda}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Stock</p>
                  <p className={`text-sm font-bold ${r.stock_quantity === 0 ? 'text-red-500' : 'text-ink-900 dark:text-white'}`}>
                    {r.stock_quantity === -1 ? 'Unlimited' : r.stock_quantity === 0 ? 'Out of Stock' : `${r.stock_quantity} left`}
                  </p>
                </div>
              </div>
              
              {!r.is_active && <div className="absolute top-2 right-2 rotate-12 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm uppercase">Deactivated</div>}
              {r.branch_scope && <div className="mt-3 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded inline-block uppercase">Exclusive: {r.branch_scope}</div>}
            </div>
           ))
          }
        </div>
      ) : (
        <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink-50 dark:bg-ink-950/50">
                <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Customer</th>
                <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Reward / Reason</th>
                <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-center">Cost</th>
                <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {loading ? <tr><td colSpan="4" className="p-10 text-center">Loading history...</td></tr> :
               history.length === 0 ? <tr><td colSpan="4" className="p-10 text-center text-ink-400 italic">No redemptions yet.</td></tr> :
               history.map(h => (
                <tr key={h.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-bold text-sm text-ink-900 dark:text-white">{h.customers?.name}</p>
                    <p className="text-[10px] text-ink-500 font-mono">{h.customers?.mobile_number}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-semibold text-ink-700 dark:text-ink-300">{h.reason}</p>
                  </td>
                  <td className="px-4 py-4 text-center font-black text-red-500">🪙 {h.amount}</td>
                  <td className="px-4 py-4 text-right text-[10px] font-bold text-ink-400 uppercase">
                    {new Date(h.created_at).toLocaleString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
                  </td>
                </tr>
               ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Reward Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-ink-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex justify-between items-center bg-ink-50 dark:bg-ink-950/50">
              <h3 className="font-bold text-ink-900 dark:text-white">{editingId ? 'Edit Reward' : 'Create New Reward'}</h3>
              <button type="button" onClick={() => {setShowForm(false); setEditingId(null);}} className="text-ink-400 hover:text-ink-900"><Plus className="rotate-45" size={24}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Reward Name</label>
                <input required type="text" className="input" placeholder="e.g. Free Cold Coffee" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input min-h-[80px]" placeholder="Brief details about the reward..." value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Cost (GHODA)</label>
                  <input required type="number" className="input" placeholder="0" value={form.cost_in_ghoda} onChange={e=>setForm({...form, cost_in_ghoda: e.target.value})} />
                </div>
                <div>
                  <label className="label">Stock (-1 for ∞)</label>
                  <input required type="number" className="input" placeholder="-1" value={form.stock_quantity} onChange={e=>setForm({...form, stock_quantity: e.target.value})} />
                </div>
              </div>
              {role === 'super_admin' && (
                <div>
                  <label className="label">Branch Scope</label>
                  <select className="input" value={form.branch_scope || ''} onChange={e=>setForm({...form, branch_scope: e.target.value || null})}>
                    <option value="">Global (All Branches)</option>
                    <option value="gurukul">Gurukul</option>
                    <option value="bhat">Bhat</option>
                    <option value="visat">Visat</option>
                  </select>
                </div>
              )}
            </div>
            <div className="p-6 bg-ink-50 dark:bg-ink-950/50 flex gap-3">
              <button type="button" onClick={() => {setShowForm(false); setEditingId(null);}} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1 py-3" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Reward' : 'Create Reward'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
