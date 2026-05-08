import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, X, Check, ToggleLeft, ToggleRight, Coffee, Search } from 'lucide-react'

const CAFE_SUBCATS = ['Hot Beverages', 'Cold Beverages', 'Food', 'Combos']

const SUBCAT_ICONS = {
  'Hot Beverages':  '☕',
  'Cold Beverages': '🧋',
  'Food':           '🍽️',
  'Combos':         '🎁',
}

const EMPTY_FORM = {
  name: '', variant: '', subcategory: 'Hot Beverages',
  price: '', cost_price: '', stock_quantity: 0,
  low_stock_threshold: 5, is_active: true,
}

export default function MenuPage() {
  const { branchId, role } = useAuthStore()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Hot Beverages')
  const [search, setSearch] = useState('')

  // Modal state
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  const isAdmin = role === 'admin' || role === 'super_admin'
  const isManager = role === 'manager'
  const canEdit = isAdmin || isManager

  // BB Cafe is Bhat-only
  const BRANCH = 'bhat'

  useEffect(() => {
    fetchItems()
    const chan = supabase.channel('menu_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `branch_id=eq.${BRANCH}` }, fetchItems)
      .subscribe()
    return () => supabase.removeChannel(chan)
  }, [])

  async function fetchItems() {
    const { data } = await supabase.from('items').select('*')
      .eq('branch_id', BRANCH)
      .eq('category', 'BB Cafe')
      .eq('is_archived', false)
      .order('subcategory').order('name')
    setItems(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, subcategory: activeTab })
    setEditId(null)
    setModal('add')
  }

  function openEdit(item) {
    setForm({
      name: item.name || '',
      variant: item.variant || '',
      subcategory: item.subcategory || 'Hot Beverages',
      price: item.price || '',
      cost_price: item.cost_price || '',
      stock_quantity: item.stock_quantity || 0,
      low_stock_threshold: item.low_stock_threshold || 5,
      is_active: item.is_active ?? true,
    })
    setEditId(item.id)
    setModal('edit')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name || !form.price) return toast.error('Name and Price are required')
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      variant: form.variant.trim() || null,
      category: 'BB Cafe',
      subcategory: form.subcategory,
      price: parseFloat(form.price) || 0,
      cost_price: parseFloat(form.cost_price) || 0,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
      is_active: form.is_active,
      is_archived: false,
      branch_id: BRANCH,
      unit: 'piece',
    }

    let error
    if (modal === 'add') {
      ;({ error } = await supabase.from('items').insert(payload))
    } else {
      ;({ error } = await supabase.from('items').update(payload).eq('id', editId))
    }

    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(modal === 'add' ? 'Item added to menu' : 'Item updated')
    setModal(null)
    fetchItems()
  }

  async function toggleActive(item) {
    const { error } = await supabase.from('items').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) toast.error(error.message)
    else setItems(p => p.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
  }

  async function deleteItem(item) {
    if (!confirm(`Delete "${item.name}" from the menu? This cannot be undone.`)) return
    const { error } = await supabase.from('items').delete().eq('id', item.id)
    if (error) toast.error(error.message)
    else { toast.success('Item removed'); fetchItems() }
  }

  const displayItems = items
    .filter(i => i.subcategory === activeTab)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.variant || '').toLowerCase().includes(search.toLowerCase()))

  const counts = CAFE_SUBCATS.reduce((acc, s) => {
    acc[s] = items.filter(i => i.subcategory === s).length
    return acc
  }, {})

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Coffee size={20} className="text-amber-500" />
            <h1 className="text-2xl font-bold text-dash-text dark:text-dash-textDark">BB Cafe Menu</h1>
            <span className="badge-default text-[10px] uppercase tracking-widest">Bhat</span>
          </div>
          <p className="text-sm text-dash-muted">{items.filter(i => i.is_active).length} active · {items.length} total items</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dash-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu…" className="input pl-8 w-44 text-sm" />
          </div>
          {canEdit && (
            <button onClick={openAdd} className="btn-primary">
              <Plus size={16} /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 border-b border-dash-border dark:border-dash-borderDark">
        {CAFE_SUBCATS.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === cat
                ? 'border-dash-primary text-dash-primary dark:text-white dark:border-white'
                : 'border-transparent text-dash-muted hover:text-dash-text dark:hover:text-dash-textDark'
            }`}
          >
            <span>{SUBCAT_ICONS[cat]}</span>
            <span className="hidden sm:inline">{cat}</span>
            <span className="text-xs font-bold opacity-60">{counts[cat] || 0}</span>
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-36 animate-pulse bg-zinc-100 dark:bg-zinc-800" />)}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-4xl mb-4">{SUBCAT_ICONS[activeTab]}</div>
          <h2 className="text-lg font-bold text-dash-text dark:text-dash-textDark mb-2">No items in {activeTab}</h2>
          <p className="text-dash-muted text-sm mb-6">{search ? 'No results found.' : 'Start by adding your first menu item.'}</p>
          {canEdit && !search && <button onClick={openAdd} className="btn-primary mx-auto">Add First Item</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayItems.map(item => (
            <div
              key={item.id}
              className={`card p-4 flex flex-col gap-3 transition-all border-2 ${
                item.is_active ? 'border-transparent' : 'border-red-200 dark:border-red-900/30 opacity-60'
              }`}
            >
              {/* Icon + Name */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-dash-text dark:text-dash-textDark leading-tight">{item.name}</div>
                  {item.variant && (
                    <div className="text-xs text-dash-muted mt-0.5 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded inline-block">{item.variant}</div>
                  )}
                </div>
                {!item.is_active && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded flex-shrink-0">Hidden</span>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black text-dash-text dark:text-dash-textDark">₹{item.price}</span>
                {isAdmin && item.cost_price > 0 && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Cost ₹{item.cost_price}</span>
                )}
              </div>

              {/* Stock */}
              <div className="flex items-center gap-2 text-xs text-dash-muted">
                <div className={`w-2 h-2 rounded-full ${item.stock_quantity === 0 ? 'bg-red-500' : item.stock_quantity <= item.low_stock_threshold ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                {item.stock_quantity === 0 ? (
                  <span className="text-red-500 font-semibold">Out of Stock</span>
                ) : (
                  <span>{item.stock_quantity} in stock</span>
                )}
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex gap-2 pt-1 mt-auto border-t border-dash-border dark:border-dash-borderDark">
                  <button
                    onClick={() => toggleActive(item)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded-lg transition-colors ${
                      item.is_active
                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                        : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title={item.is_active ? 'Hide from menu' : 'Show on menu'}
                  >
                    {item.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                    {item.is_active ? 'Active' : 'Hidden'}
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    className="flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded-lg text-dash-muted hover:text-dash-text dark:hover:text-dash-textDark hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ml-auto"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => deleteItem(item)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-dash-text dark:text-dash-textDark">
                {modal === 'add' ? '+ Add Menu Item' : 'Edit Menu Item'}
              </h2>
              <button onClick={() => setModal(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Item Name *</label>
                <input className="input w-full" placeholder="e.g. Masala Chai" required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
              </div>

              <div>
                <label className="label">Variant <span className="text-zinc-400">(optional)</span></label>
                <input className="input w-full" placeholder="e.g. Large, Extra Shot" value={form.variant} onChange={e => setForm(p => ({...p, variant: e.target.value}))} />
              </div>

              <div>
                <label className="label">Category</label>
                <select className="input w-full" value={form.subcategory} onChange={e => setForm(p => ({...p, subcategory: e.target.value}))}>
                  {CAFE_SUBCATS.map(s => <option key={s} value={s}>{SUBCAT_ICONS[s]} {s}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Selling Price (₹) *</label>
                  <input type="number" min="0" step="0.5" className="input w-full" placeholder="0" required value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))} />
                </div>
                {isAdmin && (
                  <div>
                    <label className="label">Cost Price (₹)</label>
                    <input type="number" min="0" step="0.5" className="input w-full" placeholder="0" value={form.cost_price} onChange={e => setForm(p => ({...p, cost_price: e.target.value}))} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Stock Qty</label>
                  <input type="number" min="0" className="input w-full" value={form.stock_quantity} onChange={e => setForm(p => ({...p, stock_quantity: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Low Stock Alert</label>
                  <input type="number" min="0" className="input w-full" value={form.low_stock_threshold} onChange={e => setForm(p => ({...p, low_stock_threshold: e.target.value}))} />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                <div>
                  <div className="text-sm font-semibold text-dash-text dark:text-dash-textDark">Show on Menu</div>
                  <div className="text-xs text-dash-muted">Visible to customers ordering via QR</div>
                </div>
                <button type="button" onClick={() => setForm(p => ({...p, is_active: !p.is_active}))}
                  className={`transition-colors ${form.is_active ? 'text-emerald-500' : 'text-zinc-400'}`}>
                  {form.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : modal === 'add' ? 'Add to Menu' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
