import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Search, AlertTriangle, ToggleLeft, ToggleRight, Edit2, Check, X, Trash2, Archive, RefreshCw, LayoutGrid, Download, Upload } from 'lucide-react'
import { BRANCH_CATEGORY_MAP, CATEGORY_ICONS, CATEGORY_SUBCATEGORIES } from '../lib/branchConfig'
import MenuPage from './MenuPage'

const UNITS = ['piece','gram','ml','kg','litre','pack','session']

export default function InventoryPage() {
  const { branchId, role } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [mainTab, setMainTab] = useState(searchParams.get('tab') || 'Active') // Active, Archived, Disposables, menu
  const [lowStockFilter, setLowStockFilter] = useState(searchParams.get('filter') === 'low_stock')
  const [zeroStockFilter, setZeroStockFilter] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', subcategory: '', variant: '', unit: 'piece', price: '', cost_price: '', stock_quantity: 0, low_stock_threshold: 5, is_active: true, branch_id: branchId || 'gurukul' })
  const [saving, setSaving] = useState(false)

  // Inline Editing
  const [editingRow, setEditingRow] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Ingredient Linking (Recipe System)
  const [editingIngredients, setEditingIngredients] = useState(null) // item.id being edited
  const [itemIngredients, setItemIngredients] = useState({}) // { [item_id]: [{ingredient_item_id, quantity_per_unit, id}] }
  const [newIngredientRow, setNewIngredientRow] = useState({ ingredient_item_id: '', quantity_per_unit: 1 })

  // Quick Stock Editing
  const [editingStockId, setEditingStockId] = useState(null)
  const [editingStockVal, setEditingStockVal] = useState('')

  // Bulk Stock Edit
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkStocks, setBulkStocks] = useState({})

  const [dbCategories, setDbCategories] = useState([])
  const [showCatForm, setShowCatForm] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  const activeBranch = branchId || 'gurukul'
  const branchCats = Array.from(new Set([
    ...(BRANCH_CATEGORY_MAP[activeBranch] || Object.values(BRANCH_CATEGORY_MAP).flat()),
    ...dbCategories.map(c => c.name)
  ]))
  
  const getSubcategories = (cat) => {
    const conf = CATEGORY_SUBCATEGORIES[cat]
    if (conf && conf.length) return conf
    const dbSubs = dbCategories.find(c => c.name === cat)?.subcategories
    return (Array.isArray(dbSubs) && dbSubs.length) ? dbSubs : ['General']
  }

  const isManager = role === 'manager'
  const isAdmin = role === 'admin' || role === 'super_admin'
  const canDefineItems = isAdmin || role === 'super_admin' // Only admins can create/delete/archive
  const canManageStock = true // Managers and Admins can update stock quantities

  async function fetchItems() {
    let q = supabase.from('items').select('*').order('category').order('name')
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setItems(data || [])
    setLoading(false)
  }

  async function fetchCategories() {
    let q = supabase.from('categories').select('*')
    if (branchId && branchId !== 'All Branches') {
      q = q.or(`branch_id.eq.${branchId},is_global.eq.true`)
    }
    const { data } = await q
    if (data) setDbCategories(data)
  }

  useEffect(() => { 
    fetchItems() 
    fetchCategories()
    
    // Realtime Sync
    const chan = supabase.channel('items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: branchId ? `branch_id=eq.${branchId}` : undefined }, () => {
        // Debounce or just refetch
        fetchItems()
      })
      .subscribe()
    return () => supabase.removeChannel(chan)
  }, [branchId])

  // --- Add Form ---
  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name || !form.category || !form.subcategory) { toast.error('Fill required fields'); return }
    setSaving(true)
    try {
      await supabase.from('items').insert({
        name: form.name, 
        category: form.category, 
        subcategory: form.subcategory,
        variant: form.variant || null,
        unit: form.unit,
        price: form.price ? parseFloat(form.price) : 0, 
        cost_price: form.cost_price ? parseFloat(form.cost_price) : 0,
        stock_quantity: parseInt(form.stock_quantity) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
        branch_id: form.branch_id, 
        is_active: form.is_active,
        is_archived: false
      })
      toast.success('Item added')
      setForm({ name: '', category: '', subcategory: '', variant: '', unit: 'piece', price: '', cost_price: '', stock_quantity: 0, low_stock_threshold: 5, is_active: true, branch_id: branchId || 'gurukul' })
      setShowForm(false)
      fetchItems()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // --- Quick Stock Edit ---
  async function commitStock(id) {
    const n = parseInt(editingStockVal)
    setEditingStockId(null)
    if (isNaN(n) || n < 0) return
    const item = items.find(i => i.id === id)
    if (item && item.stock_quantity === n) return // no change
    
    // Optimistic update
    const prevItems = [...items]
    setItems(p => p.map(i => i.id === id ? { ...i, stock_quantity: n } : i))
    
    const { error } = await supabase.from('items').update({ stock_quantity: n }).eq('id', id)
    if (error) {
      console.error('Stock update failed:', error)
      toast.error('Stock update failed')
      setItems(prevItems) // revert
    } else {
      toast.success('Stock updated instantly')
    }
  }

  // --- Bulk Stock Edit ---
  function toggleBulkMode() {
    if (bulkMode) {
      setBulkMode(false)
      setBulkStocks({})
    } else {
      setBulkMode(true)
      const st = {}
      items.forEach(i => st[i.id] = String(i.stock_quantity))
      setBulkStocks(st)
    }
  }

  async function saveBulkStocks() {
    setSaving(true)
    let changedCount = 0
    const updates = []
    for (const item of items) {
      const newV = parseInt(bulkStocks[item.id])
      if (!isNaN(newV) && newV !== item.stock_quantity) {
        updates.push(supabase.from('items').update({ stock_quantity: newV }).eq('id', item.id))
        changedCount++
      }
    }
    if (changedCount > 0) {
      await Promise.all(updates)
      toast.success(`${changedCount} items updated`)
      fetchItems()
    } else {
      toast('No changes to save')
    }
    setBulkMode(false)
    setSaving(false)
  }

  // --- Inline Row Edit ---
  function startEdit(item) {
    setEditingRow(item.id)
    setEditForm({ ...item })
    // Fetch ingredients for this item
    fetchItemIngredients(item.id)
  }
  async function fetchItemIngredients(itemId) {
    const { data } = await supabase.from('item_ingredients')
      .select('*')
      .eq('item_id', itemId)
    const mapped = (data || []).map(d => ({
      ...d,
      ingredient_item: items.find(i => i.id === d.ingredient_item_id) || { name: 'Unknown' }
    }))
    setItemIngredients(prev => ({ ...prev, [itemId]: mapped }))
  }
  async function saveInlineEdit() {
    if (!editForm.name || !editForm.category) return
    const { id, branch_id, ...updates } = editForm
    await supabase.from('items').update(updates).eq('id', id)
    setItems(p => p.map(i => i.id === id ? { ...i, ...updates } : i))
    setEditingRow(null)
    toast.success('Saved')
  }

  async function addIngredient(itemId) {
    if (!newIngredientRow.ingredient_item_id) return toast.error('Select an ingredient')
    if (!newIngredientRow.quantity_per_unit || newIngredientRow.quantity_per_unit <= 0) return toast.error('Enter valid quantity')
    const { data, error } = await supabase.from('item_ingredients').insert({
      item_id: itemId,
      ingredient_item_id: newIngredientRow.ingredient_item_id,
      quantity_per_unit: parseFloat(newIngredientRow.quantity_per_unit),
      branch_id: branchId || 'bhat'
    }).select('*').single()
    if (error) return toast.error(error.message)
    const newLinkedIng = {
      ...data,
      ingredient_item: items.find(i => i.id === data.ingredient_item_id) || { name: 'Unknown' }
    }
    setItemIngredients(prev => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), newLinkedIng]
    }))
    setNewIngredientRow({ ingredient_item_id: '', search: '', quantity_per_unit: 1 })
    toast.success('Ingredient linked')
  }

  async function removeIngredient(itemId, ingId) {
    await supabase.from('item_ingredients').delete().eq('id', ingId)
    setItemIngredients(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).filter(i => i.id !== ingId)
    }))
    toast.success('Ingredient removed')
  }

  // --- Actions ---
  async function toggleArchive(id, curArchive) {
    await supabase.from('items').update({ is_archived: !curArchive }).eq('id', id)
    setItems(p => p.map(i => i.id === id ? { ...i, is_archived: !curArchive } : i))
    toast.success(curArchive ? 'Restored to Active' : 'Moved to Archive')
  }
  
  async function deleteForever(id, name) {
    const input = prompt(`This will permanently delete ${name} and cannot be undone. Type DELETE to confirm.`)
    if (input === 'DELETE') {
      await supabase.from('items').delete().eq('id', id)
      setItems(p => p.filter(i => i.id !== id))
      toast.success('Deleted permanently')
    }
  }

  // --- Filtering & Computed ---
  const filtered = useMemo(() => {
    return items.filter(i => {
      // Main Tab
      if (mainTab === 'Disposables' && (i.category !== 'Inventory' || i.subcategory !== 'Disposables')) return false
      if (mainTab === 'Active' && (i.is_archived || i.category === 'Inventory')) return false
      if (mainTab === 'Archived' && (!i.is_archived || i.category === 'Inventory')) return false
      
      // Category Filter
      if (filterCat && i.category !== filterCat) return false
      
      // Low/Zero Stock Filter
      if (lowStockFilter && i.stock_quantity > (i.low_stock_threshold || 5)) return false
      if (zeroStockFilter && i.stock_quantity > 0) return false

      // Search
      if (search) {
        const q = search.toLowerCase()
        if (!i.name.toLowerCase().includes(q) && 
            !(i.variant || '').toLowerCase().includes(q) && 
            !(i.subcategory || '').toLowerCase().includes(q) && 
            !(i.category || '').toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [items, mainTab, filterCat, search, lowStockFilter, zeroStockFilter])

  const { lowCount, zeroCount, activeValue } = useMemo(() => {
    let low = 0, zero = 0, val = 0
    items.forEach(i => {
      if (i.category !== 'Inventory' && !i.is_archived) {
        if (i.stock_quantity <= 0) zero++
        else if (i.stock_quantity <= (i.low_stock_threshold || 5)) low++
        
        if (i.price > 0 && i.stock_quantity > 0) val += (i.price * i.stock_quantity)
      }
    })
    return { lowCount: low, zeroCount: zero, activeValue: val }
  }, [items])

  const handleExportCSV = () => {
    const csvRows = ['id,name,variant,category,subcategory,stock_quantity'];
    const exportData = mainTab === 'archived' ? items.filter(i => i.is_archived) : items.filter(i => !i.is_archived);
    
    exportData.forEach(i => {
      const row = [
        i.id,
        `"${i.name.replace(/"/g, '""')}"`,
        `"${(i.variant || '').replace(/"/g, '""')}"`,
        `"${i.category}"`,
        `"${i.subcategory || ''}"`,
        i.stock_quantity
      ];
      csvRows.push(row.join(','));
    });
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) return toast.error('CSV is empty or invalid format');
      
      const headers = lines[0].toLowerCase().split(',');
      const idIdx = headers.findIndex(h => h.includes('id'));
      const stockIdx = headers.findIndex(h => h.includes('stock_quantity'));
      
      if (idIdx === -1 || stockIdx === -1) {
        return toast.error('CSV must contain "id" and "stock_quantity" columns');
      }

      const updates = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // simple quote-aware split
        const row = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        
        const id = row[idIdx]?.replace(/^"|"$/g, '').trim();
        const stockStr = row[stockIdx]?.replace(/^"|"$/g, '').trim();
        
        if (!id || id.includes('leave_blank') || id === 'id') continue;
        
        const stock = parseInt(stockStr, 10);
        if (!isNaN(stock) && id.length > 10) {
          updates.push({ id, stock_quantity: stock });
        }
      }

      if (updates.length === 0) return toast.error('No valid rows found to update');
      
      setLoading(true);
      let successCount = 0;
      
      const chunkSize = 10;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        await Promise.all(chunk.map(u => 
          supabase.from('items').update({ stock_quantity: u.stock_quantity }).eq('id', u.id)
        ));
        successCount += chunk.length;
      }
      
      toast.success(`Successfully updated stock for ${successCount} items`);
      setLoading(false);
      fetchInventory();
      e.target.value = null;
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl space-y-4 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Inventory</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm mt-1">
            <span className="text-zinc-500">{items.filter(i=>!i.is_archived && i.category !== 'Inventory').length} active</span>
            {isAdmin && <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">₹{activeValue.toLocaleString('en-IN')} Value</span>}
            
            {(lowCount > 0 || lowStockFilter) && (
              <button onClick={() => setLowStockFilter(!lowStockFilter)} className={`font-semibold px-2 py-0.5 rounded border transition-colors ${lowStockFilter ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700' : 'text-amber-600 border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100'}`}>
                {lowCount} Low Stock
              </button>
            )}
            {(zeroCount > 0 || zeroStockFilter) && (
              <button onClick={() => setZeroStockFilter(!zeroStockFilter)} className={`font-semibold px-2 py-0.5 rounded border transition-colors ${zeroStockFilter ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700' : 'text-red-600 border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950 hover:bg-red-100'}`}>
                {zeroCount} Zero Stock
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {canManageStock && (
            <button onClick={toggleBulkMode} className={`btn-secondary flex-1 sm:flex-none ${bulkMode ? 'bg-emerald-500 text-white border-emerald-500' : ''}`}>
              <Edit2 size={16} /> {bulkMode ? 'Exit Bulk Edit' : 'Bulk Update Stock'}
            </button>
          )}
          <button onClick={handleExportCSV} className="btn-secondary flex-1 sm:flex-none">
            <Download size={16} /> Export
          </button>
          {canManageStock && (
            <label className="btn-secondary flex-1 sm:flex-none cursor-pointer">
              <Upload size={16} /> Import
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          )}
          {canDefineItems && (
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <button onClick={() => { setShowForm(!showForm); setForm(p => ({ ...p, category: 'Paan' })) }} className="btn-primary flex-1 sm:flex-none">
                <Plus size={16} /> Add Item
              </button>
              <button onClick={() => { setShowForm(!showForm); setForm(p => ({ ...p, category: 'Inventory', subcategory: 'Disposables', price: 0 })) }} className="btn-secondary flex-1 sm:flex-none whitespace-nowrap">
                <Plus size={16} /> Add Disposable
              </button>
              <button onClick={() => setShowCatForm(!showCatForm)} className="btn-secondary flex-1 sm:flex-none whitespace-nowrap">
                <LayoutGrid size={16} /> Add Category
              </button>
            </div>
          )}
        </div>
      </div>

      {showCatForm && (
        <div className="card p-5 animate-slide-up border-2 border-amber-500/20 shadow-xl bg-amber-50/10 dark:bg-amber-900/10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-zinc-900 dark:text-white text-lg flex items-center gap-2"><LayoutGrid className="text-amber-500"/> New Category</h2>
            <button onClick={() => setShowCatForm(false)} className="text-zinc-400 hover:text-red-500"><X size={20}/></button>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault()
            if(!newCatName.trim()) return
            const { error } = await supabase.from('categories').insert({
              name: newCatName.trim(),
              branch_id: branchId === 'All Branches' ? null : branchId,
              is_global: branchId === 'All Branches'
            })
            if(error) return toast.error(error.message)
            toast.success('Category Added')
            setNewCatName('')
            setShowCatForm(false)
            fetchCategories()
          }} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="label">Category Name *</label>
              <input className="input w-full" value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="e.g. Raw Materials" required autoFocus/>
            </div>
            <button type="submit" className="btn-primary">Save Category</button>
          </form>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6 overflow-x-auto no-scrollbar">
        {['Active', 'Archived', 'Disposables', 'BB Cafe Menu'].map(tab => {
          // 'menu' param maps to 'BB Cafe Menu' tab
          const isActive = mainTab === tab || (tab === 'BB Cafe Menu' && mainTab === 'menu');
          return (
            <button key={tab} onClick={() => setMainTab(tab === 'BB Cafe Menu' ? 'menu' : tab)}
              className={`pb-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${isActive ? 'border-ember text-ember' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}>
              {tab}
            </button>
          )
        })}
      </div>

      {mainTab === 'menu' && (
        <div className="mt-6">
          <MenuPage isEmbedded={true} />
        </div>
      )}

      {mainTab !== 'menu' && showForm && canDefineItems && (
        <div className="card p-5 animate-slide-up border-2 border-ember/20 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-zinc-900 dark:text-white text-lg">New {form.category === 'Inventory' ? 'Disposable' : 'Item'}</h2>
            <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-red-500"><X size={20}/></button>
          </div>
          <form onSubmit={handleAdd}>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
              <div className="col-span-2">
                <label className="label">Name *</label>
                <input className="input w-full" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Item name" autoFocus required />
              </div>
              <div>
                <label className="label">Variant</label>
                <input className="input w-full" value={form.variant} onChange={e => setForm(p => ({ ...p, variant: e.target.value }))} placeholder="e.g. Regular" />
              </div>
              
              <div>
                <label className="label">Category *</label>
                <select className="input w-full" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value, subcategory: getSubcategories(e.target.value)[0] }))} required>
                  <option value="">Select…</option>
                  {Array.from(new Set([...branchCats, 'Inventory'])).map(c => (
                    <option key={c} value={c}>{(CATEGORY_ICONS[c] || dbCategories.find(d=>d.name===c)?.icon || '📁')} {c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Subcategory *</label>
                <select className="input w-full" value={form.subcategory} onChange={e => setForm(p => ({ ...p, subcategory: e.target.value }))} required>
                  <option value="">Select…</option>
                  {getSubcategories(form.category).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {form.category !== 'Inventory' && (
                <div>
                  <label className="label">Selling Price (₹) *</label>
                  <input className="input w-full font-bold text-emerald-600" type="number" min="0" step="0.5" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0" required />
                </div>
              )}

              {isAdmin && (
                <div>
                  <label className="label">Cost Price (₹)</label>
                  <input className="input w-full" type="number" min="0" step="0.5" value={form.cost_price} onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))} placeholder="0" />
                </div>
              )}
              
              <div>
                <label className="label">Opening Stock</label>
                <input className="input w-full font-bold" type="number" min="0" value={form.stock_quantity} onChange={e => setForm(p => ({ ...p, stock_quantity: e.target.value }))} />
              </div>
              <div>
                <label className="label">Low Stock Alert At</label>
                <input className="input w-full" type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm(p => ({ ...p, low_stock_threshold: e.target.value }))} />
              </div>
              <div>
                <label className="label">Unit *</label>
                <select className="input w-full" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" className="w-4 h-4 rounded text-ember focus:ring-ember" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Active Listing</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save New Item'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input className="input pl-9 text-sm" placeholder="Search name, variant, or subcategory…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {mainTab === 'Active' && (
          <div className="flex gap-1.5 flex-wrap">
            {['', ...branchCats].map(cat => (
              <button key={cat}
                className={`btn-sm rounded-lg border text-xs font-semibold transition-all ${filterCat === cat ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white' : 'btn-secondary'}`}
                onClick={() => setFilterCat(cat)}>
                {cat ? `${CATEGORY_ICONS[cat] || dbCategories.find(d=>d.name===cat)?.icon || '📁'} ${cat}` : 'All Categories'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="tbl-head w-10">Sync</th>
                <th className="tbl-head w-64">Item & Variant</th>
                <th className="tbl-head">Category & Sub</th>
                <th className="tbl-head w-20 text-center">Stock</th>
                {mainTab !== 'Disposables' && <th className="tbl-head text-right w-24">MRP (₹)</th>}
                {isAdmin && <th className="tbl-head text-right w-24">Value (₹)</th>}
                <th className="tbl-head text-center w-24">Status</th>
                {canDefineItems && <th className="tbl-head text-right w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {loading ? Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={8} className="p-4"><div className="skeleton h-8 w-full" /></td></tr>)
                : filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-sm text-zinc-400">No items match your filters</td></tr>
                : filtered.map(item => {
                  const isLow = item.stock_quantity <= (item.low_stock_threshold || 5) && item.stock_quantity > 0
                  const isZero = item.stock_quantity <= 0
                  const isEditing = editingRow === item.id
                  const onBilling = item.is_active && item.price > 0 && item.subcategory && !item.is_archived && item.category !== 'Inventory'

                  if (isEditing) return (
                    <tr key={item.id} className="bg-blue-50/50 dark:bg-blue-900/10">
                      <td colSpan={8} className="p-3">
                        <div className="flex flex-wrap gap-3 items-end">
                          <div className="flex-1 min-w-[200px]">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Name & Variant</label>
                            <div className="flex gap-2">
                              <input className="input flex-1 text-sm py-1.5" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} placeholder="Name"/>
                              <input className="input w-24 text-sm py-1.5" value={editForm.variant || ''} onChange={e=>setEditForm({...editForm, variant:e.target.value})} placeholder="Var"/>
                            </div>
                          </div>
                          <div className="flex-1 min-w-[200px]">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Cat & Sub</label>
                            <div className="flex gap-2">
                              <select className="input flex-1 text-sm py-1.5" value={editForm.category} onChange={e=>setEditForm({...editForm, category:e.target.value, subcategory:getSubcategories(e.target.value)[0]})}>
                                {mainTab === 'Disposables' ? <option value="Inventory">Inventory</option> : branchCats.map(c=><option key={c}>{c}</option>)}
                              </select>
                              <select className="input flex-1 text-sm py-1.5" value={editForm.subcategory || ''} onChange={e=>setEditForm({...editForm, subcategory:e.target.value})}>
                                {getSubcategories(editForm.category).map(s=><option key={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="w-24">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Price</label>
                            <input type="number" className="input w-full text-sm py-1.5" value={editForm.price} onChange={e=>setEditForm({...editForm, price:e.target.value})}/>
                          </div>
                          {isAdmin && (
                            <div className="w-24">
                              <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Cost P</label>
                              <input type="number" className="input w-full text-sm py-1.5" value={editForm.cost_price || ''} onChange={e=>setEditForm({...editForm, cost_price:e.target.value})}/>
                            </div>
                          )}
                          <div className="flex gap-2 justify-end ml-auto">
                            <button onClick={saveInlineEdit} className="p-2 bg-emerald-500 text-white rounded shadow hover:bg-emerald-600"><Check size={16}/></button>
                            <button onClick={()=>setEditingRow(null)} className="p-2 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600"><X size={16}/></button>
                          </div>
                        </div>
                        {isAdmin && editForm.category !== 'Inventory' && (
                          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-[10px] uppercase font-bold text-zinc-500">Recipe Ingredients (deducted per sale)</span>
                              <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">AUTO-DEDUCT</span>
                            </div>
                            <div className="space-y-1 mb-3">
                              {(itemIngredients[item.id] || []).map(ing => (
                                <div key={ing.id} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                                  <span className="flex-1 text-xs font-semibold">{ing.ingredient_item?.name || '?'}</span>
                                  <span className="text-xs text-zinc-500">{ing.quantity_per_unit} unit(s)</span>
                                  <button onClick={() => removeIngredient(item.id, ing.id)} className="text-red-400 hover:text-red-600"><X size={12}/></button>
                                </div>
                              ))}
                              {(itemIngredients[item.id] || []).length === 0 && (
                                <p className="text-[10px] text-zinc-400 italic">No ingredients linked — stock deduction disabled for this item</p>
                              )}
                            </div>
                            <div className="flex gap-2 items-center">
                              <input 
                                list={`ingredient-options-${item.id}`} 
                                className="input text-xs flex-1" 
                                placeholder="Search & link any item…"
                                value={newIngredientRow.search ?? ''}
                                onChange={e => {
                                  const val = e.target.value
                                  setNewIngredientRow(p => ({...p, search: val}))
                                  const selected = items.find(i => `[${i.category}] ${i.name} ${i.variant ? `(${i.variant})` : ''}`.trim() === val.trim())
                                  setNewIngredientRow(p => ({...p, ingredient_item_id: selected ? selected.id : ''}))
                                }}
                              />
                              <datalist id={`ingredient-options-${item.id}`}>
                                {items.filter(i => i.id !== item.id).map(i => (
                                  <option key={i.id} value={`[${i.category}] ${i.name} ${i.variant ? `(${i.variant})` : ''}`.trim()} />
                                ))}
                              </datalist>
                              <input type="number" min="0" step="0.01" className="input text-xs w-20" value={newIngredientRow.quantity_per_unit}
                                onChange={e => setNewIngredientRow(p => ({...p, quantity_per_unit: e.target.value}))} placeholder="Qty" />
                              <button onClick={() => addIngredient(item.id)} className="px-3 py-1.5 text-xs font-bold bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">Link</button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )

                  return (
                    <tr key={item.id} className={`tbl-row group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${!item.is_active ? 'opacity-50' : ''} ${isZero ? 'border-l-2 border-l-red-500' : isLow ? 'border-l-2 border-l-amber-400' : 'border-l-2 border-l-transparent'}`}>
                      <td className="tbl-cell text-center">
                        <div title={onBilling ? 'Live on Billing POS' : 'Hidden from POS'} className={`w-2.5 h-2.5 rounded-full mx-auto ${onBilling ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                      </td>
                      <td className="tbl-cell">
                        <div className="font-bold text-zinc-900 dark:text-white leading-tight">{item.name}</div>
                        {item.variant && <div className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded inline-block mt-0.5">{item.variant}</div>}
                        {!item.is_active && <span className="text-[10px] text-red-500 font-bold ml-2">INACTIVE</span>}
                      </td>
                      <td className="tbl-cell">
                        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{CATEGORY_ICONS[item.category]} {item.category}</div>
                        <div className="text-[10px] uppercase tracking-wider mt-0.5">
                          {item.subcategory ? <span className="text-zinc-500">{item.subcategory}</span> : (
                            <button onClick={() => startEdit(item)} className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold border border-amber-200 dark:border-amber-800 hover:bg-amber-200 transition-colors">Assign Subcategory</button>
                          )}
                        </div>
                      </td>
                      <td className="tbl-cell text-center">
                        {bulkMode ? (
                          <input type="number" className="w-16 text-center border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 rounded font-black text-emerald-700 dark:text-emerald-400 py-1"
                            value={bulkStocks[item.id] || ''} onChange={e => setBulkStocks(p=>({...p, [item.id]: e.target.value}))} />
                        ) : editingStockId === item.id ? (
                          <input type="number" className="w-16 text-center border-2 border-ember bg-white dark:bg-zinc-900 rounded font-black text-ember py-1"
                            value={editingStockVal} onChange={e => setEditingStockVal(e.target.value)} 
                            onBlur={() => commitStock(item.id)} onKeyDown={e => e.key === 'Enter' && commitStock(item.id)} autoFocus />
                        ) : (
                          <button onClick={() => { setEditingStockId(item.id); setEditingStockVal(String(item.stock_quantity)) }} 
                            className={`w-full py-1 font-black text-base transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded
                            ${isZero ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-zinc-800 dark:text-zinc-200'}`}>
                            {item.stock_quantity}
                          </button>
                        )}
                      </td>
                      {mainTab !== 'Disposables' && (
                        <td className="tbl-cell text-right font-black text-zinc-900 dark:text-white">
                          {item.price > 0 ? `₹${item.price}` : <span className="text-red-400 text-xs uppercase">No Price</span>}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="tbl-cell text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {item.price > 0 && item.stock_quantity > 0 ? `₹${(item.price * item.stock_quantity).toLocaleString('en-IN')}` : '-'}
                        </td>
                      )}
                      <td className="tbl-cell text-center">
                        {canDefineItems ? (
                          <button onClick={() => {
                              supabase.from('items').update({ is_active: !item.is_active }).eq('id', item.id)
                              setItems(p=>p.map(i=>i.id===item.id?{...i, is_active:!item.is_active}:i))
                            }}
                            className={`inline-flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-70 ${item.is_active ? 'text-emerald-500' : 'text-zinc-400'}`}>
                            {item.is_active ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
                          </button>
                        ) : (
                          <span className={item.is_active ? 'badge-success' : 'badge-default'}>{item.is_active ? 'Active' : 'Inactive'}</span>
                        )}
                      </td>
                      {canDefineItems && (
                        <td className="tbl-cell text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={()=>startEdit(item)} className="p-2 md:p-1.5 text-zinc-400 hover:text-ember hover:bg-ember/10 rounded-lg transition-colors" title="Edit row"><Edit2 size={18}/></button>
                            {mainTab === 'Archived' ? (
                              <>
                                <button onClick={()=>toggleArchive(item.id, true)} className="p-2 md:p-1.5 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="Restore"><RefreshCw size={18}/></button>
                                {isAdmin && <button onClick={()=>deleteForever(item.id, item.name)} className="p-2 md:p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete Forever"><Trash2 size={18}/></button>}
                              </>
                            ) : (
                              <button onClick={()=>toggleArchive(item.id, false)} className="p-2 md:p-1.5 text-zinc-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Archive"><Archive size={18}/></button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Save Bar */}
      {bulkMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-slide-up">
          <div>
            <div className="text-sm font-bold">Bulk Update Mode Active</div>
            <div className="text-xs text-zinc-400">Click a cell and type to change stock.</div>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleBulkMode} className="px-4 py-2 text-sm font-bold bg-zinc-800 hover:bg-zinc-700 rounded-lg">Cancel</button>
            <button onClick={saveBulkStocks} disabled={saving} className="px-4 py-2 text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-lg shadow-emerald-500/20">{saving ? 'Saving...' : 'Save All Changes'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
