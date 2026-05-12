import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  Plus, Search, X, Edit2, Trash2, Truck, Package, ChevronDown, ChevronUp,
  DollarSign, FileText, ArrowLeft
} from 'lucide-react'
import { Link } from 'react-router-dom'

const VENDOR_CATEGORIES = ['General', 'Grocery', 'Packaging', 'Dairy', 'Beverages', 'Tobacco', 'Cleaning', 'Other']

export default function VendorsPage() {
  const { branchId, role, user } = useAuthStore()
  const isSuperAdmin = role === 'super_admin'
  const isAdmin = isSuperAdmin || role === 'admin'

  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [ledger, setLedger] = useState([])
  const [ledgerTab, setLedgerTab] = useState('ledger') // ledger | items

  // Forms
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', contact: '', category: 'General', notes: '' })
  const [saving, setSaving] = useState(false)

  // Ledger entry form
  const [showLedgerForm, setShowLedgerForm] = useState(false)
  const [ledgerForm, setLedgerForm] = useState({ type: 'PURCHASE', amount: '', reference: '' })

  // Items tagged to vendor
  const [vendorItems, setVendorItems] = useState([])

  useEffect(() => { fetchVendors() }, [branchId])

  async function fetchVendors() {
    setLoading(true)
    let q = supabase.from('vendors').select('*').eq('is_active', true).order('name')
    if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
    const { data } = await q
    setVendors(data || [])
    setLoading(false)
  }

  async function viewVendor(v) {
    setSelectedVendor(v)
    setLedgerTab('ledger')
    // Fetch ledger
    const { data: lData } = await supabase.from('vendor_ledger')
      .select('*').eq('vendor_id', v.id).order('created_at', { ascending: false })
    setLedger(lData || [])
    // Fetch items linked to vendor
    const { data: iData } = await supabase.from('item_vendor')
      .select('*, items(id, name, category, subcategory, stock_quantity, price)')
      .eq('vendor_id', v.id)
    setVendorItems((iData || []).map(r => r.items).filter(Boolean))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Vendor name required')
    setSaving(true)
    try {
      if (editingId) {
        const { data, error } = await supabase.from('vendors').update({
          name: form.name, contact: form.contact, category: form.category, notes: form.notes
        }).eq('id', editingId).select().single()
        if (error) throw error
        setVendors(prev => prev.map(v => v.id === editingId ? { ...v, ...data } : v))
        if (selectedVendor?.id === editingId) setSelectedVendor(sv => ({ ...sv, ...data }))
        toast.success('Vendor updated')
      } else {
        const { data, error } = await supabase.from('vendors').insert({
          branch_id: branchId || null,
          name: form.name, contact: form.contact, category: form.category, notes: form.notes,
          is_active: true
        }).select().single()
        if (error) throw error
        setVendors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success('Vendor added')
      }
      setShowVendorForm(false)
      setEditingId(null)
      setForm({ name: '', contact: '', category: 'General', notes: '' })
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(v) {
    if (!window.confirm(`Delete vendor "${v.name}"? This cannot be undone.`)) return
    try {
      if (!v.id) throw new Error("Vendor ID is missing! Schema might be corrupt.")
      const { data, error } = await supabase.from('vendors').update({ is_active: false }).eq('id', v.id).select().single()
      if (error) throw error
      setVendors(prev => prev.filter(vv => vv.id !== v.id))
      if (selectedVendor?.id === v.id) setSelectedVendor(null)
      toast.success('Vendor removed')
    } catch (e) {
      toast.error('Failed to delete: ' + e.message)
    }
  }

  function startEdit(v, e) {
    e?.stopPropagation()
    if (!v.id) {
      toast.error("Error: Vendor ID is missing. Cannot edit.")
      return
    }
    setForm({ name: v.name, contact: v.contact || '', category: v.category || 'General', notes: v.notes || '' })
    setEditingId(v.id)
    setShowVendorForm(true)
  }

  async function addLedgerEntry(e) {
    e.preventDefault()
    if (!ledgerForm.amount || parseFloat(ledgerForm.amount) <= 0) return toast.error('Enter valid amount')
    setSaving(true)
    try {
      const payload = {
        vendor_id: selectedVendor.id,
        branch_id: branchId || selectedVendor.branch_id,
        type: ledgerForm.type,
        amount: parseFloat(ledgerForm.amount),
        reference: ledgerForm.reference || null,
        created_by: String(user.id).startsWith('hardcoded') ? null : user.id,
        recorded_by: user.username
      }
      
      if (ledgerForm.id) {
        const { data, error } = await supabase.from('vendor_ledger').update(payload).eq('id', ledgerForm.id).select().single()
        if (error) throw error
        setLedger(prev => prev.map(l => l.id === ledgerForm.id ? data : l))
        toast.success('Entry updated')
      } else {
        const { data, error } = await supabase.from('vendor_ledger').insert(payload).select().single()
        if (error) throw error
        setLedger(prev => [data, ...prev])
        toast.success('Entry added')
      }
      
      setShowLedgerForm(false)
      setLedgerForm({ type: 'PURCHASE', amount: '', reference: '' })
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function deleteLedgerEntry(id) {
    if(!confirm('Delete this ledger entry?')) return
    const { error } = await supabase.from('vendor_ledger').delete().eq('id', id)
    if(error) toast.error(error.message)
    else {
      toast.success('Entry deleted')
      setLedger(prev => prev.filter(l => l.id !== id))
    }
  }

  // Compute vendor balance: PURCHASE = amount owed to vendor (debit), PAYMENT = paid
  const vendorBalance = useMemo(() =>
    ledger.reduce((s, l) =>
      l.type === 'PURCHASE' ? s + Number(l.amount) : s - Number(l.amount)
    , 0)
  , [ledger])

  const totalSpent = useMemo(() =>
    ledger.filter(l => l.type === 'PAYMENT').reduce((s, l) => s + Number(l.amount), 0)
  , [ledger])

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    (v.contact || '').includes(search) ||
    (v.category || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-6rem)] animate-fade-in">
      {/* Left: Vendor List */}
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-950/30 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-ink-900 dark:text-white tracking-tight">Vendors</h1>
              <p className="text-sm text-ink-500 mt-0.5">{vendors.length} active vendors</p>
            </div>
            {isAdmin && (
              <button onClick={() => { setShowVendorForm(!showVendorForm); setEditingId(null); setForm({ name: '', contact: '', category: 'General', notes: '' }) }}
                className="btn-primary px-4 py-2">
                <Plus size={15} /> Add Vendor
              </button>
            )}
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input className="input pl-9 w-full" placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Add/Edit form */}
        {showVendorForm && (
          <div className="p-4 bg-ember/5 border-b border-ember/20 animate-slide-up">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black text-ember uppercase tracking-widest">{editingId ? 'Edit Vendor' : 'New Vendor'}</span>
              <button onClick={() => { setShowVendorForm(false); setEditingId(null) }} className="text-ink-400 hover:text-ink-700"><X size={14}/></button>
            </div>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Vendor Name *</label>
                <input className="input" required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Supplier Co." autoFocus />
              </div>
              <div>
                <label className="label">Contact / Phone</label>
                <input className="input" value={form.contact} onChange={e => setForm(p => ({...p, contact: e.target.value}))} placeholder="9876543210" />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}>
                  {VENDOR_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Optional notes" />
              </div>
              <div className="sm:col-span-2 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowVendorForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : (editingId ? 'Update' : 'Add Vendor')}</button>
              </div>
            </form>
          </div>
        )}

        {/* Vendor list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)
            : filtered.length === 0 ? <p className="text-center py-12 text-ink-400 text-sm">No vendors found</p>
            : filtered.map(v => (
              <button key={v.id} onClick={() => viewVendor(v)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3
                  ${selectedVendor?.id === v.id ? 'border-ember bg-ember/5' : 'border-transparent hover:bg-ink-50 dark:hover:bg-ink-800 hover:border-ink-200 dark:hover:border-ink-700'}`}>
                <div className="w-10 h-10 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center font-black text-ink-600 dark:text-ink-400 text-lg shrink-0">
                  {v.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink-900 dark:text-white truncate">{v.name}</div>
                  <div className="text-xs text-ink-500 flex gap-2 mt-0.5">
                    <span className="badge-default text-[9px]">{v.category}</span>
                    {v.contact && <span className="font-mono">{v.contact}</span>}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={e => startEdit(v, e)} className="p-1.5 text-ink-400 hover:text-ember hover:bg-ember/10 rounded-lg transition-colors"><Edit2 size={14}/></button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(v) }} className="p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14}/></button>
                  </div>
                )}
              </button>
            ))
          }
        </div>
      </div>

      {/* Right: Vendor Ledger Panel */}
      {selectedVendor && (
        <div className="md:w-[480px] flex flex-col bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm shrink-0 animate-slide-in-right">
          {/* Header */}
          <div className="p-5 bg-ink-900 text-white border-b border-ink-800 relative">
            <button onClick={() => setSelectedVendor(null)} className="absolute top-4 right-4 p-2 bg-ink-800 hover:bg-red-500 rounded-full transition-colors"><X size={14}/></button>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-black text-2xl">{selectedVendor.name[0]}</div>
              <div>
                <h2 className="font-black text-xl">{selectedVendor.name}</h2>
                <div className="flex gap-2 mt-1 text-xs text-white/60">
                  <span className="bg-white/10 px-2 py-0.5 rounded">{selectedVendor.category}</span>
                  {selectedVendor.contact && <span>{selectedVendor.contact}</span>}
                </div>
              </div>
            </div>
            {/* Balance summary */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white/10 p-3 rounded-xl">
                <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Outstanding</div>
                <div className={`font-black text-lg ${vendorBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>₹{Math.abs(vendorBalance).toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-white/10 p-3 rounded-xl">
                <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Paid</div>
                <div className="font-black text-lg text-emerald-400">₹{totalSpent.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-white/10 p-3 rounded-xl">
                <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Items</div>
                <div className="font-black text-lg text-white">{vendorItems.length}</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-ink-200 dark:border-ink-800 px-2">
            {['ledger', 'items'].map(tab => (
              <button key={tab} onClick={() => setLedgerTab(tab)}
                className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all capitalize ${ledgerTab === tab ? 'border-ember text-ember' : 'border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-white'}`}>
                {tab === 'ledger' ? 'Vendor Ledger' : 'Sourced Items'}
              </button>
            ))}
            {isAdmin && (
              <button onClick={() => setShowLedgerForm(!showLedgerForm)} className="ml-auto px-3 py-2 text-xs font-bold text-ember hover:bg-ember/10 rounded-lg transition-colors">
                + Entry
              </button>
            )}
          </div>

          {/* Ledger entry form */}
          {showLedgerForm && (
            <form onSubmit={addLedgerEntry} className="p-4 bg-ink-50 dark:bg-ink-950/30 border-b border-ink-200 dark:border-ink-800 space-y-3 animate-slide-up">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input text-sm" value={ledgerForm.type} onChange={e => setLedgerForm(p => ({...p, type: e.target.value}))}>
                    <option value="PURCHASE">Purchase (owe)</option>
                    <option value="PAYMENT">Payment (paid)</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </select>
                </div>
                <div>
                  <label className="label">Amount (₹)</label>
                  <input type="number" min="0" step="0.01" required className="input text-sm font-bold" value={ledgerForm.amount} onChange={e => setLedgerForm(p => ({...p, amount: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Reference</label>
                  <input className="input text-sm" value={ledgerForm.reference} onChange={e => setLedgerForm(p => ({...p, reference: e.target.value}))} placeholder="Invoice / note" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowLedgerForm(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">{saving ? '…' : 'Add Entry'}</button>
              </div>
            </form>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-ink-50 dark:bg-ink-950">
            {ledgerTab === 'ledger' && (
              ledger.length === 0
                ? <p className="text-center py-10 text-ink-400 text-sm">No ledger entries yet</p>
                : ledger.map(l => (
                  <div key={l.id} className="group bg-white dark:bg-ink-900 p-3 rounded-xl border border-ink-200 dark:border-ink-800 flex items-center justify-between gap-3 transition-all hover:border-ink-300 dark:hover:border-ink-700">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          l.type === 'PURCHASE' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          l.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          'bg-ink-100 text-ink-600'
                        }`}>{l.type}</span>
                        {l.reference && <span className="text-xs text-ink-500 font-medium">{l.reference}</span>}
                      </div>
                      <div className="text-[10px] text-ink-400 mt-1 font-bold">{new Date(l.created_at).toLocaleString('en-IN')}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`font-black text-base tabular-nums ${l.type === 'PURCHASE' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {l.type === 'PURCHASE' ? '+' : '-'}₹{Number(l.amount).toLocaleString('en-IN')}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => { setLedgerForm({ ...l }); setShowLedgerForm(true); }} className="p-1 text-ink-400 hover:text-ember"><Edit2 size={12}/></button>
                        <button onClick={() => deleteLedgerEntry(l.id)} className="p-1 text-ink-400 hover:text-red-500"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  </div>
                ))
            )}

            {ledgerTab === 'items' && (
              vendorItems.length === 0
                ? <p className="text-center py-10 text-ink-400 text-sm">No items linked to this vendor yet</p>
                : vendorItems.map(item => (
                  <div key={item.id} className="bg-white dark:bg-ink-900 p-3 rounded-xl border border-ink-200 dark:border-ink-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-ink-900 dark:text-white">{item.name}</div>
                      <div className="text-[10px] text-ink-500">{item.category} / {item.subcategory}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-ink-900 dark:text-white">₹{item.price}</div>
                      <div className="text-[10px] text-ink-400">Stock: {item.stock_quantity}</div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
