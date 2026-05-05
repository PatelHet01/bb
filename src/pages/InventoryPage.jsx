import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Search, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react'
import { BRANCH_CATEGORY_MAP, CATEGORY_ICONS, BRANCH_LABELS } from '../lib/branchConfig'

const UNITS = ['piece','gram','ml','kg','litre','pack','session']

export default function InventoryPage() {
  const { branchId, role } = useAuthStore()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingStock, setEditingStock] = useState({})
  const [form, setForm] = useState({ name: '', category: '', unit: 'piece', price: '', branch_id: branchId || 'gurukul' })
  const [saving, setSaving] = useState(false)

  // Derive the category list for the active branch
  const activeBranch = branchId || 'gurukul'
  const branchCats = BRANCH_CATEGORY_MAP[activeBranch] || Object.values(BRANCH_CATEGORY_MAP).flat().filter((v,i,a)=>a.indexOf(v)===i)

  const canEdit = role !== 'manager'

  async function fetchItems() {
    let q = supabase.from('items').select('*').order('category').order('name')
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [branchId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name || !form.category || !form.price) { toast.error('Fill required fields'); return }
    setSaving(true)
    try {
      await supabase.from('items').insert({
        name: form.name, category: form.category, unit: form.unit,
        price: parseFloat(form.price), stock: 0,
        branch_id: form.branch_id, is_active: true,
      })
      toast.success('Item added')
      setForm({ name: '', category: '', unit: 'piece', price: '', branch_id: branchId || 'gurukul' })
      setShowForm(false)
      fetchItems()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function commitStock(id, value) {
    const n = parseInt(value)
    if (isNaN(n) || n < 0) return
    await supabase.from('items').update({ stock: n }).eq('id', id)
    setItems(p => p.map(i => i.id === id ? { ...i, stock: n } : i))
    setEditingStock(p => { const n2 = { ...p }; delete n2[id]; return n2 })
    toast.success('Stock updated')
  }

  async function toggleActive(id, cur) {
    await supabase.from('items').update({ is_active: !cur }).eq('id', id)
    setItems(p => p.map(i => i.id === id ? { ...i, is_active: !cur } : i))
  }

  const filtered = items.filter(i =>
    (i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase())) &&
    (!filterCat || i.category === filterCat)
  )
  const lowStockCount = items.filter(i => i.stock <= 5 && i.is_active).length

  return (
    <div className="max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Inventory</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {items.length} items
            {lowStockCount > 0 && <span className="text-red-500 ml-2 font-semibold">· {lowStockCount} low stock</span>}
          </p>
        </div>
        {canEdit && (
          <button className="btn-primary btn-sm" onClick={() => setShowForm(!showForm)} id="btn-add-item">
            <Plus size={14} /> Add Item
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && canEdit && (
        <div className="card p-5 animate-slide-up">
          <h2 className="font-semibold text-zinc-900 dark:text-white text-sm mb-4">New Item</h2>
          <form onSubmit={handleAdd}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="md:col-span-2">
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Item name" id="input-item-name" />
              </div>
              <div>
                <label className="label">Category *</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  <option value="">Select…</option>
                  {(BRANCH_CATEGORY_MAP[form.branch_id] || branchCats).map(c => (
                    <option key={c}>{CATEGORY_ICONS[c]} {c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Unit</label>
                <select className="input" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Price (₹) *</label>
                <input className="input" type="number" min="0" step="0.5" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0" id="input-item-price" />
              </div>
              {!branchId && (
                <div>
                  <label className="label">Branch *</label>
                  <select className="input" value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}>
                    <option value="gurukul">Gurukul</option>
                    <option value="bhat">Bhat</option>
                    <option value="visat">Visat</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Add Item'}</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <span className="text-xs text-zinc-400 self-center ml-2">Stock defaults to 0</span>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input className="input pl-8 text-sm" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} id="input-inventory-search" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['', ...branchCats].map(cat => (
            <button key={cat}
              className={`btn-sm rounded-lg border text-xs font-semibold transition-all
                ${filterCat === cat
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white'
                  : 'btn-secondary'
                }`}
              onClick={() => setFilterCat(cat)}
            >
              {cat ? `${CATEGORY_ICONS[cat] || ''} ${cat}` : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                {['Item','Category','Unit','Price','Stock','Status'].map(h => (
                  <th key={h} className="tbl-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(8).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="skeleton h-4 w-full" /></td></tr>
                ))
                : filtered.length === 0
                  ? <tr><td colSpan={6} className="text-center py-12 text-sm text-zinc-400">No items found</td></tr>
                  : filtered.map(item => (
                    <tr key={item.id} className={`tbl-row ${!item.is_active ? 'opacity-40' : ''}`}>
                      <td className="tbl-cell font-medium text-zinc-900 dark:text-white">{item.name}</td>
                      <td className="tbl-cell">
                        <span className="badge-default">{CATEGORY_ICONS[item.category] || ''} {item.category}</span>
                      </td>
                      <td className="tbl-cell text-zinc-500">{item.unit}</td>
                      <td className="tbl-cell font-semibold tabular-nums">₹{item.price}</td>
                      <td className="tbl-cell">
                        {editingStock[item.id] !== undefined ? (
                          <input type="number" min="0"
                            className="input w-20 py-1 text-center text-xs"
                            value={editingStock[item.id]}
                            onChange={e => setEditingStock(p => ({ ...p, [item.id]: e.target.value }))}
                            onBlur={() => commitStock(item.id, editingStock[item.id])}
                            onKeyDown={e => e.key === 'Enter' && commitStock(item.id, editingStock[item.id])}
                            autoFocus
                          />
                        ) : (
                          <button
                            className={`flex items-center gap-1 font-bold tabular-nums transition-colors hover:text-zinc-900 dark:hover:text-white
                              ${item.stock <= 5 ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-400'}`}
                            onClick={() => setEditingStock(p => ({ ...p, [item.id]: String(item.stock) }))}
                            title="Click to edit"
                          >
                            {item.stock <= 5 && <AlertTriangle size={11} />}
                            {item.stock}
                          </button>
                        )}
                      </td>
                      <td className="tbl-cell">
                        {canEdit ? (
                          <button onClick={() => toggleActive(item.id, item.is_active)}
                            className={`flex items-center gap-1.5 text-xs font-semibold transition-colors
                              ${item.is_active ? 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}>
                            {item.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                            {item.is_active ? 'Active' : 'Inactive'}
                          </button>
                        ) : (
                          <span className={item.is_active ? 'badge-success' : 'badge-default'}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
