import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, Check, X, Tag, Search, Minus } from 'lucide-react'

export default function OffersPage() {
  const { branchId, role } = useAuthStore()
  const [offers, setOffers] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ id: null, name: '', description: '', price: '', is_active: true })
  const [offerItems, setOfferItems] = useState([]) // [{ item_id, quantity, name, variant }]
  
  // Search state for adding items to combo
  const [itemSearch, setItemSearch] = useState('')

  useEffect(() => {
    fetchData()

    const filter = (branchId && branchId !== 'All Branches') ? `branch_id=eq.${branchId}` : undefined
    const chan = supabase.channel('offers_page_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offer_items' }, () => fetchData())
      .subscribe()
    
    return () => supabase.removeChannel(chan)
  }, [branchId])

  async function fetchData() {
    setLoading(true)
    const targetBranch = branchId || 'gurukul'
    
    // Fetch Items for searching
    const { data: dbItems } = await supabase.from('items').select('id, name, variant, price, stock_quantity')
      .eq('branch_id', targetBranch)
      .eq('is_active', true)
      .eq('item_type', 'SELLABLE')
    setItems(dbItems || [])

    // Fetch Offers & Offer Items
    let q = supabase.from('offers').select('*, offer_items(*, items(name, variant))')
    if (branchId && branchId !== 'All Branches') {
      q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }
    const { data: dbOffers } = await q
    setOffers(dbOffers || [])
    
    setLoading(false)
  }

  function handleEdit(o) {
    setForm({ id: o.id, name: o.name, description: o.description || '', price: o.price, is_active: o.is_active })
    setOfferItems((o.offer_items || []).map(oi => ({
      item_id: oi.item_id,
      quantity: oi.quantity,
      name: oi.items?.name,
      variant: oi.items?.variant
    })))
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setForm({ id: null, name: '', description: '', price: '', is_active: true })
    setOfferItems([])
    setItemSearch('')
    setShowForm(false)
  }

  function addOfferItem(item) {
    setOfferItems(prev => {
      const exists = prev.find(p => p.item_id === item.id)
      if (exists) {
        return prev.map(p => p.item_id === item.id ? { ...p, quantity: p.quantity + 1 } : p)
      }
      return [...prev, { item_id: item.id, quantity: 1, name: item.name, variant: item.variant }]
    })
    setItemSearch('') // Clear search after picking
  }

  function updateOfferItemQty(item_id, delta) {
    setOfferItems(prev => prev.map(p => p.item_id === item_id ? { ...p, quantity: p.quantity + delta } : p).filter(p => p.quantity > 0))
  }

  async function saveOffer(e) {
    e.preventDefault()
    if (!form.name || !form.price) return toast.error('Enter name and price')
    if (offerItems.length === 0) return toast.error('Add at least one item to the combo')

    setLoading(true)
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      is_active: form.is_active,
      branch_id: branchId === 'All Branches' ? null : branchId
    }

    try {
      let offerId = form.id
      if (offerId) {
        // Update existing
        await supabase.from('offers').update(payload).eq('id', offerId)
        // Clear old offer items
        await supabase.from('offer_items').delete().eq('offer_id', offerId)
      } else {
        // Create new
        const { data } = await supabase.from('offers').insert(payload).select().single()
        offerId = data.id
      }

      // Insert new offer items
      await supabase.from('offer_items').insert(
        offerItems.map(oi => ({
          offer_id: offerId,
          item_id: oi.item_id,
          quantity: oi.quantity
        }))
      )

      toast.success(form.id ? 'Offer updated!' : 'Offer created!')
      resetForm()
      fetchData()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteOffer(id) {
    if (!window.confirm('Delete this offer?')) return
    await supabase.from('offers').delete().eq('id', id)
    toast.success('Offer deleted')
    fetchData()
  }

  async function toggleActive(o) {
    await supabase.from('offers').update({ is_active: !o.is_active }).eq('id', o.id)
    setOffers(p => p.map(x => x.id === o.id ? { ...x, is_active: !o.is_active } : x))
  }

  const filteredSearchItems = itemSearch.trim() ? items.filter(i => 
    i.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
    (i.variant || '').toLowerCase().includes(itemSearch.toLowerCase())
  ).slice(0, 10) : []

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <Tag className="text-indigo-500" />
            Combos & Offers
          </h1>
          <p className="text-sm font-bold text-zinc-500 mt-1">Manage bundled discounts shown on POS.</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> <span className="hidden sm:inline">Create Combo</span>
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-indigo-500/20 p-6 animate-slide-up">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black">{form.id ? 'Edit Combo Offer' : 'New Combo Offer'}</h2>
            <button onClick={resetForm} className="text-zinc-400 hover:text-red-500"><X size={20}/></button>
          </div>
          
          <form onSubmit={saveOffer} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Offer Name *</label>
                <input className="input w-full" value={form.name} onChange={e=>setForm(p=>({...p, name: e.target.value}))} placeholder="e.g. Burger Combo" required autoFocus/>
              </div>
              <div>
                <label className="label">Combo Price (₹) *</label>
                <input type="number" min="0" step="0.5" className="input w-full font-black text-indigo-600" value={form.price} onChange={e=>setForm(p=>({...p, price: e.target.value}))} placeholder="0" required/>
              </div>
              <div className="md:col-span-2">
                <label className="label">Description (Optional)</label>
                <input className="input w-full" value={form.description} onChange={e=>setForm(p=>({...p, description: e.target.value}))} placeholder="e.g. Buy 1 Burger get 1 Coke Free"/>
              </div>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-800/50">
              <label className="label mb-2 block text-indigo-600 dark:text-indigo-400">Search & Add Items to this Combo *</label>
              
              {/* Custom Search Bar Request */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
                <input 
                  type="text" 
                  className="input w-full pl-10 border-indigo-200 dark:border-indigo-800 focus:ring-indigo-500" 
                  placeholder="Search inventory to add items..." 
                  value={itemSearch} 
                  onChange={(e) => setItemSearch(e.target.value)} 
                />
                {filteredSearchItems.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xl rounded-xl z-50 overflow-hidden">
                    {filteredSearchItems.map(item => (
                      <button 
                        key={item.id} 
                        type="button"
                        onClick={() => addOfferItem(item)}
                        className="w-full text-left px-4 py-2 text-sm font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex justify-between items-center"
                      >
                        <span>{item.name} <span className="text-[10px] text-zinc-500 normal-case">{item.variant}</span></span>
                        <span className="text-emerald-600">₹{item.price}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Items */}
              {offerItems.length > 0 ? (
                <div className="space-y-2">
                  {offerItems.map((oi, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{oi.name}</p>
                        {oi.variant && <p className="text-[10px] font-bold text-zinc-500">{oi.variant}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                          <button type="button" onClick={() => updateOfferItemQty(oi.item_id, -1)} className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><Minus size={14}/></button>
                          <span className="w-8 text-center text-sm font-black">{oi.quantity}</span>
                          <button type="button" onClick={() => updateOfferItemQty(oi.item_id, 1)} className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><Plus size={14}/></button>
                        </div>
                        <button type="button" onClick={() => setOfferItems(p => p.filter(x => x.item_id !== oi.item_id))} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
                  <p className="text-xs font-bold text-zinc-400">No items added to combo yet.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Active Offer</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving...' : form.id ? 'Update Offer' : 'Save Combo Offer'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Offers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offers.map(o => (
          <div key={o.id} className={`card p-4 transition-all ${!o.is_active ? 'opacity-60 grayscale' : 'border border-indigo-100 dark:border-indigo-900/30 shadow-md'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-black text-lg text-zinc-900 dark:text-white leading-tight">{o.name}</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{o.description}</p>
              </div>
              <div className="text-right">
                <span className="font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg text-sm">₹{o.price}</span>
              </div>
            </div>
            
            <div className="mt-4 mb-4 space-y-1">
              {o.offer_items?.map(oi => (
                <div key={oi.id} className="flex justify-between text-xs border-b border-zinc-100 dark:border-zinc-800/50 pb-1">
                  <span className="font-bold text-zinc-600 dark:text-zinc-400">{oi.quantity}x {oi.items?.name}</span>
                  <span className="text-[9px] text-zinc-400">{oi.items?.variant}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <button onClick={() => toggleActive(o)} className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded ${o.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-500'}`}>
                {o.is_active ? 'Active' : 'Inactive'}
              </button>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(o)} className="p-1.5 text-zinc-400 hover:text-indigo-500 bg-zinc-50 dark:bg-zinc-800 rounded"><Edit2 size={14}/></button>
                <button onClick={() => deleteOffer(o.id)} className="p-1.5 text-zinc-400 hover:text-red-500 bg-zinc-50 dark:bg-zinc-800 rounded"><Trash2 size={14}/></button>
              </div>
            </div>
          </div>
        ))}
        {offers.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-zinc-500">
            <Tag size={32} className="mx-auto mb-2 opacity-20" />
            <p className="font-bold">No offers created yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
