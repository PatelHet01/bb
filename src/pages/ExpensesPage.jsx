import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Plus, Trash2, Edit2, CheckCircle2, Lock, Unlock, PlusCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

const categories = ['Rent', 'Utilities', 'Supplies', 'Salaries', 'Maintenance', 'Misc']

export default function ExpensesPage() {
  const { branchId, user, role } = useAuthStore()
  const isSuperAdmin = role === 'super_admin' || role === 'admin'
  const [expenses,     setExpenses]     = useState([])
  const [fixedCosts,   setFixedCosts]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [editingId,    setEditingId]    = useState(null)
  const [form, setForm] = useState({
    category: 'Supplies', amount: '', description: '',
    payment_mode: 'CASH', expense_date: new Date().toISOString().split('T')[0]
  })

  // Fixed cost add form
  const [showFCForm, setShowFCForm] = useState(false)
  const [fcForm, setFcForm] = useState({ name: '', amount: '', category: 'Rent' })
  const [fcSaving, setFcSaving] = useState(false)
  const [payingId, setPayingId] = useState(null)

  useEffect(() => { fetchExpenses(); fetchFixedCosts() }, [branchId])

  async function fetchExpenses() {
    let q = supabase.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false })
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setExpenses(data || [])
    setLoading(false)
  }

  async function fetchFixedCosts() {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'fixed_costs').single()
    setFixedCosts(data?.value || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      branch_id: branchId || 'gurukul',
      category: form.category,
      amount: parseFloat(form.amount),
      description: form.description,
      payment_mode: form.payment_mode || 'CASH',
      expense_date: form.expense_date,
      logged_by: String(user.id).startsWith('hardcoded') ? null : user.id,
      recorded_by: user.username
    }
    let error
    if (editingId) {
      const res = await supabase.from('expenses').update(payload).eq('id', editingId)
      error = res.error
    } else {
      const res = await supabase.from('expenses').insert(payload)
      error = res.error
    }
    if (error) return toast.error(error.message)
    toast.success(editingId ? 'Expense updated' : 'Expense logged')
    setShowForm(false); setEditingId(null)
    setForm({ category: 'Supplies', amount: '', description: '', payment_mode: 'CASH', expense_date: new Date().toISOString().split('T')[0] })
    fetchExpenses()
  }

  async function handleDelete(id) {
    if (!confirm('Delete expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) toast.error(error.message)
    else fetchExpenses()
  }

  // ── Fixed Costs ─────────────────────────────────────────────────────────────
  async function saveFixedCosts(next) {
    const { error } = await supabase.from('system_settings').upsert({ key: 'fixed_costs', value: next })
    if (error) { toast.error(error.message); return false }
    setFixedCosts(next)
    return true
  }

  async function handleAddFC(e) {
    e.preventDefault()
    if (!fcForm.name.trim() || !fcForm.amount) return toast.error('Fill all fields')
    setFcSaving(true)
    const next = [...fixedCosts, {
      id: Date.now().toString(),
      name: fcForm.name.trim(),
      amount: parseFloat(fcForm.amount),
      category: fcForm.category
    }]
    const ok = await saveFixedCosts(next)
    if (ok) { setShowFCForm(false); setFcForm({ name: '', amount: '', category: 'Rent' }); toast.success('Fixed cost added') }
    setFcSaving(false)
  }

  async function handleRemoveFC(id) {
    if (!confirm('Remove this fixed cost?')) return
    const next = fixedCosts.filter(f => f.id !== id)
    const ok = await saveFixedCosts(next)
    if (ok) toast.success('Fixed cost removed')
  }

  async function handlePayFC(fc) {
    setPayingId(fc.id)
    const today = new Date().toISOString().split('T')[0]
    const payload = {
      branch_id: branchId || 'gurukul',
      category: fc.category,
      amount: fc.amount,
      description: `${fc.name} — Fixed Cost Payment`,
      payment_mode: 'CASH',
      expense_date: today,
      logged_by: String(user.id).startsWith('hardcoded') ? null : user.id,
      recorded_by: user.username
    }
    const { error } = await supabase.from('expenses').insert(payload)
    if (error) { toast.error(error.message); setPayingId(null); return }
    toast.success(`₹${fc.amount.toLocaleString('en-IN')} logged for ${fc.name}`)
    fetchExpenses()
    setPayingId(null)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-dash-text dark:text-dash-textDark">Expenses</h1>
        <button className="btn-primary btn-sm" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ category: 'Supplies', amount: '', description: '', payment_mode: 'CASH', expense_date: new Date().toISOString().split('T')[0] }) }}>
          <Plus size={16} /> Log Expense
        </button>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 animate-slide-up bg-white dark:bg-zinc-900 border-2 border-ember/20 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="w-full">
              <span className="label">Date</span>
              <input type="date" className="input" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} required />
            </div>
            <div className="w-full">
              <span className="label">Category</span>
              <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-full">
              <span className="label">Amount (₹)</span>
              <input required type="number" step="0.01" className="input font-bold" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div className="w-full">
              <span className="label">Payment Mode</span>
              <select className="input" value={form.payment_mode || 'CASH'} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                <option value="CASH">💵 Cash</option>
                <option value="ONLINE">🌐 Online</option>
              </select>
            </div>
            <div className="w-full">
              <span className="label">Description</span>
              <input type="text" className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional note" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary px-8">{editingId ? 'Update Expense' : 'Save Expense'}</button>
          </div>
        </form>
      )}

      {/* ── Fixed / Recurring Costs Section ─────────────────────────────────── */}
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-amber-200 dark:border-amber-800/40 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-amber-100 dark:border-amber-800/30 bg-amber-50/60 dark:bg-amber-900/10 flex items-center justify-between">
          <div>
            <h2 className="font-black text-sm text-amber-900 dark:text-amber-300 uppercase tracking-wide flex items-center gap-2">
              🔒 Fixed / Recurring Costs
            </h2>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-0.5">Set once — click Paid to log payment instantly</p>
          </div>
          {isSuperAdmin && (
            <button
              onClick={() => setShowFCForm(!showFCForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-black hover:bg-amber-600 transition-all"
            >
              <PlusCircle size={13} /> Add Fixed Cost
            </button>
          )}
        </div>

        {/* Add FC form */}
        {showFCForm && (
          <form onSubmit={handleAddFC} className="px-6 py-4 border-b border-amber-100 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-900/5 animate-slide-up">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <span className="label text-amber-700 dark:text-amber-400">Cost Name</span>
                <input className="input" placeholder="e.g. Monthly Rent" value={fcForm.name} onChange={e => setFcForm({ ...fcForm, name: e.target.value })} required />
              </div>
              <div>
                <span className="label text-amber-700 dark:text-amber-400">Amount (₹)</span>
                <input type="number" step="0.01" className="input font-bold" placeholder="0.00" value={fcForm.amount} onChange={e => setFcForm({ ...fcForm, amount: e.target.value })} required />
              </div>
              <div>
                <span className="label text-amber-700 dark:text-amber-400">Category</span>
                <select className="input" value={fcForm.category} onChange={e => setFcForm({ ...fcForm, category: e.target.value })}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button type="button" onClick={() => setShowFCForm(false)} className="btn-secondary btn-sm"><X size={13} /> Cancel</button>
              <button type="submit" disabled={fcSaving} className="btn-primary btn-sm bg-amber-500 hover:bg-amber-600 border-amber-500">
                {fcSaving ? 'Saving...' : 'Save Fixed Cost'}
              </button>
            </div>
          </form>
        )}

        {/* Fixed Cost Cards */}
        <div className="p-4">
          {fixedCosts.length === 0 ? (
            <p className="text-center text-sm text-ink-400 font-medium py-4">No fixed costs configured. Click "Add Fixed Cost" to set up recurring expenses.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {fixedCosts.map(fc => (
                <div key={fc.id} className="relative bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl p-4 flex flex-col gap-2">
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleRemoveFC(fc.id)}
                      className="absolute top-2 right-2 text-ink-300 hover:text-red-500 transition-colors"
                    ><X size={13} /></button>
                  )}
                  <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">{fc.category}</span>
                  <p className="font-black text-ink-900 dark:text-white text-sm leading-tight">{fc.name}</p>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-400">₹{Number(fc.amount).toLocaleString('en-IN')}</p>
                  <button
                    onClick={() => handlePayFC(fc)}
                    disabled={payingId === fc.id}
                    className="mt-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-all disabled:opacity-60"
                  >
                    <CheckCircle2 size={14} />
                    {payingId === fc.id ? 'Logging...' : 'Mark as Paid'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expense Log Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="tbl-head">Date</th>
              <th className="tbl-head">Category</th>
              <th className="tbl-head">Description</th>
              <th className="tbl-head text-center">Mode</th>
              <th className="tbl-head text-right">Amount</th>
              <th className="tbl-head text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="tbl-cell text-center">Loading...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan="6" className="tbl-cell text-center text-dash-muted">No expenses found</td></tr>
            ) : expenses.map(exp => (
              <tr key={exp.id} className="tbl-row">
                <td className="tbl-cell font-medium">{new Date(exp.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td className="tbl-cell"><span className="badge-default">{exp.category}</span></td>
                <td className="tbl-cell text-dash-muted">{exp.description || '-'}</td>
                <td className="tbl-cell text-center">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    exp.payment_mode === 'ONLINE'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  }`}>
                    {exp.payment_mode || 'CASH'}
                  </span>
                </td>
                <td className="tbl-cell text-right text-red-600 font-bold">₹{exp.amount.toLocaleString('en-IN')}</td>
                <td className="tbl-cell text-right">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost p-1.5 text-ink-400 hover:text-ember" onClick={() => { setEditingId(exp.id); setForm({ ...exp }); setShowForm(true) }}><Edit2 size={14} /></button>
                    <button className="btn-ghost p-1.5 text-red-500" onClick={() => handleDelete(exp.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
