import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Minus, Trash2, Search, X, CheckCircle2, Receipt, UserPlus, Banknote, ShoppingCart, ChevronUp } from 'lucide-react'

const ALL_CATEGORIES = [
  'Smoke', 'Paan', 'Candy & Chewing', 'Beverages', 'Snacks', 'BB Cafe'
]

export default function BillingPage() {
  const { branchId, user } = useAuthStore()
  const [selectedBranch, setSelectedBranch] = useState(branchId || 'gurukul')
  const [items, setItems] = useState([])
  const [activeCategory, setActiveCategory] = useState('Paan')
  
  const [cart, setCart] = useState([])
  const [cartExpanded, setCartExpanded] = useState(false)
  const [qtyEditor, setQtyEditor] = useState(null)
  
  // Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [customer, setCustomer] = useState(null)
  const [customerResults, setCustomerResults] = useState([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [custBalances, setCustBalances] = useState({ khata: 0, advance: 0 })

  // Payments
  const [payments, setPayments] = useState([{ mode: 'CASH', subtype: '', amount: 0 }])
  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(true)

  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)

  // Determine available tabs
  const availableTabs = useMemo(() => {
    const branch = branchId || selectedBranch
    if (branch === 'bhat') return ALL_CATEGORIES
    return ALL_CATEGORIES.filter(c => c !== 'BB Cafe')
  }, [branchId, selectedBranch])

  useEffect(() => {
    if (!availableTabs.includes(activeCategory)) setActiveCategory(availableTabs[0])
  }, [availableTabs, activeCategory])

  useEffect(() => {
    if (payments.length === 1 && total > 0) {
      setPayments(p => [{ ...p[0], amount: total }])
    } else if (payments.length === 1 && total === 0) {
      setPayments(p => [{ ...p[0], amount: 0 }])
    }
  }, [total])

  useEffect(() => {
    async function fetchInventory() {
      setLoading(true)
      const targetBranch = branchId || selectedBranch
      const { data } = await supabase.from('items').select('*')
        .eq('branch_id', targetBranch)
        .neq('category', 'Inventory')
        .eq('is_active', true)
        .eq('is_archived', false)
        
      setItems(data || [])
      setLoading(false)
    }
    fetchInventory()
  }, [branchId, selectedBranch])

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      let q = supabase.from('customers').select('*')
        .or(`username.ilike.%${customerSearch}%,mobile_number.ilike.%${customerSearch}%,name.ilike.%${customerSearch}%`)
        .eq('branch_id', branchId || selectedBranch)
      const { data } = await q.limit(5)
      setCustomerResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [customerSearch, branchId, selectedBranch])

  async function selectCustomer(c) {
    setCustomer(c)
    setDropdownOpen(false)
    setCustomerSearch('')
    const [khata, adv] = await Promise.all([
      supabase.from('khata_ledger').select('type,amount').eq('customer_id', c.id),
      supabase.from('advance_ledger').select('type,amount').eq('customer_id', c.id)
    ])
    const khataBal = (khata.data || []).reduce((sum, l) => l.type === 'CREDIT' ? sum + Number(l.amount) : sum - Number(l.amount), 0)
    const advBal = (adv.data || []).reduce((sum, l) => l.type === 'TOPUP' ? sum + Number(l.amount) : sum - Number(l.amount), 0)
    setCustBalances({ khata: khataBal, advance: advBal })
  }

  function deselectCustomer() {
    setCustomer(null)
    setCustBalances({ khata: 0, advance: 0 })
    setPayments([{ mode: 'CASH', subtype: '', amount: total }])
  }

  function addToCart(item, qty = 1) {
    if (!item.is_active || !item.price || item.stock_quantity <= 0) return
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === item.id)
      if (idx >= 0) return prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + qty } : c)
      return [{ ...item, quantity: qty }, ...prev]
    })
    // Optimistic stock deduction on UI side (actual deduction on confirm)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_quantity: i.stock_quantity - qty } : i))
  }

  function updateQty(id, delta) {
    setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0))
    // Restore stock if removing from cart
    setItems(prev => prev.map(i => i.id === id ? { ...i, stock_quantity: i.stock_quantity - delta } : i))
  }
  
  function setExactQty(id, qty) {
    if (qty <= 0) {
      const itemInCart = cart.find(c => c.id === id)
      if (itemInCart) {
        setItems(prev => prev.map(i => i.id === id ? { ...i, stock_quantity: i.stock_quantity + itemInCart.quantity } : i))
      }
      setCart(prev => prev.filter(c => c.id !== id))
    } else {
      setCart(prev => {
        const itemInCart = prev.find(c => c.id === id)
        const oldQty = itemInCart ? itemInCart.quantity : 0
        const delta = qty - oldQty
        setItems(itemsPrev => itemsPrev.map(i => i.id === id ? { ...i, stock_quantity: i.stock_quantity - delta } : i))
        
        if (itemInCart) return prev.map(c => c.id === id ? { ...c, quantity: qty } : c)
        const dbItem = items.find(i => i.id === id)
        return [{ ...dbItem, quantity: qty }, ...prev]
      })
    }
  }

  // Payment UI
  function addPaymentSplit() {
    setPayments(p => [...p, { mode: 'ONLINE', subtype: 'UPI', amount: Math.max(0, total - totalPaid) }])
  }
  function updatePayment(index, field, val) {
    setPayments(p => p.map((pay, i) => i === index ? { ...pay, [field]: val } : pay))
  }
  function removePayment(index) {
    setPayments(p => p.filter((_, i) => i !== index))
  }
  function handleExactCash() {
    setPayments([{ mode: 'CASH', subtype: '', amount: total }])
    handleBill([{ mode: 'CASH', subtype: '', amount: total }])
  }

  async function handleBill(overridePayments = null) {
    const finalPayments = overridePayments || payments
    const finalTotalPaid = finalPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    if (Math.abs(total - finalTotalPaid) > 0.01) { toast.error(`Total paid (₹${finalTotalPaid}) must equal Bill total (₹${total})`); return }
    
    const totalAdvanceAttempt = finalPayments.filter(p => p.mode === 'ADVANCE').reduce((s, p) => s + parseFloat(p.amount), 0)
    if (totalAdvanceAttempt > custBalances.advance) {
      toast.error(`Advance exceeds balance (₹${custBalances.advance})`); return
    }

    setLoading(true)
    try {
      const target_branch = branchId || selectedBranch
      const { data: order, error } = await supabase.from('orders').insert({
        customer_id: customer?.id || null, branch_id: target_branch, subtotal: total, discount: 0, total, status: 'completed'
      }).select().single()
      if (error) throw error

      await supabase.from('order_items').insert(cart.map(c => ({
        order_id: order.id, item_id: c.id, quantity: c.quantity, price: c.price, total: c.quantity * c.price
      })))
      
      // Real DB Stock deduction & Disposables Logic
      let cafeDishCount = 0;
      let maggiBowlCount = 0;

      for (const c of cart) {
        await supabase.rpc('decrement_stock', { p_item_id: c.id, p_amount: c.quantity })
        
        if (c.category === 'BB Cafe') {
          cafeDishCount += c.quantity;
          if (c.name.toLowerCase().includes('maggi')) {
             maggiBowlCount += c.quantity;
          }
        }
      }

      if (cafeDishCount > 0 || maggiBowlCount > 0) {
        const { data: disposables } = await supabase.from('items')
          .select('id, name')
          .eq('category', 'Inventory')
          .eq('subcategory', 'Disposables')
          .eq('branch_id', target_branch)

        if (disposables && disposables.length > 0) {
          const dish = disposables.find(d => d.name.toLowerCase().includes('dish') || d.name.toLowerCase().includes('plate'))
          const bowl = disposables.find(d => d.name.toLowerCase().includes('bowl'))
          
          if (dish && cafeDishCount > 0) {
             await supabase.rpc('decrement_stock', { p_item_id: dish.id, p_amount: cafeDishCount })
          }
          if (bowl && maggiBowlCount > 0) {
             await supabase.rpc('decrement_stock', { p_item_id: bowl.id, p_amount: maggiBowlCount })
          }
        }
      }

      await supabase.from('order_payments').insert(finalPayments.map(p => ({
        order_id: order.id, mode: p.mode, online_subtype: p.subtype || null, amount: parseFloat(p.amount)
      })))

      for (const p of finalPayments) {
        if (p.mode === 'KHATA') {
          await supabase.from('khata_ledger').insert({
            customer_id: customer.id, branch_id: target_branch, type: 'CREDIT', amount: parseFloat(p.amount),
            reason: `Order #${order.id.slice(0, 8)}`, order_id: order.id, recorded_by: user.username
          })
        }
        if (p.mode === 'ADVANCE') {
          await supabase.from('advance_ledger').insert({
            customer_id: customer.id, branch_id: target_branch, type: 'DEDUCTION', amount: parseFloat(p.amount),
            reason: `Order #${order.id.slice(0, 8)}`, order_id: order.id, recorded_by: user.username
          })
        }
      }

      if (customer) {
        const ghoda = Math.floor(total / 10)
        if (ghoda > 0) {
          await supabase.from('ghoda_transactions').insert({
            customer_id: customer.id, type: 'earn', amount: ghoda, reason: `Purchase ₹${total}`
          })
          await supabase.from('customers').update({ ghoda_coins: (customer.ghoda_coins || 0) + ghoda }).eq('id', customer.id)
        }
      }

      setReceipt({ order, cart: [...cart], total, customer, payments: finalPayments })
      setCart([]); setCustomer(null); setCustomerSearch(''); 
      setPayments([{ mode: 'CASH', subtype: '', amount: 0 }])
      setCartExpanded(false)
      toast.success('Bill generated!')
    } catch (e) {
      toast.error('Failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Double tap handler
  let tapTimer = null
  function handleCardTap(item) {
    if (!item.is_active || !item.price || item.stock_quantity <= 0) return
    if (tapTimer) {
      clearTimeout(tapTimer)
      tapTimer = null
      setQtyEditor(item) // Double tap
    } else {
      tapTimer = setTimeout(() => {
        tapTimer = null
        addToCart(item, 1) // Single tap
      }, 250)
    }
  }

  if (receipt) return (
    <div className="max-w-sm mx-auto animate-slide-up pt-10">
      <div className="card overflow-hidden">
        <div className="bg-ink-900 dark:bg-white px-6 py-8 text-center">
          <CheckCircle2 size={40} className="text-white dark:text-ink-900 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white dark:text-ink-900">Bill Created</h2>
          <p className="text-ink-400 dark:text-ink-600 text-sm mt-1 font-mono">#{receipt.order.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="p-5 space-y-4">
          {receipt.customer && <div className="flex justify-between text-sm"><span className="text-ink-500">Customer</span><span className="font-semibold">{receipt.customer.name}</span></div>}
          <div className="border border-ink-200 dark:border-ink-700 rounded-xl overflow-hidden divide-y divide-ink-100 dark:divide-ink-800">
            {receipt.cart.map((c, i) => (
              <div key={i} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-ink-600 dark:text-ink-400">{c.name} {c.variant && <span className="text-[10px] bg-ink-100 dark:bg-ink-800 px-1 rounded ml-1">{c.variant}</span>} <span className="text-ink-400 ml-1">× {c.quantity}</span></span>
                <span className="font-semibold">₹{(c.price * c.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-ink-50 dark:bg-ink-800 font-bold">
              <span>Total</span><span className="text-lg">₹{receipt.total.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <button className="btn-primary w-full mt-4 btn-lg" autoFocus onClick={() => setReceipt(null)}>+ New Bill</button>
        </div>
      </div>
    </div>
  )

  const activeSubcategories = useMemo(() => {
    const subs = items
      .filter(i => i.category === activeCategory)
      .map(i => i.subcategory)
      .filter(Boolean)
    return [...new Set(subs)].sort()
  }, [items, activeCategory])

  const activeItems = items.filter(i => i.category === activeCategory)
  const subcategories = activeSubcategories

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-5rem)] -m-4 md:-m-6 bg-ink-100 dark:bg-ink-950 relative overflow-hidden">
      
      {/* LEFT / TOP: Category Tabs */}
      <div className="md:w-32 lg:w-40 bg-white dark:bg-ink-900 border-b md:border-b-0 md:border-r border-ink-200 dark:border-ink-800 flex-shrink-0 z-10 overflow-x-auto md:overflow-y-auto no-scrollbar">
        <div className="flex md:flex-col gap-2 p-3">
          {availableTabs.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-3 md:py-4 rounded-xl md:rounded-2xl text-sm md:text-base font-bold whitespace-nowrap md:whitespace-normal text-left transition-all flex flex-col md:gap-1 
              ${activeCategory === cat ? 'bg-ember text-white shadow-md shadow-ember/20' : 'bg-ink-50 dark:bg-ink-950/50 text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* MIDDLE: Items Grid (The POS area) */}
      <div className="flex-1 flex flex-col min-w-0 bg-ink-50 dark:bg-ink-950 pb-16 md:pb-0 relative overflow-hidden">
        
        {/* Customer Bar */}
        <div className="p-3 bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 flex items-center gap-2 shadow-sm z-20">
          {customer ? (
            <div className="flex-1 flex justify-between items-center bg-ink-50 dark:bg-ink-950 rounded-xl px-3 py-2 border border-ink-200 dark:border-ink-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-ember text-white flex items-center justify-center font-bold uppercase">{customer.name[0]}</div>
                <div>
                  <p className="font-bold text-ink-900 dark:text-white text-sm leading-none">{customer.name}</p>
                  <div className="flex gap-2 text-[9px] font-bold mt-1">
                    {custBalances.khata > 0 && <span className="text-red-500">Levana: ₹{custBalances.khata}</span>}
                    {custBalances.advance > 0 && <span className="text-emerald-500">Adv: ₹{custBalances.advance}</span>}
                  </div>
                </div>
              </div>
              <button onClick={deselectCustomer} className="p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"><X size={16}/></button>
            </div>
          ) : (
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="w-full bg-ink-50 dark:bg-ink-950 border border-ink-200 dark:border-ink-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-ember outline-none" placeholder="Select Customer..." value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setDropdownOpen(true) }} />
              {dropdownOpen && customerResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-xl shadow-modal overflow-hidden">
                  {customerResults.map(c => (
                    <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-700 border-b border-ink-100 dark:border-ink-700 last:border-0" onClick={() => selectCustomer(c)}>
                      <p className="font-bold text-sm text-ink-900 dark:text-white">{c.name} <span className="font-normal text-[10px] text-ink-400 ml-1">@{c.username}</span></p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {!branchId && (
            <select className="input text-xs w-24 py-2.5 bg-white dark:bg-ink-900" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
              <option value="gurukul">Gurukul</option><option value="bhat">Bhat</option><option value="visat">Visat</option>
            </select>
          )}
        </div>

        {/* Subcategories Grid Area */}
        <div className="flex-1 overflow-y-auto p-2 pb-24 md:pb-4 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center"><div className="animate-spin text-4xl">⏳</div></div>
          ) : (
            <div className="space-y-6">
              {subcategories.map(sub => {
                const subItems = activeItems.filter(i => i.subcategory === sub)
                if (subItems.length === 0) return null
                return (
                  <div key={sub} className="bg-white dark:bg-ink-900/50 p-3 rounded-2xl border border-ink-200 dark:border-ink-800/50">
                    <h3 className="font-black text-ink-900 dark:text-white text-sm mb-3 uppercase tracking-wider px-1">{sub}</h3>
                    <div className="flex overflow-x-auto pb-2 -mx-1 px-1 gap-2 no-scrollbar snap-x">
                      {subItems.map(item => {
                        const inCart = cart.find(c => c.id === item.id)
                        const qty = inCart ? inCart.quantity : 0
                        const isOut = item.stock_quantity <= 0
                        const isInactive = !item.is_active || !item.price
                        
                        return (
                          <button key={item.id} 
                            onClick={() => handleCardTap(item)}
                            onContextMenu={(e) => { e.preventDefault(); setQtyEditor(item) }}
                            disabled={isInactive || (isOut && qty === 0)}
                            className={`relative flex-shrink-0 snap-start w-[100px] h-[110px] flex flex-col justify-between p-2.5 rounded-xl text-left select-none transition-all
                              ${qty > 0 ? 'bg-ink-900 border-2 border-ember shadow-[0_0_15px_rgba(255,100,0,0.3)]' : 
                                isInactive || (isOut && qty === 0) ? 'bg-ink-100 dark:bg-ink-900/40 border border-transparent opacity-60 grayscale' : 
                                'bg-ink-800 hover:bg-ink-700 border border-ink-700 hover:border-ink-500'}
                            `}>
                            
                            {/* Qty Badge */}
                            {qty > 0 && (
                              <div className="absolute -top-2 -right-2 bg-ember text-white w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow-md shadow-ember/50 z-10 transition-transform scale-100">
                                {qty}
                              </div>
                            )}

                            <div>
                              <div className={`font-bold text-sm leading-tight line-clamp-2 ${qty > 0 ? 'text-white' : isInactive ? 'text-ink-400' : 'text-white'}`}>
                                {item.name}
                              </div>
                              {item.variant && (
                                <div className={`text-[10px] mt-0.5 font-semibold ${qty > 0 ? 'text-ember-300' : 'text-ink-400'}`}>
                                  {item.variant}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex justify-between items-end">
                              <div className={`font-black text-sm tracking-tight ${qty > 0 ? 'text-white' : isInactive ? 'text-ink-500' : 'text-emerald-400'}`}>
                                {isInactive ? 'NO PRICE' : `₹${item.price}`}
                              </div>
                              {isOut && qty === 0 && !isInactive && (
                                <div className="text-[9px] font-bold text-red-400 uppercase bg-red-950/50 px-1 rounded">Out</div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {subcategories.every(sub => activeItems.filter(i => i.subcategory === sub).length === 0) && (
                <div className="text-center text-ink-400 mt-10 text-sm font-medium">No items assigned to these subcategories yet.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT / BOTTOM: Cart Panel */}
      <div className={`
        fixed md:relative inset-x-0 bottom-0 z-40 bg-white dark:bg-ink-900 border-t md:border-t-0 md:border-l border-ink-200 dark:border-ink-800 flex flex-col shadow-[0_-20px_40px_rgba(0,0,0,0.1)] md:shadow-none transition-transform duration-300
        ${cartExpanded ? 'translate-y-0 h-[85vh] md:h-auto' : 'translate-y-[calc(100%-4rem)] md:translate-y-0'}
        md:w-[380px] lg:w-[420px] md:h-full
      `}>
        {/* Mobile Header (Toggle) */}
        <div className="md:hidden flex justify-between items-center p-3 h-16 cursor-pointer bg-ink-900 text-white" onClick={() => setCartExpanded(!cartExpanded)}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart size={20} />
              {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-ember text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold">{cart.length}</span>}
            </div>
            <span className="font-bold text-sm">{cart.length} items</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-black text-lg">₹{total.toLocaleString('en-IN')}</span>
            <ChevronUp size={20} className={`transition-transform duration-300 ${cartExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex justify-between items-center p-4 border-b border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-950/50">
          <h2 className="font-black text-ink-900 dark:text-white flex items-center gap-2"><ShoppingCart size={18}/> Cart ({cart.length})</h2>
          {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs font-bold text-red-500 hover:text-red-600 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded">Clear</button>}
        </div>

        {/* Cart List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-ink-50 dark:bg-ink-950/30">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-ink-300 dark:text-ink-700">
              <Receipt size={48} className="mb-4 opacity-50" />
              <p className="font-medium text-sm">Cart is empty</p>
            </div>
          ) : (
            cart.map(c => (
              <div key={c.id} className="flex gap-2 items-center bg-white dark:bg-ink-900 p-2.5 rounded-xl border border-ink-200 dark:border-ink-800 shadow-sm">
                <div className="flex flex-col items-center gap-1 bg-ink-50 dark:bg-ink-800/50 rounded-lg p-1 border border-ink-200 dark:border-ink-700">
                  <button onClick={() => updateQty(c.id, 1)} className="w-7 h-6 flex items-center justify-center hover:bg-ink-200 dark:hover:bg-ink-700 rounded active:scale-95"><Plus size={14} /></button>
                  <span className="text-sm font-black w-7 text-center">{c.quantity}</span>
                  <button onClick={() => updateQty(c.id, -1)} className="w-7 h-6 flex items-center justify-center hover:bg-ink-200 dark:hover:bg-ink-700 rounded active:scale-95"><Minus size={14} /></button>
                </div>
                <div className="flex-1 min-w-0 pl-2">
                  <p className="font-bold text-sm text-ink-900 dark:text-white truncate leading-tight">{c.name}</p>
                  <p className="text-[10px] font-bold text-ink-500 mt-0.5">{c.variant && `${c.variant} • `}₹{c.price}</p>
                </div>
                <div className="text-right pl-2 pr-1">
                  <p className="font-black text-base text-ink-900 dark:text-white leading-tight">₹{(c.price * c.quantity).toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Panel */}
        <div className="bg-white dark:bg-ink-900 p-4 border-t border-ink-200 dark:border-ink-800 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom)]">
          {cart.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Payment Mode</span>
                <button onClick={addPaymentSplit} className="text-[10px] font-bold text-ember bg-ember/10 hover:bg-ember/20 px-2 py-1 rounded transition-colors">Split Bill</button>
              </div>
              {payments.map((p, i) => (
                <div key={i} className="flex gap-2 items-center bg-ink-50 dark:bg-ink-950 p-2 rounded-xl border border-ink-200 dark:border-ink-800">
                  <select className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-xs font-bold p-2.5 rounded-lg w-24 focus:ring-1 focus:ring-ember outline-none appearance-none" value={p.mode} onChange={e => updatePayment(i, 'mode', e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="ONLINE">Online</option>
                    {customer && <option value="KHATA">Khata</option>}
                    {customer && custBalances.advance > 0 && <option value="ADVANCE">Advance</option>}
                  </select>
                  {p.mode === 'ONLINE' && (
                    <select className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-xs font-bold p-2.5 rounded-lg w-20 focus:ring-1 focus:ring-ember outline-none appearance-none" value={p.subtype} onChange={e => updatePayment(i, 'subtype', e.target.value)}>
                      <option value="UPI">UPI</option><option value="CREDIT_CARD">CC</option><option value="DEBIT_CARD">DC</option>
                    </select>
                  )}
                  <input type="number" className="flex-1 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-base font-black p-2 rounded-lg text-right focus:ring-1 focus:ring-ember outline-none tabular-nums" value={p.amount} onChange={e => updatePayment(i, 'amount', e.target.value)} />
                  {payments.length > 1 && <button onClick={() => removePayment(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><X size={16}/></button>}
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2 mt-2">
            {payments.length === 1 && payments[0].mode === 'CASH' ? (
              <button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 flex flex-col justify-center items-center leading-none" onClick={handleExactCash} disabled={cart.length===0 || loading}>
                <span className="text-[10px] tracking-widest uppercase opacity-80 mb-1">Exact Cash</span>
                <span className="text-xl">₹{total}</span>
              </button>
            ) : (
              <button className="flex-1 bg-ember hover:bg-ember-600 text-white font-black py-4 rounded-xl shadow-[0_8px_20px_rgba(255,100,0,0.3)] transition-all active:scale-95 flex flex-col justify-center items-center leading-none disabled:opacity-50" onClick={() => handleBill()} disabled={cart.length===0 || loading || Math.abs(total-totalPaid)>0.01}>
                <span className="text-[10px] tracking-widest uppercase opacity-80 mb-1">Confirm</span>
                <span className="text-xl">₹{total}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* QTY Editor Modal */}
      {qtyEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-ink-900 w-full max-w-xs rounded-2xl p-5 shadow-2xl scale-100 transition-transform">
            <h3 className="font-bold text-lg text-ink-900 dark:text-white mb-1 leading-tight">{qtyEditor.name}</h3>
            {qtyEditor.variant && <p className="text-xs font-semibold text-ink-500 mb-4">{qtyEditor.variant}</p>}
            
            <div className="flex items-center justify-between bg-ink-50 dark:bg-ink-950 p-2 rounded-xl mb-6">
              <button onClick={() => setQtyEditor({ ...qtyEditor, editQty: Math.max(0, (qtyEditor.editQty || (cart.find(c=>c.id===qtyEditor.id)?.quantity || 0)) - 1) })} className="w-12 h-12 bg-white dark:bg-ink-800 rounded-lg flex items-center justify-center hover:bg-ink-200 active:scale-95 shadow-sm">
                <Minus size={20} />
              </button>
              <input type="number" className="w-20 text-center font-black text-3xl bg-transparent outline-none tabular-nums" 
                value={qtyEditor.editQty !== undefined ? qtyEditor.editQty : (cart.find(c=>c.id===qtyEditor.id)?.quantity || 0)} 
                onChange={e => setQtyEditor({ ...qtyEditor, editQty: parseInt(e.target.value) || 0 })} autoFocus />
              <button onClick={() => setQtyEditor({ ...qtyEditor, editQty: (qtyEditor.editQty !== undefined ? qtyEditor.editQty : (cart.find(c=>c.id===qtyEditor.id)?.quantity || 0)) + 1 })} className="w-12 h-12 bg-white dark:bg-ink-800 rounded-lg flex items-center justify-center hover:bg-ink-200 active:scale-95 shadow-sm">
                <Plus size={20} />
              </button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => setQtyEditor(null)} className="flex-1 py-3 font-bold text-ink-600 bg-ink-100 dark:bg-ink-800 rounded-xl">Cancel</button>
              <button onClick={() => { setExactQty(qtyEditor.id, qtyEditor.editQty !== undefined ? qtyEditor.editQty : 0); setQtyEditor(null) }} className="flex-1 py-3 font-bold text-white bg-ember rounded-xl shadow-lg shadow-ember/30">Set Qty</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
