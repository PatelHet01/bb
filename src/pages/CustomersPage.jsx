import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Search, X, CreditCard, Banknote, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

export default function CustomersPage() {
  const { branchId, user } = useAuthStore()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', name: '', mobile_number: '', dob: '', branch_id: branchId || 'gurukul' })
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  
  const [khataLedger, setKhataLedger] = useState([])
  const [advanceLedger, setAdvanceLedger] = useState([])
  const [activeTab, setActiveTab] = useState('khata') // 'khata' or 'advance'
  
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [txForm, setTxForm] = useState({ amount: '', mode: 'CASH', reason: '' })

  async function fetchCustomers() {
    let q = supabase.from('customers').select('*').order('name')
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setCustomers(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [branchId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.username || !form.name || form.mobile_number.length !== 10 || !form.dob) { 
      toast.error('Fill all fields correctly')
      return 
    }
    setSaving(true)
    try {
      await supabase.from('customers').insert({
        username: form.username.toLowerCase(),
        name: form.name,
        mobile_number: form.mobile_number,
        dob: form.dob,
        branch_id: form.branch_id,
        ghoda_coins: 0,
      })
      toast.success('Customer added')
      setForm({ username: '', name: '', mobile_number: '', dob: '', branch_id: branchId || 'gurukul' })
      setShowForm(false)
      fetchCustomers()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function viewCustomer(c) {
    setSelected(c)
    setActiveTab('khata')
    
    const [khataRes, advRes] = await Promise.all([
      supabase.from('khata_ledger').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }),
      supabase.from('advance_ledger').select('*').eq('customer_id', c.id).order('created_at', { ascending: false })
    ])
    
    setKhataLedger(khataRes.data || [])
    setAdvanceLedger(advRes.data || [])
  }

  function getKhataBalance() {
    return khataLedger.reduce((sum, l) => {
      if (l.type === 'CREDIT') return sum + Number(l.amount)
      return sum - Number(l.amount)
    }, 0)
  }

  function getAdvanceBalance() {
    return advanceLedger.reduce((sum, l) => {
      if (l.type === 'TOPUP') return sum + Number(l.amount)
      return sum - Number(l.amount)
    }, 0)
  }

  async function handleRecordPayment(e) {
    e.preventDefault()
    if (!txForm.amount || txForm.amount <= 0) { toast.error('Enter valid amount'); return }
    setSaving(true)
    try {
      await supabase.from('khata_ledger').insert({
        customer_id: selected.id,
        branch_id: selected.branch_id,
        type: 'PAYMENT',
        amount: parseFloat(txForm.amount),
        reason: txForm.reason || `Payment via ${txForm.mode}`,
        recorded_by: user.username
      })
      toast.success('Payment recorded')
      setShowPaymentModal(false)
      setTxForm({ amount: '', mode: 'CASH', reason: '' })
      viewCustomer(selected) // refresh ledgers
    } catch (e) {
      toast.error('Failed to record payment: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddAdvance(e) {
    e.preventDefault()
    if (!txForm.amount || txForm.amount <= 0) { toast.error('Enter valid amount'); return }
    setSaving(true)
    try {
      await supabase.from('advance_ledger').insert({
        customer_id: selected.id,
        branch_id: selected.branch_id,
        type: 'TOPUP',
        amount: parseFloat(txForm.amount),
        reason: txForm.reason || `Advance via ${txForm.mode}`,
        recorded_by: user.username
      })
      toast.success('Advance added')
      setShowAdvanceModal(false)
      setTxForm({ amount: '', mode: 'CASH', reason: '' })
      viewCustomer(selected) // refresh ledgers
    } catch (e) {
      toast.error('Failed to add advance: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.username.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile_number.includes(search)
  )

  const Modal = ({ title, show, onClose, onSubmit, children }) => {
    if (!show) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-ink-900 rounded-xl shadow-modal w-full max-w-sm overflow-hidden animate-slide-up">
          <div className="px-5 py-4 border-b border-ink-200 dark:border-ink-800 flex justify-between items-center">
            <h3 className="font-bold text-ink-900 dark:text-white">{title}</h3>
            <button onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"><X size={18}/></button>
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
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-ink-900 dark:text-white tracking-tight">Customers</h1>
            <p className="text-sm text-ink-400 mt-0.5">{customers.length} registered</p>
          </div>
          <button className="btn-primary btn-sm" onClick={() => setShowForm(!showForm)} id="btn-add-customer">
            <Plus size={14} /> Add Customer
          </button>
        </div>

        {showForm && (
          <div className="card p-5 mb-4 animate-slide-up">
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Username *</label>
                <input className="input text-sm" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="unique_id" />
              </div>
              <div>
                <label className="label">Full Name *</label>
                <input className="input text-sm" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" />
              </div>
              <div>
                <label className="label">Mobile (10 digits) *</label>
                <input className="input text-sm" type="tel" maxLength={10} value={form.mobile_number} onChange={e => setForm(p => ({ ...p, mobile_number: e.target.value.replace(/\D/g,'') }))} placeholder="9876543210" />
              </div>
              <div>
                <label className="label">Date of Birth *</label>
                <input className="input text-sm" type="date" value={form.dob} onChange={e => setForm(p => ({ ...p, dob: e.target.value }))} />
              </div>
              {!branchId && (
                <div>
                  <label className="label">Branch *</label>
                  <select className="input text-sm" value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}>
                    <option value="gurukul">Gurukul</option>
                    <option value="bhat">Bhat</option>
                    <option value="visat">Visat</option>
                  </select>
                </div>
              )}
              <div className="sm:col-span-2 flex gap-2 justify-end mt-2">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save Customer'}</button>
              </div>
            </form>
          </div>
        )}

        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input className="input pl-8" placeholder="Search by username, name or mobile…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="card flex-1 overflow-hidden flex flex-col">
          <div className="overflow-y-auto divide-y divide-ink-100 dark:divide-ink-800">
            {loading
              ? Array(5).fill(0).map((_, i) => <div key={i} className="px-4 py-3 skeleton h-12 m-3" />)
              : filtered.map(c => (
                <button
                  key={c.id}
                  className={`w-full text-left px-5 py-3 flex items-center justify-between hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors ${selected?.id === c.id ? 'bg-ink-50 dark:bg-ink-800' : ''}`}
                  onClick={() => viewCustomer(c)}
                >
                  <div>
                    <p className="font-semibold text-ink-900 dark:text-white text-sm">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-ink-500">@{c.username}</span>
                      <span className="text-xs text-ink-400">{c.mobile_number}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="badge-warning">🪙 {c.ghoda_coins || 0}</span>
                  </div>
                </button>
              ))
            }
            {!loading && filtered.length === 0 && (
              <p className="text-center py-8 text-sm text-ink-400">No customers found</p>
            )}
          </div>
        </div>
      </div>

      {/* Ledger panel */}
      {selected && (
        <div className="md:w-[400px] flex flex-col h-full card overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/50 flex justify-between items-start">
            <div>
              <h2 className="font-bold text-lg text-ink-900 dark:text-white">{selected.name}</h2>
              <p className="text-xs text-ink-500 font-mono">@{selected.username} · {selected.mobile_number}</p>
            </div>
            <button onClick={() => setSelected(null)} className="btn-ghost p-1.5 -mr-1.5 rounded-lg text-ink-400 hover:text-ink-900 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>

          {/* Balances */}
          <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-ink-100 dark:border-ink-800">
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3 rounded-xl">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Khata (Levana)</p>
              <p className="text-xl font-bold text-red-700 dark:text-red-400">₹{getKhataBalance().toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-xl">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Advance Balance</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">₹{getAdvanceBalance().toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-3 flex gap-2 border-b border-ink-100 dark:border-ink-800">
            <button className="btn-primary flex-1 btn-sm" onClick={() => setShowPaymentModal(true)}>
              Record Payment
            </button>
            <button className="btn-secondary flex-1 btn-sm" onClick={() => setShowAdvanceModal(true)}>
              Add Advance
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-2 pt-2 gap-1 border-b border-ink-100 dark:border-ink-800">
            <button 
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'khata' ? 'border-ink-900 dark:border-white text-ink-900 dark:text-white' : 'border-transparent text-ink-500 hover:text-ink-700'}`}
              onClick={() => setActiveTab('khata')}
            >
              Khata Ledger
            </button>
            <button 
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'advance' ? 'border-ink-900 dark:border-white text-ink-900 dark:text-white' : 'border-transparent text-ink-500 hover:text-ink-700'}`}
              onClick={() => setActiveTab('advance')}
            >
              Advance Ledger
            </button>
          </div>

          {/* Ledger Content */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-ink-900">
            {activeTab === 'khata' ? (
              khataLedger.length === 0 ? <p className="text-sm text-ink-400 text-center py-8">No khata history</p> :
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {khataLedger.map(l => (
                  <div key={l.id} className="p-4 flex items-start gap-3">
                    <div className={`mt-0.5 ${l.type === 'CREDIT' ? 'text-red-500' : 'text-emerald-500'}`}>
                      {l.type === 'CREDIT' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <p className="text-sm font-semibold text-ink-900 dark:text-white">
                          {l.type === 'CREDIT' ? 'Credit Used' : l.type === 'PAYMENT' ? 'Payment Received' : 'Adjustment'}
                        </p>
                        <p className={`font-bold tabular-nums ${l.type === 'CREDIT' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {l.type === 'CREDIT' ? '+' : '-'}₹{l.amount}
                        </p>
                      </div>
                      <p className="text-xs text-ink-500 truncate mt-0.5">{l.reason}</p>
                      <p className="text-[10px] text-ink-400 mt-1">{new Date(l.created_at).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              advanceLedger.length === 0 ? <p className="text-sm text-ink-400 text-center py-8">No advance history</p> :
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {advanceLedger.map(l => (
                  <div key={l.id} className="p-4 flex items-start gap-3">
                    <div className={`mt-0.5 ${l.type === 'TOPUP' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {l.type === 'TOPUP' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <p className="text-sm font-semibold text-ink-900 dark:text-white">
                          {l.type === 'TOPUP' ? 'Advance Added' : l.type === 'DEDUCTION' ? 'Used for Purchase' : 'Refunded'}
                        </p>
                        <p className={`font-bold tabular-nums ${l.type === 'TOPUP' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {l.type === 'TOPUP' ? '+' : '-'}₹{l.amount}
                        </p>
                      </div>
                      <p className="text-xs text-ink-500 truncate mt-0.5">{l.reason}</p>
                      <p className="text-[10px] text-ink-400 mt-1">{new Date(l.created_at).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal title="Record Payment (Khata)" show={showPaymentModal} onClose={() => setShowPaymentModal(false)} onSubmit={handleRecordPayment}>
        <div>
          <label className="label">Amount Paid (₹)</label>
          <input className="input" type="number" min="1" required value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} />
        </div>
        <div>
          <label className="label">Payment Mode</label>
          <select className="input" value={txForm.mode} onChange={e => setTxForm({...txForm, mode: e.target.value})}>
            <option value="CASH">Cash</option>
            <option value="ONLINE">Online (UPI / Card)</option>
          </select>
        </div>
        <div>
          <label className="label">Note (Optional)</label>
          <input className="input" value={txForm.reason} onChange={e => setTxForm({...txForm, reason: e.target.value})} placeholder="e.g. Paid in cash" />
        </div>
      </Modal>

      <Modal title="Add Advance" show={showAdvanceModal} onClose={() => setShowAdvanceModal(false)} onSubmit={handleAddAdvance}>
        <div>
          <label className="label">Advance Amount (₹)</label>
          <input className="input" type="number" min="1" required value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} />
        </div>
        <div>
          <label className="label">Payment Mode</label>
          <select className="input" value={txForm.mode} onChange={e => setTxForm({...txForm, mode: e.target.value})}>
            <option value="CASH">Cash</option>
            <option value="ONLINE">Online (UPI / Card)</option>
          </select>
        </div>
        <div>
          <label className="label">Note (Optional)</label>
          <input className="input" value={txForm.reason} onChange={e => setTxForm({...txForm, reason: e.target.value})} placeholder="e.g. Paid in cash" />
        </div>
      </Modal>

    </div>
  )
}
