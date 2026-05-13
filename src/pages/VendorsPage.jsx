import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  Plus, Search, X, Edit2, Trash2, Package, ShoppingCart, CheckCircle, Clock, Ban
} from 'lucide-react'

const VENDOR_CATEGORIES = ['General', 'Grocery', 'Packaging', 'Dairy', 'Beverages', 'Tobacco', 'Cleaning', 'Other']

const STATUS_STYLE = {
  draft:     { label: 'Draft',     cls: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400' },
  ordered:   { label: 'Ordered',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  received:  { label: 'Received',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

export default function VendorsPage() {
  const { branchId, role, user } = useAuthStore()
  const isSuperAdmin = role === 'super_admin'
  const isAdmin = isSuperAdmin || role === 'admin'

  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [ledger, setLedger] = useState([])
  const [ledgerTab, setLedgerTab] = useState('ledger') // ledger | items | orders

  // Vendor form
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', contact: '', category: 'General', notes: '' })
  const [saving, setSaving] = useState(false)

  // Manual ledger entry form
  const [showLedgerForm, setShowLedgerForm] = useState(false)
  const [ledgerForm, setLedgerForm] = useState({ type: 'PURCHASE', amount: '', reference: '' })
  const [editingLedgerId, setEditingLedgerId] = useState(null)

  // Items tagged to vendor
  const [vendorItems, setVendorItems] = useState([])

  // Purchase Orders
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [allItems, setAllItems] = useState([]) // all inventory items for this branch
  const [showPOForm, setShowPOForm] = useState(false)
  const [poForm, setPOForm] = useState({ invoice_ref: '', payment_mode: 'CREDIT', amount_paid: '', notes: '' })
  const [poLines, setPOLines] = useState([{ item_id: '', quantity: '', unit_price: '' }])
  const [expandedPO, setExpandedPO] = useState(null)

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
    setShowPOForm(false)
    setExpandedPO(null)
    const [lRes, iRes, poRes, allRes] = await Promise.all([
      supabase.from('vendor_ledger').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false }),
      supabase.from('item_vendor').select('*, items(id, name, category, subcategory, stock_quantity, unit, price)').eq('vendor_id', v.id),
      supabase.from('vendor_purchase_orders').select('*, vendor_purchase_items(*, items(name, unit))').eq('vendor_id', v.id).order('created_at', { ascending: false }),
      supabase.from('items').select('id, name, category, unit, stock_quantity').eq('branch_id', v.branch_id || branchId || 'gurukul').eq('is_active', true).order('name'),
    ])
    setLedger(lRes.data || [])
    setVendorItems((iRes.data || []).map(r => r.items).filter(Boolean))
    setPurchaseOrders(poRes.data || [])
    setAllItems(allRes.data || [])
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
      
      if (editingLedgerId) {
        if (!editingLedgerId) throw new Error("Missing entry ID for update");
        const { data, error } = await supabase.from('vendor_ledger').update(payload).eq('id', editingLedgerId).select().single()
        if (error) throw error
        setLedger(prev => prev.map(l => l.id === editingLedgerId ? data : l))
        toast.success('Entry updated')
      } else {
        const { data, error } = await supabase.from('vendor_ledger').insert(payload).select().single()
        if (error) throw error
        setLedger(prev => [data, ...prev])
        toast.success('Entry added')
      }
      
      setShowLedgerForm(false)
      setEditingLedgerId(null)
      setLedgerForm({ type: 'PURCHASE', amount: '', reference: '' })
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function deleteLedgerEntry(id) {
    if (!id || id === 'null') {
      toast.error(`Cannot delete: Entry ID is missing or invalid (${id})`);
      return;
    }
    if(!confirm('Delete this ledger entry?')) return
    
    console.log("Deleting id:", id)
    const { error } = await supabase.from('vendor_ledger').delete().eq('id', id)
    if(error) toast.error(error.message)
    else {
      toast.success('Entry deleted')
      setLedger(prev => prev.filter(l => l.id !== id))
    }
  }

  // ---- Purchase Order Functions ----
  const poTotal = useMemo(() => poLines.reduce((s, l) => s + (parseFloat(l.quantity)||0)*(parseFloat(l.unit_price)||0), 0), [poLines])

  function addPOLine() { setPOLines(p => [...p, { item_id: '', quantity: '', unit_price: '' }]) }
  function removePOLine(i) { setPOLines(p => p.filter((_, idx) => idx !== i)) }
  function updatePOLine(i, field, val) { setPOLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l)) }

  async function handleCreatePO(e, receiveNow) {
    e.preventDefault()
    const validLines = poLines.filter(l => l.item_id && parseFloat(l.quantity) > 0)
    if (!validLines.length) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      const total = validLines.reduce((s, l) => s + (parseFloat(l.quantity)||0)*(parseFloat(l.unit_price)||0), 0)
      const amtPaid = parseFloat(poForm.amount_paid) || 0
      const newStatus = receiveNow ? 'received' : 'draft'
      const { data: po, error: poErr } = await supabase.from('vendor_purchase_orders').insert({
        vendor_id: selectedVendor.id,
        branch_id: selectedVendor.branch_id || branchId || 'gurukul',
        status: newStatus,
        total_amount: total,
        amount_paid: amtPaid,
        payment_mode: poForm.payment_mode,
        invoice_ref: poForm.invoice_ref || null,
        notes: poForm.notes || null,
        received_at: receiveNow ? new Date().toISOString() : null,
        recorded_by: user.username,
      }).select().single()
      if (poErr) throw poErr

      await supabase.from('vendor_purchase_items').insert(
        validLines.map(l => ({ purchase_order_id: po.id, item_id: l.item_id, quantity: parseFloat(l.quantity), unit_price: parseFloat(l.unit_price)||0 }))
      )

      if (receiveNow) {
        for (const l of validLines) {
          const { data: itm } = await supabase.from('items').select('stock_quantity').eq('id', l.item_id).single()
          const qBefore = itm?.stock_quantity || 0
          const qChange = parseFloat(l.quantity)
          await supabase.rpc('increment_stock', { p_item_id: l.item_id, p_amount: qChange })
          await supabase.from('inventory_log').insert({ item_id: l.item_id, branch_id: po.branch_id, action: 'PURCHASE_IN', qty_before: qBefore, qty_change: qChange, qty_after: qBefore + qChange, reference_type: 'vendor_purchase_order', reference_id: po.id, recorded_by: user.username })
        }
        // Auto vendor ledger entries
        await supabase.from('vendor_ledger').insert({ vendor_id: selectedVendor.id, branch_id: po.branch_id, type: 'PURCHASE', amount: total, reference: poForm.invoice_ref || `PO ${po.id.slice(0,8)}`, recorded_by: user.username })
        if (amtPaid > 0) {
          await supabase.from('vendor_ledger').insert({ vendor_id: selectedVendor.id, branch_id: po.branch_id, type: 'PAYMENT', amount: amtPaid, reference: poForm.invoice_ref || `PO ${po.id.slice(0,8)}`, recorded_by: user.username })
        }
      }

      toast.success(receiveNow ? 'Purchase received & stock updated!' : 'Draft purchase order saved')
      setShowPOForm(false)
      setPOForm({ invoice_ref: '', payment_mode: 'CREDIT', amount_paid: '', notes: '' })
      setPOLines([{ item_id: '', quantity: '', unit_price: '' }])
      viewVendor(selectedVendor)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function markAsReceived(po) {
    if (!window.confirm('Mark this order as received? This will update inventory stock.')) return
    setSaving(true)
    try {
      const { data: lines } = await supabase.from('vendor_purchase_items').select('*, items(stock_quantity)').eq('purchase_order_id', po.id)
      for (const l of (lines || [])) {
        const qBefore = l.items?.stock_quantity || 0
        await supabase.rpc('increment_stock', { p_item_id: l.item_id, p_amount: l.quantity })
        await supabase.from('inventory_log').insert({ item_id: l.item_id, branch_id: po.branch_id, action: 'PURCHASE_IN', qty_before: qBefore, qty_change: l.quantity, qty_after: qBefore + l.quantity, reference_type: 'vendor_purchase_order', reference_id: po.id, recorded_by: user.username })
      }
      await supabase.from('vendor_purchase_orders').update({ status: 'received', received_at: new Date().toISOString() }).eq('id', po.id)
      await supabase.from('vendor_ledger').insert({ vendor_id: po.vendor_id, branch_id: po.branch_id, type: 'PURCHASE', amount: po.total_amount, reference: po.invoice_ref || `PO ${po.id.slice(0,8)}`, recorded_by: user.username })
      if (po.amount_paid > 0) {
        await supabase.from('vendor_ledger').insert({ vendor_id: po.vendor_id, branch_id: po.branch_id, type: 'PAYMENT', amount: po.amount_paid, reference: po.invoice_ref || `PO ${po.id.slice(0,8)}`, recorded_by: user.username })
      }
      toast.success('Stock updated & ledger entries created!')
      viewVendor(selectedVendor)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function cancelPO(po) {
    if (!window.confirm('Cancel this purchase order?')) return
    await supabase.from('vendor_purchase_orders').update({ status: 'cancelled' }).eq('id', po.id)
    viewVendor(selectedVendor)
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
            {[['ledger','Ledger'],['orders','Purchases'],['items','Items']].map(([tab, label]) => (
              <button key={tab} onClick={() => setLedgerTab(tab)}
                className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${ledgerTab === tab ? 'border-ember text-ember' : 'border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-white'}`}>
                {label}
              </button>
            ))}
            {isAdmin && ledgerTab === 'ledger' && (
              <button onClick={() => { setEditingLedgerId(null); setLedgerForm({ type: 'PURCHASE', amount: '', reference: '' }); setShowLedgerForm(!showLedgerForm); }} className="ml-auto px-3 py-2 text-xs font-bold text-ember hover:bg-ember/10 rounded-lg transition-colors">
                + Entry
              </button>
            )}
            {isAdmin && ledgerTab === 'orders' && (
              <button onClick={() => { setShowPOForm(p => !p); setPOLines([{ item_id: '', quantity: '', unit_price: '' }]); setPOForm({ invoice_ref: '', payment_mode: 'CREDIT', amount_paid: '', notes: '' }) }} className="ml-auto px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
                + New Purchase
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
                <button type="submit" disabled={saving} className="btn-primary text-xs">{saving ? '…' : (editingLedgerId ? 'Update Entry' : 'Add Entry')}</button>
              </div>
            </form>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-ink-50 dark:bg-ink-950">

            {/* LEDGER TAB */}
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
                        <button onClick={() => { setEditingLedgerId(l.id); setLedgerForm({ type: l.type, amount: l.amount, reference: l.reference || '' }); setShowLedgerForm(true); }} className="p-1 text-ink-400 hover:text-ember"><Edit2 size={12}/></button>
                        <button onClick={() => deleteLedgerEntry(l.id)} className="p-1 text-ink-400 hover:text-red-500"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  </div>
                ))
            )}

            {/* PURCHASE ORDERS TAB */}
            {ledgerTab === 'orders' && (
              <div className="space-y-3">
                {/* Create PO Form */}
                {showPOForm && (
                  <div className="bg-white dark:bg-ink-900 rounded-xl border border-emerald-300 dark:border-emerald-800 p-4 space-y-3 animate-slide-up">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">New Purchase Order</span>
                      <button onClick={() => setShowPOForm(false)}><X size={14} className="text-ink-400" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Invoice / Bill Ref</label>
                        <input className="input text-sm" value={poForm.invoice_ref} onChange={e => setPOForm(p => ({...p, invoice_ref: e.target.value}))} placeholder="e.g. INV-001" />
                      </div>
                      <div>
                        <label className="label">Payment Mode</label>
                        <select className="input text-sm" value={poForm.payment_mode} onChange={e => setPOForm(p => ({...p, payment_mode: e.target.value}))}>
                          <option value="CREDIT">Credit (Owe Vendor)</option>
                          <option value="CASH">Cash (Paid Now)</option>
                          <option value="UPI">UPI (Paid Now)</option>
                        </select>
                      </div>
                      {poForm.payment_mode !== 'CREDIT' && (
                        <div>
                          <label className="label">Amount Paid (₹)</label>
                          <input type="number" min="0" className="input text-sm" value={poForm.amount_paid} onChange={e => setPOForm(p => ({...p, amount_paid: e.target.value}))} placeholder="0" />
                        </div>
                      )}
                    </div>
                    {/* Line Items */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_80px_80px_28px] gap-1 text-[10px] font-black text-ink-400 uppercase px-1">
                        <span>Item</span><span>Qty</span><span>Price/Unit</span><span/>
                      </div>
                      {poLines.map((line, i) => (
                        <div key={i} className="grid grid-cols-[1fr_80px_80px_28px] gap-1 items-center">
                          <select className="input text-xs" value={line.item_id} onChange={e => updatePOLine(i, 'item_id', e.target.value)}>
                            <option value="">Select item…</option>
                            {allItems.map(it => <option key={it.id} value={it.id}>{it.name} ({it.unit}) — stock: {it.stock_quantity}</option>)}
                          </select>
                          <input type="number" min="0.001" step="any" className="input text-xs text-center" placeholder="Qty" value={line.quantity} onChange={e => updatePOLine(i, 'quantity', e.target.value)} />
                          <input type="number" min="0" step="0.01" className="input text-xs text-center" placeholder="₹/unit" value={line.unit_price} onChange={e => updatePOLine(i, 'unit_price', e.target.value)} />
                          <button onClick={() => removePOLine(i)} className="text-ink-400 hover:text-red-500"><X size={13}/></button>
                        </div>
                      ))}
                      <button onClick={addPOLine} className="text-xs text-emerald-600 font-bold hover:underline">+ Add item</button>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-ink-100 dark:border-ink-800">
                      <span className="font-black text-ink-900 dark:text-white">Total: ₹{poTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={e => handleCreatePO(e, false)} disabled={saving} className="btn-secondary text-xs">{saving ? '…' : 'Save Draft'}</button>
                        <button type="button" onClick={e => handleCreatePO(e, true)} disabled={saving} className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700">{saving ? '…' : '✓ Receive Now'}</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* PO List */}
                {purchaseOrders.length === 0 && !showPOForm && (
                  <p className="text-center py-10 text-ink-400 text-sm">No purchase orders yet. Click &ldquo;+ New Purchase&rdquo; to begin.</p>
                )}
                {purchaseOrders.map(po => {
                  const st = STATUS_STYLE[po.status] || STATUS_STYLE.draft
                  const isExpanded = expandedPO === po.id
                  return (
                    <div key={po.id} className="bg-white dark:bg-ink-900 rounded-xl border border-ink-200 dark:border-ink-800 overflow-hidden">
                      <button className="w-full p-3 flex items-center gap-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800" onClick={() => setExpandedPO(isExpanded ? null : po.id)}>
                        <Package size={15} className="text-ink-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                            {po.invoice_ref && <span className="text-xs text-ink-500 font-mono">{po.invoice_ref}</span>}
                          </div>
                          <div className="text-[10px] text-ink-400 mt-0.5">{new Date(po.created_at).toLocaleString('en-IN')} · {po.payment_mode}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-black text-ink-900 dark:text-white">₹{Number(po.total_amount).toLocaleString('en-IN')}</div>
                          {po.amount_paid > 0 && <div className="text-[10px] text-emerald-500">Paid ₹{Number(po.amount_paid).toLocaleString('en-IN')}</div>}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2 border-t border-ink-100 dark:border-ink-800 pt-2">
                          {(po.vendor_purchase_items || []).map(li => (
                            <div key={li.id} className="flex justify-between text-xs">
                              <span className="text-ink-700 dark:text-ink-300">{li.items?.name} <span className="text-ink-400">×{li.quantity} {li.items?.unit}</span></span>
                              <span className="font-bold tabular-nums">₹{(li.quantity * li.unit_price).toFixed(2)}</span>
                            </div>
                          ))}
                          {isAdmin && (po.status === 'draft' || po.status === 'ordered') && (
                            <div className="flex gap-2 pt-2">
                              <button onClick={() => markAsReceived(po)} disabled={saving} className="flex-1 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors">
                                {saving ? '…' : '✓ Mark Received'}
                              </button>
                              <button onClick={() => cancelPO(po)} className="px-3 py-1.5 text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">Cancel</button>
                            </div>
                          )}
                          {po.status === 'received' && (
                            <p className="text-[10px] text-emerald-600 font-bold pt-1">✓ Stock updated {po.received_at ? `· ${new Date(po.received_at).toLocaleDateString('en-IN')}` : ''}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ITEMS TAB */}
            {ledgerTab === 'items' && (
              vendorItems.length === 0
                ? <p className="text-center py-10 text-ink-400 text-sm">No items linked to this vendor yet</p>
                : vendorItems.map(item => (
                  <div key={item.id} className="bg-white dark:bg-ink-900 p-3 rounded-xl border border-ink-200 dark:border-ink-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-ink-900 dark:text-white">{item.name}</div>
                      <div className="text-[10px] text-ink-500">{item.category} · {item.unit}</div>
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
