import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Search, X, ArrowDownCircle, ArrowUpCircle, UserCircle, Edit2, ShoppingBag } from 'lucide-react'

export default function CustomersPage() {
  const { branchId, user, role } = useAuthStore()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', name: '', mobile_number: '', dob: '', branch_id: branchId || 'gurukul' })
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  
  const [khataLedger, setKhataLedger] = useState([])
  const [advanceLedger, setAdvanceLedger] = useState([])
  const [ordersHistory, setOrdersHistory] = useState([])
  const [ghodaHistory, setGhodaHistory] = useState([])
  const [activeTab, setActiveTab] = useState('profile') // profile, khata, advance, orders, ghoda
  
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [txForm, setTxForm] = useState({ amount: '', mode: 'CASH', reason: '' })

  const isAdmin = role === 'admin' || role === 'super_admin'

  async function fetchCustomers() {
    // Nested query to get balances on the list
    let q = supabase.from('customers').select(`
      *,
      khata_ledger (amount, type),
      advance_ledger (amount, type),
      orders (id, created_at)
    `).order('name')
    
    if (branchId) {
      q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }
    
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
        return { ...c, khataBalance: khata, advanceBalance: adv, totalPurchases: c.orders?.length || 0, lastVisit }
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
  }, [branchId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name || form.mobile_number.length !== 10 || !form.dob) { 
      toast.error('Fill required fields correctly')
      return 
    }
    setSaving(true)
    
    const username = form.username || form.name.split(' ')[0].toLowerCase() + Math.floor(Math.random() * 1000)
    
    const newCustomer = {
      username: username.toLowerCase(),
      name: form.name,
      mobile_number: form.mobile_number,
      dob: form.dob,
      branch_id: form.branch_id,
      ghoda_coins: 0,
      registration_type: 'admin'
    }
    
    try {
      const { data, error } = await supabase.from('customers').insert(newCustomer).select().single()
      if (error) throw error
      
      toast.success('Customer added')
      setForm({ username: '', name: '', mobile_number: '', dob: '', branch_id: branchId || 'gurukul' })
      setShowForm(false)
      
      // Optimistic update
      setCustomers(prev => [{ ...data, khataBalance: 0, advanceBalance: 0, totalPurchases: 0, lastVisit: null }, ...prev].sort((a,b) => a.name.localeCompare(b.name)))
      
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
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

  async function handleRecordPayment(e) {
    e.preventDefault()
    if (!txForm.amount || txForm.amount <= 0) { toast.error('Enter valid amount'); return }
    setSaving(true)
    try {
      await supabase.from('khata_ledger').insert({
        customer_id: selected.id,
        branch_id: selected.branch_id || branchId || 'gurukul',
        type: 'PAYMENT',
        amount: parseFloat(txForm.amount),
        reason: txForm.reason || `Payment via ${txForm.mode}`,
        recorded_by: user.username
      })
      toast.success('Payment recorded')
      setShowPaymentModal(false)
      setTxForm({ amount: '', mode: 'CASH', reason: '' })
      viewCustomer(selected) 
      fetchCustomers() // Refresh balances in list
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleAddAdvance(e) {
    e.preventDefault()
    if (!txForm.amount || txForm.amount <= 0) { toast.error('Enter valid amount'); return }
    setSaving(true)
    try {
      await supabase.from('advance_ledger').insert({
        customer_id: selected.id,
        branch_id: selected.branch_id || branchId || 'gurukul',
        type: 'TOPUP',
        amount: parseFloat(txForm.amount),
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

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.username.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile_number.includes(search)
  )

  const Modal = ({ title, show, onClose, onSubmit, children }) => {
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
            <button className="btn-primary shadow-md px-4 py-2" onClick={() => setShowForm(!showForm)}>
              <Plus size={16} /> New Customer
            </button>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input className="input pl-9 w-full bg-white dark:bg-ink-900" placeholder="Search by name, username, mobile..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {showForm && (
          <div className="p-5 bg-ember-50/50 dark:bg-ember-900/10 border-b border-ember-100 dark:border-ember-900/30 animate-slide-up">
            <h3 className="font-bold text-sm mb-3">Add New Customer</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary px-6" disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
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
                  <div className="w-10 h-10 rounded-full bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 flex items-center justify-center font-bold text-lg uppercase shrink-0">
                    {c.name[0]}
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
              <div className="w-16 h-16 rounded-2xl bg-white text-ink-900 flex items-center justify-center font-black text-3xl uppercase">{selected.name[0]}</div>
              <div>
                <h2 className="font-black text-2xl leading-none">{selected.name}</h2>
                <p className="text-sm text-ink-400 font-mono mt-1">@{selected.username} · {selected.mobile_number}</p>
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
                    <p className="text-2xl font-black text-red-500">₹{selected.khataBalance}</p>
                    <button className="w-full mt-3 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm" onClick={() => setShowPaymentModal(true)}>Record Payment</button>
                  </div>
                  <div className="bg-white dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-800">
                    <p className="text-[10px] uppercase font-bold text-ink-400 mb-1">Advance Balance</p>
                    <p className="text-2xl font-black text-emerald-500">₹{selected.advanceBalance}</p>
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
                {khataLedger.map(l => (
                  <div key={l.id} className="bg-white dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-800 flex gap-4">
                    <div className={`mt-1 ${l.type === 'CREDIT' ? 'text-red-500' : 'text-emerald-500'}`}>{l.type === 'CREDIT' ? <ArrowUpCircle size={24}/> : <ArrowDownCircle size={24}/>}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm">{l.type === 'CREDIT' ? 'Credit Used' : 'Payment Received'}</p>
                        <p className={`font-black text-base tabular-nums ${l.type === 'CREDIT' ? 'text-red-500' : 'text-emerald-500'}`}>{l.type === 'CREDIT' ? '+' : '-'}₹{l.amount}</p>
                      </div>
                      <p className="text-xs text-ink-500 mt-1">{l.reason}</p>
                      <p className="text-[10px] font-bold text-ink-400 mt-2 uppercase">{new Date(l.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'advance' && (
              advanceLedger.length === 0 ? <p className="text-sm font-semibold text-ink-400 text-center py-10">No Advance History</p> :
              <div className="space-y-2">
                {advanceLedger.map(l => (
                  <div key={l.id} className="bg-white dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-800 flex gap-4">
                    <div className={`mt-1 ${l.type === 'TOPUP' ? 'text-emerald-500' : 'text-red-500'}`}>{l.type === 'TOPUP' ? <ArrowUpCircle size={24}/> : <ArrowDownCircle size={24}/>}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm">{l.type === 'TOPUP' ? 'Advance Added' : 'Used for Bill'}</p>
                        <p className={`font-black text-base tabular-nums ${l.type === 'TOPUP' ? 'text-emerald-500' : 'text-red-500'}`}>{l.type === 'TOPUP' ? '+' : '-'}₹{l.amount}</p>
                      </div>
                      <p className="text-xs text-ink-500 mt-1">{l.reason}</p>
                      <p className="text-[10px] font-bold text-ink-400 mt-2 uppercase">{new Date(l.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'orders' && (
              ordersHistory.length === 0 ? <p className="text-sm font-semibold text-ink-400 text-center py-10">No Orders History</p> :
              <div className="space-y-2">
                {ordersHistory.map(o => (
                  <div key={o.id} className="bg-white dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-800">
                    <div className="flex justify-between items-center border-b border-ink-100 dark:border-ink-800 pb-2 mb-2">
                      <p className="font-mono text-xs font-bold text-ink-500">#{o.order_number || o.id.slice(0,8).toUpperCase()}</p>
                      <p className="font-black text-lg text-ink-900 dark:text-white">₹{o.total}</p>
                    </div>
                    <div className="flex justify-between items-end text-xs">
                      <div>
                        <p className="font-bold text-ink-500 uppercase">{new Date(o.created_at).toLocaleString()}</p>
                        <p className="mt-1 flex gap-1">
                          {(o.order_payments || []).map((p,i) => <span key={i} className="bg-ink-100 dark:bg-ink-800 px-1.5 py-0.5 rounded font-bold text-[9px] uppercase">{p.mode}</span>)}
                        </p>
                      </div>
                      <span className={`font-bold px-2 py-1 rounded uppercase tracking-wider text-[10px] ${o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{o.status}</span>
                    </div>
                  </div>
                ))}
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
      <Modal title="Record Payment (Clear Khata)" show={showPaymentModal} onClose={() => setShowPaymentModal(false)} onSubmit={handleRecordPayment}>
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

      <Modal title="Add Advance Balance" show={showAdvanceModal} onClose={() => setShowAdvanceModal(false)} onSubmit={handleAddAdvance}>
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

    </div>
  )
}
