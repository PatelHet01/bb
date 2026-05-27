import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Search, X, UserCircle, Edit2, Trash2, ShoppingBag, Download } from 'lucide-react'
import { getLedgerEntryStyle } from '../utils/ledger'

const Modal = ({ title, show, onClose, onSubmit, saving, children }) => {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-ink-900 rounded-xl shadow-modal w-full max-w-sm overflow-hidden animate-slide-up">
        <div className="px-5 py-4 border-b border-ink-200 dark:border-ink-800 flex justify-between items-center">
          <h3 className="font-bold text-ink-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"><X size={18}/></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {children}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Confirm'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const { branchId, user, role } = useAuthStore()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', name: '', mobile_number: '', dob: '', branch_id: branchId || 'gurukul' })
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editingId, setEditingId] = useState(null)
  
  const [khataLedger, setKhataLedger] = useState([])
  const [advanceLedger, setAdvanceLedger] = useState([])
  const [ordersHistory, setOrdersHistory] = useState([])
  const [ghodaHistory, setGhodaHistory] = useState([])
  const [activeTab, setActiveTab] = useState('profile') // profile, khata, advance, orders, ghoda
  
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [showKhataModal, setShowKhataModal] = useState(false)
  const [txForm, setTxForm] = useState({ amount: '', mode: 'CASH', reason: '' })
  const [editingLedgerEntry, setEditingLedgerEntry] = useState(null)

  const isAdmin = role === 'admin' || role === 'super_admin'

  function exportCSV() {
    const rows = [['Name','Username','Mobile','DOB','Branch','Registration Type','Khata Balance','Advance Balance','GHODA Coins','Total Orders','Registration Date']]
    filtered.forEach(c => {
      rows.push([
        c.name,
        c.username || '',
        c.mobile_number,
        c.dob || '',
        c.branch_id || 'Global',
        c.registration_type || 'admin',
        c.khataBalance || 0,
        c.advanceBalance || 0,
        c.ghoda_coins || 0,
        c.totalPurchases || 0,
        new Date(c.created_at).toLocaleDateString('en-IN')
      ])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `customers_export_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`Exported ${filtered.length} customers`)
  }

  async function fetchCustomers() {
    // Nested query to get balances on the list
    let q = supabase.from('customers').select(`
      *,
      khata_ledger (amount, type),
      advance_ledger (amount, type),
      orders (id, created_at)
    `).order('name')
    
    const { data } = await q
    if (data) {
      // Pre-calculate balances for the list
      const enriched = data.map(c => {
        let khata = 0, adv = 0, lastVisit = null
        ;(c.khata_ledger || []).forEach(l => { khata += (l.type === 'CREDIT' ? Number(l.amount) : -Number(l.amount)) })
        ;(c.advance_ledger || []).forEach(l => { adv += (l.type === 'TOPUP' ? Number(l.amount) : -Number(l.amount)) })
        if (c.orders && c.orders.length > 0) {
          c.orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
          lastVisit = c.orders[0].created_at
        }
        
        const net = khata - adv
        let finalKhata = 0
        let finalAdvance = 0
        if (net > 0) {
          finalKhata = net
        } else if (net < 0) {
          finalAdvance = Math.abs(net)
        }
        
        return { ...c, khataBalance: finalKhata, advanceBalance: finalAdvance, totalPurchases: c.orders?.length || 0, lastVisit }
      })
      setCustomers(enriched)
    }
    setLoading(false)
  }

  useEffect(() => { 
    fetchCustomers() 
    
    const chan = supabase.channel('customers_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        fetchCustomers()
      })
      .subscribe()
    return () => supabase.removeChannel(chan)
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name || form.mobile_number.length !== 10 || !form.dob) { 
      toast.error('Fill required fields correctly')
      return 
    }
    setSaving(true)
    
    try {
      if (editingId) {
        const { data, error } = await supabase.from('customers')
          .update({
            name: form.name,
            mobile_number: form.mobile_number,
            dob: form.dob,
            branch_id: form.branch_id,
            username: form.username.toLowerCase()
          })
          .eq('id', editingId)
          .select().single()
        
        if (error) throw error
        toast.success('Customer updated')
        setCustomers(prev => prev.map(c => c.id === editingId ? { ...c, ...data } : c))
        if (selected?.id === editingId) setSelected({ ...selected, ...data })
      } else {
        const username = form.username || form.name.split(' ')[0].toLowerCase() + Math.floor(Math.random() * 1000)
        const { data, error } = await supabase.from('customers').insert({
          username: username.toLowerCase(),
          name: form.name,
          mobile_number: form.mobile_number,
          dob: form.dob,
          branch_id: form.branch_id,
          ghoda_coins: 0,
          registration_type: 'admin'
        }).select().single()
        
        if (error) throw error
        toast.success('Customer added')
        setCustomers(prev => [{ ...data, khataBalance: 0, advanceBalance: 0, totalPurchases: 0, lastVisit: null }, ...prev].sort((a,b) => a.name.localeCompare(b.name)))
      }
      
      setForm({ username: '', name: '', mobile_number: '', dob: '', branch_id: branchId || 'gurukul' })
      setShowForm(false)
      setEditingId(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(c, e) {
    if (e) e.stopPropagation()
    setForm({ 
      name: c.name, 
      mobile_number: c.mobile_number, 
      dob: c.dob || '', 
      username: c.username, 
      branch_id: c.branch_id || 'gurukul' 
    })
    setEditingId(c.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteCustomer(id, name) {
    if (!confirm(`Permanently delete customer "${name}"? This will remove all their khata and order links from this view.`)) return
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) toast.error('Could not delete: ' + error.message)
    else { toast.success('Customer deleted'); fetchCustomers(); }
  }

  async function viewCustomer(c) {
    setSelected(c)
    setActiveTab('profile')
    
    const [khataRes, advRes, orderRes, ghodaRes] = await Promise.all([
      supabase.from('khata_ledger').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }),
      supabase.from('advance_ledger').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }),
      supabase.from('orders').select('*, order_payments(mode, amount)').eq('customer_id', c.id).order('created_at', { ascending: false }),
      supabase.from('ghoda_transactions').select('*').eq('customer_id', c.id).order('created_at', { ascending: false })
    ])
    
    setKhataLedger(khataRes.data || [])
    setAdvanceLedger(advRes.data || [])
    setOrdersHistory(orderRes.data || [])
    setGhodaHistory(ghodaRes.data || [])
  }

  // --- Live balance derived from already-loaded ledger state (never stale) ---
  const liveKhataRaw = khataLedger.reduce((s, l) => s + (l.type === 'CREDIT' ? +l.amount : -l.amount), 0)
  const liveAdvRaw   = advanceLedger.reduce((s, l) => s + (l.type === 'TOPUP' ? +l.amount : -l.amount), 0)
  const liveNet      = liveKhataRaw - liveAdvRaw
  const displayKhata = Math.max(0, liveNet)
  const displayAdv   = Math.max(0, -liveNet)

  async function handleAddKhataCredit(e) {
    e.preventDefault()
    const X = parseFloat(txForm.amount)
    if (!X || X <= 0) { toast.error('Enter valid amount'); return }
    setSaving(true)
    try {
      await supabase.from('khata_ledger').insert({
        customer_id: selected.id,
        branch_id: selected.branch_id || branchId || 'gurukul',
        type: 'CREDIT',
        amount: X,
        reason: txForm.reason || 'Manual Khata Credit',
        recorded_by: user.username
      })
      toast.success('Khata credit added')
      setShowKhataModal(false)
      setTxForm({ amount: '', mode: 'CASH', reason: '' })
      viewCustomer(selected)
      fetchCustomers()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleRecordPayment(e) {
    e.preventDefault()
    const X = parseFloat(txForm.amount)
    if (!X || X <= 0) { toast.error('Enter valid amount'); return }

    // Gate: nothing to clear
    if (displayKhata === 0) {
      toast.error('No outstanding Khata to clear. Use "Add Advance" to credit the customer.')
      return
    }

    setSaving(true)
    try {
      const branch = selected.branch_id || branchId || 'gurukul'
      const note   = txForm.reason || `Payment via ${txForm.mode}`

      if (X <= displayKhata) {
        // Partial payment — only touches khata_ledger
        await supabase.from('khata_ledger').insert({
          customer_id: selected.id, branch_id: branch,
          type: 'PAYMENT', amount: X, reason: note, recorded_by: user.username
        })
      } else {
        // Overpayment — clear khata, surplus becomes advance
        await supabase.from('khata_ledger').insert({
          customer_id: selected.id, branch_id: branch,
          type: 'PAYMENT', amount: displayKhata,
          reason: `${note} (Khata Cleared)`, recorded_by: user.username
        })
        const surplus = X - displayKhata
        await supabase.from('advance_ledger').insert({
          customer_id: selected.id, branch_id: branch,
          type: 'TOPUP', amount: surplus,
          reason: `${note} (Surplus Advance)`, recorded_by: user.username
        })
      }

      toast.success('Payment recorded')
      setShowPaymentModal(false)
      setTxForm({ amount: '', mode: 'CASH', reason: '' })
      viewCustomer(selected)
      fetchCustomers()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleAddAdvance(e) {
    e.preventDefault()
    const X = parseFloat(txForm.amount)
    if (!X || X <= 0) { toast.error('Enter valid amount'); return }

    // Pure advance TOPUP — net balance display handles reconciliation at read-time
    setSaving(true)
    try {
      await supabase.from('advance_ledger').insert({
        customer_id: selected.id,
        branch_id: selected.branch_id || branchId || 'gurukul',
        type: 'TOPUP',
        amount: X,
        reason: txForm.reason || `Advance via ${txForm.mode}`,
        recorded_by: user.username
      })

      toast.success('Advance added')
      setShowAdvanceModal(false)
      setTxForm({ amount: '', mode: 'CASH', reason: '' })
      viewCustomer(selected)
      fetchCustomers()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  function openEditLedger(entry, table) {
    setEditingLedgerEntry({ ...entry, table })
  }

  async function handleUpdateLedger(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { table, id, amount, type, reason, created_at } = editingLedgerEntry
      const { error } = await supabase.from(table).update({
        amount: parseFloat(amount),
        type,
        reason,
        created_at
      }).eq('id', id)
      
      if (error) throw error
      toast.success('Transaction updated')
      setEditingLedgerEntry(null)
      viewCustomer(selected)
      fetchCustomers()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDeleteLedger(entry, table) {
    if (!confirm('Delete this ledger transaction? This will affect the customer balance.')) return
    try {
      const { error } = await supabase.from(table).delete().eq('id', entry.id)
      if (error) throw error
      toast.success('Transaction deleted')
      viewCustomer(selected)
      fetchCustomers()
    } catch (err) { toast.error(err.message) }
  }

  const filtered = customers.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.mobile_number || '').includes(search)
  )

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-6rem)]">
      {/* Customer list */}
      <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-ink-900 rounded-2xl shadow-sm border border-ink-200 dark:border-ink-800 overflow-hidden">
        <div className="p-4 border-b border-ink-200 dark:border-ink-800 flex flex-col gap-4 bg-ink-50 dark:bg-ink-950/30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-ink-900 dark:text-white tracking-tight">Customers</h1>
              <p className="text-sm font-semibold text-ink-500 mt-0.5">{customers.length} total users</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary px-3 py-2" onClick={exportCSV} title="Export filtered customers as CSV">
                <Download size={15} /> Export CSV
              </button>
              <button className="btn-primary shadow-md px-4 py-2" onClick={() => setShowForm(!showForm)}>
                <Plus size={16} /> New Customer
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input className="input pl-9 w-full bg-white dark:bg-ink-900" placeholder="Search by name, username, mobile..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {showForm && (
          <div className="p-5 bg-ember-50/50 dark:bg-ember-900/10 border-b border-ember-100 dark:border-ember-900/30 animate-slide-up">
            <h3 className="font-bold text-sm mb-3">{editingId ? 'Edit Customer' : 'Add New Customer'}</h3>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" required />
              </div>
              <div>
                <label className="label">Mobile (10 digits) *</label>
                <input className="input" type="tel" maxLength={10} value={form.mobile_number} onChange={e => setForm(p => ({ ...p, mobile_number: e.target.value.replace(/\D/g,'') }))} placeholder="9876543210" required />
              </div>
              <div>
                <label className="label">Date of Birth *</label>
                <input className="input" type="date" value={form.dob} onChange={e => setForm(p => ({ ...p, dob: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Username (Optional)</label>
                <input className="input" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="Auto-generated if blank" />
              </div>
              {!branchId && (
                <div className="sm:col-span-2">
                  <label className="label">Branch *</label>
                  <select className="input" value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}>
                    <option value="gurukul">Gurukul</option>
                    <option value="bhat">Bhat</option>
                    <option value="visat">Visat</option>
                  </select>
                </div>
              )}
              <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
                <button type="submit" className="btn-primary px-6" disabled={saving}>{saving ? 'Saving…' : (editingId ? 'Update' : 'Create')}</button>
              </div>
            </form>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-xl m-1" />)
            : filtered.map(c => (
              <button key={c.id} onClick={() => viewCustomer(c)}
                className={`w-full text-left p-3 rounded-xl flex items-center justify-between border-2 transition-all 
                ${selected?.id === c.id ? 'border-ember bg-ember-50/50 dark:bg-ink-800' : 'border-transparent hover:bg-ink-50 dark:hover:bg-ink-800 hover:border-ink-200 dark:hover:border-ink-700'}`}>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 flex items-center justify-center font-bold text-lg uppercase shrink-0 overflow-hidden">
                    {c.avatar_url ? <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" /> : c.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-ink-900 dark:text-white text-base leading-none">{c.name}</p>
                      {c.registration_type === 'self' && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">Self Registered</span>}
                      {c.branch_id === null && <span className="text-[9px] bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded font-bold uppercase">Global</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                      <span className="font-semibold text-ink-500">@{c.username}</span>
                      <span className="text-ink-400">{c.mobile_number}</span>
                      {c.lastVisit && <span className="text-ink-400 text-[10px]">Visited: {new Date(c.lastVisit).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 grow justify-end px-2">
                  <button onClick={(e) => startEdit(c, e)} className="p-2 text-ink-400 hover:text-ember hover:bg-ember/10 rounded-lg transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deleteCustomer(c.id, c.name); }} className="p-2 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-2 text-xs font-bold">
                    {c.khataBalance > 0 && <span className="text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 rounded">Khata: ₹{c.khataBalance}</span>}
                    {c.advanceBalance > 0 && <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 rounded">Adv: ₹{c.advanceBalance}</span>}
                  </div>
                  <div className="flex gap-2 text-[10px] text-ink-500">
                    <span>🪙 {c.ghoda_coins || 0}</span>
                    <span>🛍️ {c.totalPurchases} orders</span>
                  </div>
                </div>
              </button>
            ))
          }
          {!loading && filtered.length === 0 && <p className="text-center py-10 text-sm font-semibold text-ink-400">No customers found</p>}
        </div>
      </div>

      {/* Ledger Panel */}
      {selected && (
        <div className="md:w-[450px] lg:w-[500px] flex flex-col h-full bg-white dark:bg-ink-900 rounded-2xl shadow-sm border border-ink-200 dark:border-ink-800 overflow-hidden animate-slide-in-right shrink-0">
          
          {/* Header */}
          <div className="p-5 border-b border-ink-200 dark:border-ink-800 bg-ink-900 text-white relative">
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 p-2 bg-ink-800 hover:bg-red-500 text-white rounded-full transition-colors"><X size={16}/></button>
            <div className="flex gap-4 items-center">
              <div className="w-16 h-16 rounded-2xl bg-white text-ink-900 flex items-center justify-center font-black text-3xl uppercase overflow-hidden">
                {selected.avatar_url ? <img src={selected.avatar_url} alt={selected.name} className="w-full h-full object-cover" /> : selected.name[0]}
              </div>
              <div>
                <h2 className="font-black text-2xl leading-none">{selected.name}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-sm text-ink-400 font-mono">@{selected.username} · {selected.mobile_number}</p>
                  <button onClick={(e) => startEdit(selected, e)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-white/80 hover:text-white">
                    <Edit2 size={14}/>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="px-2 pt-2 border-b border-ink-200 dark:border-ink-800 flex overflow-x-auto no-scrollbar">
            {['profile', 'khata', 'advance', 'orders', 'ghoda'].map(tab => (
              <button key={tab} className={`px-4 py-3 text-xs font-black uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${activeTab === tab ? 'border-ember text-ember' : 'border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-white'}`} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto bg-ink-50 dark:bg-ink-950 p-4">
            
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-800">
                    <p className="text-[10px] uppercase font-bold text-ink-400 mb-1">Total Khata (Levana)</p>
                    <p className="text-2xl font-black text-red-500">₹{displayKhata}</p>
                    <button
                      className={`w-full mt-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-colors ${
                        displayKhata > 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-ink-300 dark:bg-ink-700 cursor-not-allowed'
                      }`}
                      onClick={() => setShowPaymentModal(true)}
                      disabled={displayKhata === 0}
                    >
                      {displayKhata > 0 ? 'Record Payment' : 'No Khata Pending'}
                    </button>
                    <button
                      className="w-full mt-2 py-2 text-xs font-bold text-red-600 border border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      onClick={() => setShowKhataModal(true)}
                    >
                      + Add Khata Credit
                    </button>
                  </div>
                  <div className="bg-white dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-800">
                    <p className="text-[10px] uppercase font-bold text-ink-400 mb-1">Advance Balance</p>
                    <p className="text-2xl font-black text-emerald-500">₹{displayAdv}</p>
                    <button className="w-full mt-3 py-2 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-sm" onClick={() => setShowAdvanceModal(true)}>Add Advance</button>
                  </div>
                </div>

                <div className="bg-white dark:bg-ink-900 p-5 rounded-xl border border-ink-200 dark:border-ink-800 space-y-3">
                  <h3 className="font-black text-sm uppercase text-ink-900 dark:text-white border-b border-ink-100 dark:border-ink-800 pb-2">Customer Details</h3>
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div><span className="block text-[10px] font-bold text-ink-400 uppercase">DOB</span> <span className="font-semibold">{selected.dob || '-'}</span></div>
                    <div><span className="block text-[10px] font-bold text-ink-400 uppercase">Branch</span> <span className="font-semibold">{selected.branch_id || 'Global'}</span></div>
                    <div><span className="block text-[10px] font-bold text-ink-400 uppercase">Reg Date</span> <span className="font-semibold">{new Date(selected.created_at).toLocaleDateString()}</span></div>
                    <div><span className="block text-[10px] font-bold text-ink-400 uppercase">Reg Type</span> <span className="font-semibold capitalize">{selected.registration_type || 'Admin'}</span></div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'khata' && (
              khataLedger.length === 0 ? <p className="text-sm font-semibold text-ink-400 text-center py-10">No Khata History</p> :
              <div className="space-y-2">
                {khataLedger.map(l => {
                  const style = getLedgerEntryStyle(l.type, 'customer_khata')
                  return (
                    <div key={l.id} className="group bg-white dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-800 flex gap-4 transition-all hover:border-ink-300 dark:hover:border-ink-700">
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className={`font-bold text-sm ${style.color}`}>{style.label}</p>
                          <div className="flex items-center gap-3">
                            <p className={`font-black text-base tabular-nums ${style.color}`}>{style.prefix}₹{l.amount}</p>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditLedger(l, 'khata_ledger')} className="p-1.5 text-ink-400 hover:text-blue-500 rounded-lg transition-colors bg-ink-50 dark:bg-ink-800"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteLedger(l, 'khata_ledger')} className="p-1.5 text-ink-400 hover:text-red-500 rounded-lg transition-colors bg-ink-50 dark:bg-ink-800"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-ink-500 mt-1">{l.reason}</p>
                        <p className="text-[10px] font-bold text-ink-400 mt-2 uppercase">{new Date(l.created_at).toLocaleString()} {l.recorded_by && `· by ${l.recorded_by}`}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'advance' && (
              advanceLedger.length === 0 ? <p className="text-sm font-semibold text-ink-400 text-center py-10">No Advance History</p> :
              <div className="space-y-2">
                {advanceLedger.map(l => {
                  const style = getLedgerEntryStyle(l.type, 'customer_advance')
                  return (
                    <div key={l.id} className="group bg-white dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-800 flex gap-4 transition-all hover:border-ink-300 dark:hover:border-ink-700">
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className={`font-bold text-sm ${style.color}`}>{style.label}</p>
                          <div className="flex items-center gap-3">
                            <p className={`font-black text-base tabular-nums ${style.color}`}>{style.prefix}₹{l.amount}</p>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditLedger(l, 'advance_ledger')} className="p-1.5 text-ink-400 hover:text-blue-500 rounded-lg transition-colors bg-ink-50 dark:bg-ink-800"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteLedger(l, 'advance_ledger')} className="p-1.5 text-ink-400 hover:text-red-500 rounded-lg transition-colors bg-ink-50 dark:bg-ink-800"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-ink-500 mt-1">{l.reason}</p>
                        <p className="text-[10px] font-bold text-ink-400 mt-2 uppercase">{new Date(l.created_at).toLocaleString()} {l.recorded_by && `· by ${l.recorded_by}`}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'orders' && (
              ordersHistory.length === 0 ? <p className="text-sm font-semibold text-ink-400 text-center py-10">No Orders History</p> :
              <div className="space-y-2">
                {ordersHistory.map(o => {
                  const isKhata = (o.order_payments || []).some(p => p.mode === 'KHATA')
                  const isCancelled = o.status === 'cancelled'
                  
                  let cardClass = "bg-white dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-800"
                  let borderClass = "border-ink-100 dark:border-ink-800"
                  let textClass = "text-ink-900 dark:text-white"
                  let tagClass = "bg-ink-100 dark:bg-ink-800"
                  
                  if (isCancelled) {
                    // default ink theme
                  } else if (isKhata) {
                    cardClass = "bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-200 dark:border-red-900/30"
                    borderClass = "border-red-200 dark:border-red-900/30"
                    textClass = "text-red-700 dark:text-red-400"
                    tagClass = "bg-red-200/50 dark:bg-red-900/50 text-red-800 dark:text-red-300"
                  } else {
                    cardClass = "bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/30"
                    borderClass = "border-emerald-200 dark:border-emerald-900/30"
                    textClass = "text-emerald-700 dark:text-emerald-400"
                    tagClass = "bg-emerald-200/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300"
                  }

                  return (
                    <div key={o.id} className={cardClass}>
                      <div className={`flex justify-between items-center border-b pb-2 mb-2 ${borderClass}`}>
                        <p className={`font-mono text-xs font-bold ${isKhata ? 'text-red-500/70' : 'text-ink-500'}`}>#{o.order_number || o.id.slice(0,8).toUpperCase()}</p>
                        <p className={`font-black text-lg ${textClass}`}>₹{o.total}</p>
                      </div>
                      <div className="flex justify-between items-end text-xs">
                        <div>
                          <p className={`font-bold uppercase ${isKhata ? 'text-red-600/60' : 'text-ink-500'}`}>{new Date(o.created_at).toLocaleString()}</p>
                          <p className="mt-1 flex gap-1">
                            {(o.order_payments || []).map((p,i) => <span key={i} className={`${tagClass} px-1.5 py-0.5 rounded font-bold text-[9px] uppercase`}>{p.mode}</span>)}
                          </p>
                        </div>
                        <span className={`font-bold px-2 py-1 rounded uppercase tracking-wider text-[10px] ${o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{o.status}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'ghoda' && (
              ghodaHistory.length === 0 ? <p className="text-sm font-semibold text-ink-400 text-center py-10">No Ghoda Coins History</p> :
              <div className="space-y-2">
                {ghodaHistory.map(g => (
                  <div key={g.id} className="bg-white dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-800 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm">{g.type === 'earn' ? 'Earned Coins' : 'Spent Coins'}</p>
                      <p className="text-xs text-ink-500 mt-0.5">{g.reason}</p>
                      <p className="text-[10px] font-bold text-ink-400 mt-1 uppercase">{new Date(g.created_at).toLocaleDateString()}</p>
                    </div>
                    <p className={`font-black text-lg tabular-nums ${g.type === 'earn' ? 'text-amber-500' : 'text-ink-900 dark:text-white'}`}>
                      {g.type === 'earn' ? '+' : '-'}🪙{g.amount}
                    </p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Action Modals */}
      <Modal title="Record Payment (Clear Khata)" show={showPaymentModal} onClose={() => setShowPaymentModal(false)} onSubmit={handleRecordPayment} saving={saving}>
        <div>
          <label className="label">Amount Paid (₹) *</label>
          <input className="input w-full font-black text-lg" type="number" min="1" required value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} autoFocus />
        </div>
        <div>
          <label className="label">Payment Mode</label>
          <select className="input w-full" value={txForm.mode} onChange={e => setTxForm({...txForm, mode: e.target.value})}>
            <option value="CASH">Cash</option>
            <option value="ONLINE">Online (UPI / Card)</option>
          </select>
        </div>
        <div>
          <label className="label">Note / Reference ID</label>
          <input className="input w-full" value={txForm.reason} onChange={e => setTxForm({...txForm, reason: e.target.value})} placeholder="Optional" />
        </div>
      </Modal>

      <Modal title="Add Khata Credit (Goods on Credit)" show={showKhataModal} onClose={() => { setShowKhataModal(false); setTxForm({ amount: '', mode: 'CASH', reason: '' }) }} onSubmit={handleAddKhataCredit} saving={saving}>
        <div>
          <label className="label">Amount (₹) *</label>
          <input className="input w-full font-black text-lg" type="number" min="1" required value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} autoFocus />
        </div>
        <div>
          <label className="label">Reason / Item Description</label>
          <input className="input w-full" value={txForm.reason} onChange={e => setTxForm({...txForm, reason: e.target.value})} placeholder="e.g. Cigarettes on credit" />
        </div>
        <p className="text-xs text-red-500 font-semibold">⚠ This adds to what the customer owes you (Khata/Levana).</p>
      </Modal>

      <Modal title="Add Advance Balance" show={showAdvanceModal} onClose={() => setShowAdvanceModal(false)} onSubmit={handleAddAdvance} saving={saving}>
        <div>
          <label className="label">Advance Amount (₹) *</label>
          <input className="input w-full font-black text-lg" type="number" min="1" required value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} autoFocus />
        </div>
        <div>
          <label className="label">Payment Mode</label>
          <select className="input w-full" value={txForm.mode} onChange={e => setTxForm({...txForm, mode: e.target.value})}>
            <option value="CASH">Cash</option>
            <option value="ONLINE">Online (UPI / Card)</option>
          </select>
        </div>
        <div>
          <label className="label">Note / Reference ID</label>
          <input className="input w-full" value={txForm.reason} onChange={e => setTxForm({...txForm, reason: e.target.value})} placeholder="Optional" />
        </div>
      </Modal>

      <Modal title="Edit Ledger Transaction" show={!!editingLedgerEntry} onClose={() => setEditingLedgerEntry(null)} onSubmit={handleUpdateLedger} saving={saving}>
        {editingLedgerEntry && (
          <>
            <div>
              <label className="label">Amount (₹) *</label>
              <input className="input w-full font-black text-lg" type="number" step="0.01" min="0" required value={editingLedgerEntry.amount} onChange={e => setEditingLedgerEntry({...editingLedgerEntry, amount: e.target.value})} autoFocus />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input w-full" value={editingLedgerEntry.type} onChange={e => setEditingLedgerEntry({...editingLedgerEntry, type: e.target.value})}>
                {editingLedgerEntry.table === 'khata_ledger' ? (
                  <>
                    <option value="CREDIT">Khata (Owe)</option>
                    <option value="PAYMENT">Payment (Clear)</option>
                  </>
                ) : (
                  <>
                    <option value="TOPUP">Topup (Add Advance)</option>
                    <option value="DEDUCTION">Deduction (Used Advance)</option>
                    <option value="REFUND">Refund</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="label">Note / Reason</label>
              <input className="input w-full" value={editingLedgerEntry.reason || ''} onChange={e => setEditingLedgerEntry({...editingLedgerEntry, reason: e.target.value})} />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input w-full" type="datetime-local" value={new Date(new Date(editingLedgerEntry.created_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => setEditingLedgerEntry({...editingLedgerEntry, created_at: new Date(e.target.value).toISOString()})} />
            </div>
          </>
        )}
      </Modal>

    </div>
  )
}
