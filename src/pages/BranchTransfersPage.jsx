import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Search, ArrowRight, X, Filter, Package, ChevronDown, ChevronUp, Trash2, Edit3, Eye, CheckCircle } from 'lucide-react'

export default function BranchTransfersPage() {
  const { role, branchId, user } = useAuthStore()
  const isSuperAdmin = role === 'super_admin'
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [branches, setBranches] = useState([])
  const [allItems, setAllItems] = useState([])
  const [filterBranch, setFilterBranch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const [form, setForm] = useState({
    from_branch_id: branchId || '',
    to_branch_id: '',
    item_id: '',
    item_name: '',
    quantity: '',
    unit_value: '',
    notes: '',
    status: 'pending'
  })

  useEffect(() => {
    fetchBranches()
    fetchItems()
    fetchTransfers()
  }, [branchId])

  async function fetchBranches() {
    const { data } = await supabase.from('branches').select('id, name')
    setBranches(data || [])
  }

  async function fetchItems() {
    // Fetch items from all branches for the searchable dropdown
    const { data } = await supabase.from('items').select('id, name, category, branch_id, price, stock_quantity').eq('is_active', true)
    setAllItems(data || [])
  }

  async function fetchTransfers() {
    setLoading(true)
    let q = supabase.from('branch_transfers')
      .select('*')
      .order('created_at', { ascending: false })

    // Visibility logic: Branch admin sees only their branch (from or to)
    if (!isSuperAdmin && branchId) {
      q = q.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`)
    }
    
    if (filterBranch) q = q.or(`from_branch_id.eq.${filterBranch},to_branch_id.eq.${filterBranch}`)
    if (dateFrom) q = q.gte('created_at', dateFrom)
    if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59')

    const { data } = await q
    setTransfers(data || [])
    setLoading(false)
  }

  async function updateStock(t) {
    if (!t.item_id) return

    const selectedItem = allItems.find(i => i.id === t.item_id)
    if (!selectedItem) return

    // 1. Decrement from source
    await supabase.rpc('decrement_stock', { p_item_id: t.item_id, p_amount: parseFloat(t.quantity) })

    // 2. Increment to destination (find matching item by name)
    const { data: destItem } = await supabase.from('items')
      .select('id')
      .eq('branch_id', t.to_branch_id)
      .eq('name', t.item_name)
      .maybeSingle()

    if (destItem) {
      await supabase.rpc('decrement_stock', { p_item_id: destItem.id, p_amount: -parseFloat(t.quantity) })
    }

    // 3. Log expense in source branch
    const totalVal = parseFloat(t.quantity) * (parseFloat(t.unit_value) || 0)
    if (totalVal > 0) {
      await supabase.from('expenses').insert({
        branch_id: t.from_branch_id,
        category: 'Internal Transfer Out',
        description: `Transfer to ${branchName(t.to_branch_id)}: ${t.quantity}x ${t.item_name}`,
        amount: totalVal,
        created_by: String(user.id).startsWith('hardcoded') ? null : user.id,
        recorded_by: user.username
      })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.from_branch_id === form.to_branch_id) return toast.error('From and To branches must differ')
    if (!form.quantity || parseFloat(form.quantity) <= 0) return toast.error('Enter valid quantity')
    
    setSaving(true)
    try {
      const selectedItem = allItems.find(i => i.id === form.item_id)
      const itemName = selectedItem?.name || form.item_name

      const payload = {
        from_branch_id: form.from_branch_id,
        to_branch_id: form.to_branch_id,
        item_id: form.item_id || null,
        item_name: itemName,
        quantity: parseFloat(form.quantity),
        unit_value: parseFloat(form.unit_value) || 0,
        notes: form.notes || null,
        created_by: String(user.id).startsWith('hardcoded') ? null : user.id,
        recorded_by: user.username,
        status: form.status
      }

      let data, error;
      if (editingId) {
        const res = await supabase.from('branch_transfers').update(payload).eq('id', editingId).select().single()
        data = res.data
        error = res.error
      } else {
        const res = await supabase.from('branch_transfers').insert(payload).select().single()
        data = res.data
        error = res.error
      }

      if (error) throw error

      if (form.status === 'confirmed') {
        await updateStock(data)
      }

      toast.success(editingId ? 'Transfer updated' : 'Transfer recorded')
      setShowModal(false)
      setEditingId(null)
      setForm({ from_branch_id: branchId || '', to_branch_id: '', item_id: '', item_name: '', quantity: '', unit_value: '', notes: '', status: 'pending' })
      fetchTransfers()
      fetchItems() // Refresh stock in memory
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusUpdate(transfer, newStatus) {
    if (!isSuperAdmin) return
    const loadingToast = toast.loading('Updating status...')
    try {
      const { error } = await supabase.from('branch_transfers').update({ status: newStatus }).eq('id', transfer.id)
      if (error) throw error

      if (newStatus === 'confirmed' && transfer.status !== 'confirmed') {
        await updateStock(transfer)
      }

      toast.success(`Status updated to ${newStatus}`, { id: loadingToast })
      fetchTransfers()
      fetchItems()
    } catch (e) {
      toast.error(e.message, { id: loadingToast })
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this transfer record?')) return
    try {
      const { error } = await supabase.from('branch_transfers').delete().eq('id', id)
      if (error) throw error
      toast.success('Deleted')
      setTransfers(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      toast.error(e.message)
    }
  }

  function startEdit(t) {
    setForm({
      from_branch_id: t.from_branch_id,
      to_branch_id: t.to_branch_id,
      item_id: t.item_id || '',
      item_name: t.item_name || '',
      quantity: t.quantity,
      unit_value: t.unit_value,
      notes: t.notes || '',
      status: t.status
    })
    setEditingId(t.id)
    setShowModal(true)
  }

  const branchName = (id) => branches.find(b => b.id === id)?.name || id
  const totalValue = useMemo(() => transfers.reduce((s, t) => s + Number(t.total_value || 0), 0), [transfers])
  
  const selectedItemData = useMemo(() => allItems.find(i => i.id === form.item_id), [form.item_id, allItems])

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight">Branch Transfers</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {transfers.length} transfer{transfers.length !== 1 ? 's' : ''} · Total value: <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{totalValue.toLocaleString('en-IN')}</span>
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={15} /> New Transfer
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end bg-white dark:bg-ink-900 p-4 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-sm">
        {isSuperAdmin && (
          <div className="flex-1 min-w-[200px]">
            <label className="label text-[10px] mb-1">Branch</label>
            <select className="input text-sm" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex-1 min-w-[150px]">
          <label className="label text-[10px] mb-1">From Date</label>
          <input type="date" className="input text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="label text-[10px] mb-1">To Date</label>
          <input type="date" className="input text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button onClick={fetchTransfers} className="btn-secondary px-6 py-2">Apply</button>
      </div>

      {/* Transfers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800/50 border-b border-ink-100 dark:border-ink-800">
              <tr>
                <th className="tbl-head w-10"></th>
                <th className="tbl-head">Date</th>
                <th className="tbl-head">From</th>
                <th className="tbl-head">To</th>
                <th className="tbl-head">Item</th>
                <th className="tbl-head">Qty</th>
                <th className="tbl-head">Total</th>
                <th className="tbl-head">Status</th>
                <th className="tbl-head text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {loading ? Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={9} className="p-3"><div className="skeleton h-8 w-full"/></td></tr>)
               : transfers.length === 0
               ? <tr><td colSpan={9} className="text-center py-12 text-ink-400">No transfers found</td></tr>
               : transfers.map(t => (
                <React.Fragment key={t.id}>
                  <tr className={`tbl-row group ${expandedId === t.id ? 'bg-ember/5' : ''}`}>
                    <td className="tbl-cell text-center">
                      <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="p-1 hover:bg-ink-100 dark:hover:bg-ink-800 rounded">
                        {expandedId === t.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                    <td className="tbl-cell text-ink-500 whitespace-nowrap text-[11px]">
                      {new Date(t.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'2-digit'})}
                    </td>
                    <td className="tbl-cell">
                      <span className="badge-default text-[10px] capitalize">{branchName(t.from_branch_id)}</span>
                    </td>
                    <td className="tbl-cell">
                      <div className="flex items-center gap-1">
                        <ArrowRight size={10} className="text-ember" />
                        <span className="badge-default text-[10px] capitalize">{branchName(t.to_branch_id)}</span>
                      </div>
                    </td>
                    <td className="tbl-cell font-bold text-ink-900 dark:text-white">{t.item_name || '—'}</td>
                    <td className="tbl-cell font-black">{t.quantity}</td>
                    <td className="tbl-cell font-black text-emerald-600 dark:text-emerald-400">₹{Number(t.total_value || 0).toLocaleString('en-IN')}</td>
                    <td className="tbl-cell">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        t.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                        t.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>{t.status}</span>
                    </td>
                    <td className="tbl-cell text-right pr-4">
                      <div className="flex justify-end gap-1">
                        {isSuperAdmin && t.status === 'pending' && (
                          <>
                            <button onClick={() => startEdit(t)} className="p-1.5 text-ink-400 hover:text-ember rounded" title="Edit"><Edit3 size={14}/></button>
                            <button onClick={() => handleStatusUpdate(t, 'confirmed')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Confirm"><CheckCircle size={14}/></button>
                            <button onClick={() => handleStatusUpdate(t, 'rejected')} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reject"><X size={14}/></button>
                          </>
                        )}
                        {isSuperAdmin && (
                          <button onClick={() => handleDelete(t.id)} className="p-1.5 text-ink-400 hover:text-red-500 rounded"><Trash2 size={14}/></button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === t.id && (
                    <tr className="bg-ink-50/50 dark:bg-ink-950/50">
                      <td colSpan={9} className="p-4 border-b border-ink-100 dark:border-ink-800">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div>
                            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1">Unit Value</p>
                            <p className="font-bold text-sm">₹{t.unit_value}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1">Total Value</p>
                            <p className="font-black text-sm text-emerald-600">₹{t.total_value}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1">Notes</p>
                            <p className="text-sm text-ink-600 dark:text-ink-400 italic">"{t.notes || 'No notes provided'}"</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-ink-900 w-full max-w-2xl rounded-3xl shadow-2xl animate-scale-up my-auto">
            <div className="px-8 py-6 border-b border-ink-100 dark:border-ink-800 flex justify-between items-center bg-ink-50/30 dark:bg-ink-950/30 rounded-t-3xl">
              <div>
                <h2 className="font-black text-xl text-ink-900 dark:text-white flex items-center gap-2">
                  <Package className="text-ember" size={22} /> {editingId ? 'Edit Transfer' : 'New Branch Transfer'}
                </h2>
                <p className="text-xs text-ink-400 font-bold uppercase tracking-widest mt-1">Inter-Branch Inventory Movement</p>
              </div>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="p-2 text-ink-400 hover:text-ink-900 transition-colors"><X size={24}/></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="label text-xs">From Branch *</label>
                  <select required className="input" value={form.from_branch_id} 
                    onChange={e => setForm(p => ({...p, from_branch_id: e.target.value}))}
                  >
                    <option value="">Select source branch…</option>
                    {branches.map(b => (
                      // Super Admin sees all, Admin sees others (to log incoming) OR their own (to log outgoing)
                      // Requirement: "exclude current branch if admin" -> this implies logging incoming transfers
                      isSuperAdmin ? <option key={b.id} value={b.id}>{b.name}</option> :
                      b.id !== branchId && <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">To Branch *</label>
                  <select required className="input" value={form.to_branch_id} onChange={e => setForm(p => ({...p, to_branch_id: e.target.value}))}>
                    <option value="">Select destination branch…</option>
                    {branches.map(b => b.id !== form.from_branch_id && <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="label text-xs">Item (Search source inventory) *</label>
                  <div className="relative">
                    <input list="source-items" required className="input w-full" 
                      placeholder="Type to search items in source branch..."
                      value={form.item_name}
                      onChange={e => {
                        const name = e.target.value
                        const item = allItems.find(i => i.name === name && i.branch_id === form.from_branch_id)
                        setForm(p => ({
                          ...p, 
                          item_name: name,
                          item_id: item?.id || '',
                          unit_value: item?.price || p.unit_value
                        }))
                      }}
                    />
                    <datalist id="source-items">
                      {allItems.filter(i => i.branch_id === form.from_branch_id).map(i => (
                        <option key={i.id} value={i.name}>{i.category} · Stock: {i.stock_quantity}</option>
                      ))}
                    </datalist>
                    {selectedItemData && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-ink-400 tracking-widest">Current Stock:</span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded ${selectedItemData.stock_quantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {selectedItemData.stock_quantity}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label text-xs">Quantity *</label>
                  <input type="number" min="0" step="0.01" required className="input font-bold" 
                    value={form.quantity} onChange={e => setForm(p => ({...p, quantity: e.target.value}))} 
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label text-xs">Unit Value (₹) *</label>
                  <input type="number" min="0" step="0.01" required className="input" 
                    value={form.unit_value} onChange={e => setForm(p => ({...p, unit_value: e.target.value}))} 
                    placeholder="Rate per unit"
                  />
                </div>

                <div>
                  <label className="label text-xs">Status</label>
                  <select className="input font-bold" value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
                    <option value="pending">Pending Approval</option>
                    <option value="confirmed">Confirmed / Stock Move</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                   <div className="p-4 bg-ink-50 dark:bg-ink-950 rounded-2xl border border-ink-100 dark:border-ink-800">
                     <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1">Total Value</p>
                     <p className="text-xl font-black text-emerald-600">₹{(Number(form.quantity || 0) * Number(form.unit_value || 0)).toLocaleString('en-IN')}</p>
                   </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="label text-xs">Notes</label>
                  <textarea className="input min-h-[80px]" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Reason for transfer, bill reference, etc." />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 font-bold text-ink-500 hover:bg-ink-50 rounded-2xl transition-all">Cancel</button>
                <button type="submit" disabled={saving} className="flex-[2] btn-primary py-4 text-base shadow-xl shadow-ember/20">
                  {saving ? 'Processing...' : 'Confirm & Log Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
