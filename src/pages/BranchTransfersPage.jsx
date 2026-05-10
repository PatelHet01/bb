import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Search, ArrowRight, X, Filter, Package } from 'lucide-react'

export default function BranchTransfersPage() {
  const { role, branchId, user } = useAuthStore()
  const isSuperAdmin = role === 'super_admin'
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [branches, setBranches] = useState([])
  const [items, setItems] = useState([])
  const [filterBranch, setFilterBranch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [form, setForm] = useState({
    from_branch_id: '',
    to_branch_id: '',
    item_id: '',
    item_name: '',
    quantity: '',
    unit_value: '',
    notes: ''
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
    let q = supabase.from('items').select('id, name, category, branch_id, price').eq('is_active', true)
    if (!isSuperAdmin && branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setItems(data || [])
  }

  async function fetchTransfers() {
    setLoading(true)
    let q = supabase.from('branch_transfers')
      .select('*')
      .order('created_at', { ascending: false })

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

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.from_branch_id === form.to_branch_id) return toast.error('From and To branches must differ')
    if (!form.quantity || parseFloat(form.quantity) <= 0) return toast.error('Enter valid quantity')
    setSaving(true)
    try {
      const selectedItem = items.find(i => i.id === form.item_id)
      const itemName = selectedItem?.name || form.item_name

      // Insert transfer record
      const { data: transfer, error } = await supabase.from('branch_transfers').insert({
        from_branch_id: form.from_branch_id,
        to_branch_id: form.to_branch_id,
        item_id: form.item_id || null,
        item_name: itemName,
        quantity: parseFloat(form.quantity),
        unit_value: parseFloat(form.unit_value) || 0,
        notes: form.notes || null,
        created_by: user.id,
        status: 'confirmed'
      }).select().single()
      if (error) throw error

      // Debit from source branch (decrement stock)
      if (form.item_id) {
        await supabase.rpc('decrement_stock', { p_item_id: form.item_id, p_amount: parseInt(form.quantity) })

        // Credit to destination branch — find matching item by name
        const { data: destItem } = await supabase.from('items')
          .select('id, stock_quantity')
          .eq('branch_id', form.to_branch_id)
          .eq('name', selectedItem?.name || '')
          .maybeSingle()

        if (destItem) {
          await supabase.rpc('decrement_stock', { p_item_id: destItem.id, p_amount: -parseInt(form.quantity) })
        }

        // Log as expense in sending branch
        const totalVal = parseFloat(form.quantity) * (parseFloat(form.unit_value) || 0)
        if (totalVal > 0) {
          await supabase.from('expenses').insert({
            branch_id: form.from_branch_id,
            category: 'Internal Transfer Out',
            description: `Transfer to ${branches.find(b => b.id === form.to_branch_id)?.name || form.to_branch_id}: ${form.quantity}x ${itemName}`,
            amount: totalVal,
            logged_by: user.id
          })
        }
      }

      setTransfers(prev => [transfer, ...prev])
      toast.success('Transfer logged & stock updated')
      setShowForm(false)
      setForm({ from_branch_id: '', to_branch_id: '', item_id: '', item_name: '', quantity: '', unit_value: '', notes: '' })
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const branchName = (id) => branches.find(b => b.id === id)?.name || id

  const totalValue = useMemo(() => transfers.reduce((s, t) => s + Number(t.total_value || 0), 0), [transfers])

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-20 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight">Branch Transfers</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {transfers.length} transfer{transfers.length !== 1 ? 's' : ''} · Total value: <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{totalValue.toLocaleString('en-IN')}</span>
          </p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={15} /> Log Transfer
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && isSuperAdmin && (
        <div className="card p-5 border-2 border-ember/20 animate-slide-up">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-ink-900 dark:text-white">New Inter-Branch Transfer</h2>
            <button onClick={() => setShowForm(false)} className="text-ink-400 hover:text-ink-700"><X size={18}/></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="label">From Branch *</label>
              <select required className="input" value={form.from_branch_id} onChange={e => setForm(p => ({...p, from_branch_id: e.target.value}))}>
                <option value="">Select…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">To Branch *</label>
              <select required className="input" value={form.to_branch_id} onChange={e => setForm(p => ({...p, to_branch_id: e.target.value}))}>
                <option value="">Select…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Item (from inventory)</label>
              <select className="input" value={form.item_id} onChange={e => {
                const item = items.find(i => i.id === e.target.value)
                setForm(p => ({...p, item_id: e.target.value, item_name: item?.name || '', unit_value: item?.price || ''}))
              }}>
                <option value="">Select item…</option>
                {items.filter(i => !form.from_branch_id || i.branch_id === form.from_branch_id).map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.branch_id})</option>
                ))}
              </select>
            </div>
            {!form.item_id && (
              <div>
                <label className="label">Item Name (manual)</label>
                <input className="input" value={form.item_name} onChange={e => setForm(p => ({...p, item_name: e.target.value}))} placeholder="If not in inventory" />
              </div>
            )}
            <div>
              <label className="label">Quantity *</label>
              <input type="number" min="0" step="0.01" required className="input font-bold" value={form.quantity} onChange={e => setForm(p => ({...p, quantity: e.target.value}))} />
            </div>
            <div>
              <label className="label">Unit Value (₹)</label>
              <input type="number" min="0" step="0.01" className="input" value={form.unit_value} onChange={e => setForm(p => ({...p, unit_value: e.target.value}))} placeholder="Cost per unit" />
            </div>
            <div className="sm:col-span-2 md:col-span-3">
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Reason or reference" />
            </div>
            {form.quantity && form.unit_value && (
              <div className="sm:col-span-2 md:col-span-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                  Total Transfer Value: ₹{(parseFloat(form.quantity) * parseFloat(form.unit_value)).toLocaleString('en-IN')}
                </span>
              </div>
            )}
            <div className="sm:col-span-2 md:col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Processing…' : 'Confirm Transfer'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {isSuperAdmin && (
          <select className="input text-sm w-40" value={filterBranch} onChange={e => { setFilterBranch(e.target.value); }}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <input type="date" className="input text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-ink-400">to</span>
        <input type="date" className="input text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button onClick={fetchTransfers} className="btn-secondary text-xs">Apply</button>
      </div>

      {/* Transfers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800/50 border-b border-ink-100 dark:border-ink-800">
              <tr>
                {['Date', 'From', 'To', 'Item', 'Qty', 'Unit Value', 'Total', 'Notes', 'Status'].map(h => (
                  <th key={h} className="tbl-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {loading ? Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={9} className="p-3"><div className="skeleton h-8 w-full"/></td></tr>)
               : transfers.length === 0
               ? <tr><td colSpan={9} className="text-center py-12 text-ink-400">No transfers found</td></tr>
               : transfers.map(t => (
                <tr key={t.id} className="tbl-row">
                  <td className="tbl-cell text-ink-500 whitespace-nowrap text-xs">
                    {new Date(t.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'2-digit'})}
                  </td>
                  <td className="tbl-cell">
                    <span className="badge-default text-[10px] capitalize">{branchName(t.from_branch_id)}</span>
                  </td>
                  <td className="tbl-cell">
                    <div className="flex items-center gap-1">
                      <ArrowRight size={12} className="text-ember" />
                      <span className="badge-default text-[10px] capitalize">{branchName(t.to_branch_id)}</span>
                    </div>
                  </td>
                  <td className="tbl-cell font-semibold text-ink-900 dark:text-white">{t.item_name || '—'}</td>
                  <td className="tbl-cell font-black text-ink-900 dark:text-white">{t.quantity}</td>
                  <td className="tbl-cell text-ink-500">₹{Number(t.unit_value || 0).toLocaleString('en-IN')}</td>
                  <td className="tbl-cell font-black text-emerald-600 dark:text-emerald-400">₹{Number(t.total_value || 0).toLocaleString('en-IN')}</td>
                  <td className="tbl-cell text-ink-500 text-xs max-w-[140px] truncate">{t.notes || '—'}</td>
                  <td className="tbl-cell">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                      t.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700'
                    }`}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
