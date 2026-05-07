import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Plus, Receipt, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ExpensesPage() {
  const { branchId, user } = useAuthStore()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: 'Supplies', amount: '', description: '' })
  const categories = ['Rent', 'Utilities', 'Supplies', 'Salaries', 'Maintenance', 'Misc']

  useEffect(() => { fetchExpenses() }, [branchId])

  async function fetchExpenses() {
    let q = supabase.from('expenses').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false })
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setExpenses(data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const { error } = await supabase.from('expenses').insert({
      branch_id: branchId || 'gurukul', // fallback if super admin didn't select branch
      category: form.category,
      amount: parseFloat(form.amount),
      description: form.description,
      logged_by: user.id
    })
    if (error) return toast.error(error.message)
    toast.success('Expense logged')
    setShowForm(false)
    setForm({ category: 'Supplies', amount: '', description: '' })
    fetchExpenses()
  }

  async function handleDelete(id) {
    if (!confirm('Delete expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) toast.error(error.message)
    else fetchExpenses()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-dash-text dark:text-dash-textDark">Expenses</h1>
        <button className="btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Log Expense
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 flex flex-col md:flex-row gap-4 items-end bg-dash-bg dark:bg-zinc-900 border-dash-border dark:border-dash-borderDark">
          <div className="flex-1 w-full">
            <span className="label">Category</span>
            <select className="input" value={form.category} onChange={e=>setForm({...form, category: e.target.value})}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 w-full">
            <span className="label">Amount (₹)</span>
            <input required type="number" step="0.01" className="input" value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})} placeholder="0.00" />
          </div>
          <div className="flex-2 w-full md:w-64">
            <span className="label">Description</span>
            <input type="text" className="input" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} placeholder="Optional note" />
          </div>
          <button type="submit" className="btn-primary w-full md:w-auto h-[42px]">Save</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="tbl-head">Date</th>
              <th className="tbl-head">Category</th>
              <th className="tbl-head">Description</th>
              <th className="tbl-head text-right">Amount</th>
              <th className="tbl-head text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="5" className="tbl-cell text-center">Loading...</td></tr> : 
             expenses.length === 0 ? <tr><td colSpan="5" className="tbl-cell text-center text-dash-muted">No expenses found</td></tr> :
             expenses.map(exp => (
               <tr key={exp.id} className="tbl-row">
                 <td className="tbl-cell font-medium">{new Date(exp.expense_date).toLocaleDateString()}</td>
                 <td className="tbl-cell"><span className="badge-default">{exp.category}</span></td>
                 <td className="tbl-cell text-dash-muted">{exp.description || '-'}</td>
                 <td className="tbl-cell text-right text-red-600 font-bold">₹{exp.amount.toLocaleString()}</td>
                 <td className="tbl-cell text-right">
                   <button className="btn-ghost p-1 text-red-500" onClick={() => handleDelete(exp.id)}><Trash2 size={14} /></button>
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
