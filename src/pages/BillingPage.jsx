import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Minus, Trash2, Search, X, CheckCircle2, Receipt, UserPlus, Banknote } from 'lucide-react'

export default function BillingPage() {
  const { branchId, user } = useAuthStore()
  const [selectedBranch, setSelectedBranch] = useState(branchId || 'gurukul')
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  
  const [cart, setCart] = useState([])
  
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

  // Auto-fill amount for single payment
  useEffect(() => {
    if (payments.length === 1 && total > 0) {
      setPayments(p => [{ ...p[0], amount: total }])
    } else if (payments.length === 1 && total === 0) {
      setPayments(p => [{ ...p[0], amount: 0 }])
    }
  }, [total])

  // Fetch all items once (for rapid filtering)
  useEffect(() => {
    async function fetchInventory() {
      setLoading(true)
      const targetBranch = branchId || selectedBranch
      const { data } = await supabase.from('items').select('*').eq('is_active', true).eq('branch_id', targetBranch).order('name')
      const fetchedItems = data || []
      setItems(fetchedItems)
      
      const cats = [...new Set(fetchedItems.map(i => i.category))].filter(Boolean)
      setCategories(cats)
      if (cats.length > 0 && !activeCategory) setActiveCategory(cats[0])
      setLoading(false)
    }
    fetchInventory()
  }, [branchId, selectedBranch])

  // Customer Search
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

  // Rapid POS Actions
  function addToCart(item) {
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === item.id)
      if (idx >= 0) return prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + 1 } : c)
      return [{ ...item, quantity: 1 }, ...prev] // Add to top for rapid feedback
    })
  }

  function updateQty(id, delta) {
    setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0))
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
      toast.error(`Advance payment exceeds available balance (₹${custBalances.advance})`)
      return
    }

    setLoading(true)
    try {
      const target_branch = branchId || selectedBranch
      
      const { data: order, error } = await supabase.from('orders').insert({
        customer_id: customer?.id || null, branch_id: target_branch, total, status: 'completed'
      }).select().single()
      if (error) throw error

      await supabase.from('order_items').insert(cart.map(c => ({
        order_id: order.id, item_id: c.id, quantity: c.quantity, unit_price: c.price,
      })))

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
      toast.success('Bill generated instantly!')
    } catch (e) {
      toast.error('Failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = useMemo(() => {
    if (itemSearch) return items.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
    return items.filter(i => i.category === activeCategory)
  }, [items, itemSearch, activeCategory])

  /* ── Receipt Screen ── */
  if (receipt) return (
    <div className="max-w-sm mx-auto animate-slide-up pt-10">
      <div className="card overflow-hidden">
        <div className="bg-ink-900 dark:bg-white px-6 py-8 text-center">
          <CheckCircle2 size={40} className="text-white dark:text-ink-900 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white dark:text-ink-900">Bill Created</h2>
          <p className="text-ink-400 dark:text-ink-600 text-sm mt-1 font-mono">#{receipt.order.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="p-5 space-y-4">
          {receipt.customer && (
            <div className="flex justify-between text-sm"><span className="text-ink-500">Customer</span><span className="font-semibold">{receipt.customer.name}</span></div>
          )}
          <div className="border border-ink-200 dark:border-ink-700 rounded-xl overflow-hidden divide-y divide-ink-100 dark:divide-ink-800">
            {receipt.cart.map((c, i) => (
              <div key={i} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-ink-600 dark:text-ink-400">{c.name} <span className="text-ink-400">× {c.quantity}</span></span>
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

  /* ── POS Layout ── */
  return (
    <div className="flex flex-col xl:flex-row h-[calc(100vh-5rem)] -m-4 md:-m-6 overflow-hidden bg-ink-100 dark:bg-ink-950">
      
      {/* LEFT: Items Grid (70%) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-ink-900">
        {/* Top Search & Branch */}
        <div className="px-4 py-3 border-b border-ink-200 dark:border-ink-800 flex gap-3 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input 
              className="w-full bg-ink-50 dark:bg-ink-950 border border-ink-200 dark:border-ink-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ink-900 dark:focus:ring-white transition-all" 
              placeholder="Search all items instantly..." 
              value={itemSearch} 
              onChange={e => setItemSearch(e.target.value)} 
              autoFocus
            />
            {itemSearch && (
              <button onClick={() => setItemSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900"><X size={14}/></button>
            )}
          </div>
          
          {!branchId && (
            <select className="input text-sm w-32 py-2.5" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
              <option value="gurukul">Gurukul</option><option value="bhat">Bhat</option><option value="visat">Visat</option>
            </select>
          )}
        </div>

        {/* Categories Tabs */}
        {!itemSearch && (
          <div className="overflow-x-auto border-b border-ink-200 dark:border-ink-800 no-scrollbar">
            <div className="flex p-2 gap-1 min-w-max">
              {categories.map(cat => (
                <button key={cat}
                  className={`px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800'}`}
                  onClick={() => setActiveCategory(cat)}>
                  {cat.replace('.html','')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-ink-50 dark:bg-ink-950/50">
          {loading ? (
            <div className="flex items-center justify-center h-full"><div className="animate-spin text-4xl">⏳</div></div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center text-ink-400 mt-10 text-sm">No items found</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map(item => (
                <button key={item.id} onClick={() => addToCart(item)}
                  className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl p-4 text-left shadow-sm hover:shadow-md hover:border-ink-400 dark:hover:border-ink-600 transition-all active:scale-95 group flex flex-col justify-between h-28">
                  <span className="font-bold text-ink-900 dark:text-white text-sm leading-tight group-hover:text-ink-600 dark:group-hover:text-ink-300 line-clamp-2">{item.name}</span>
                  <span className="font-black text-ink-900 dark:text-white mt-2 inline-block bg-ink-50 dark:bg-ink-800 px-2 py-1 rounded-md text-xs">₹{item.price}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart & Checkout (30%) */}
      <div className="xl:w-[420px] flex flex-col bg-white dark:bg-ink-900 border-l border-ink-200 dark:border-ink-800 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10">
        
        {/* Customer Select */}
        <div className="p-4 border-b border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-950/30">
          {customer ? (
            <div className="flex flex-col gap-2 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl p-3 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 flex items-center justify-center font-bold uppercase">{customer.name[0]}</div>
                  <div>
                    <p className="font-bold text-ink-900 dark:text-white text-sm leading-none">{customer.name}</p>
                    <p className="text-[10px] text-ink-500 font-mono mt-1">@{customer.username}</p>
                  </div>
                </div>
                <button onClick={deselectCustomer} className="p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"><X size={14}/></button>
              </div>
              <div className="flex gap-2 text-[10px] font-bold mt-1">
                <span className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 px-2 py-1 rounded border border-red-100 dark:border-red-900/30">Levana: ₹{custBalances.khata}</span>
                <span className="bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900/30">Adv: ₹{custBalances.advance}</span>
              </div>
            </div>
          ) : (
            <div className="relative">
              <UserPlus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-ink-900 dark:focus:ring-white transition-all" placeholder="Attach Customer (Optional)..." value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setDropdownOpen(true) }} />
              {dropdownOpen && customerResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-xl shadow-modal overflow-hidden">
                  {customerResults.map(c => (
                    <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-700 border-b border-ink-100 dark:border-ink-700 last:border-0" onClick={() => selectCustomer(c)}>
                      <p className="font-bold text-sm text-ink-900 dark:text-white">{c.name} <span className="font-normal text-[10px] text-ink-400 ml-1">@{c.username}</span></p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-ink-300 dark:text-ink-700">
              <Receipt size={48} className="mb-4 opacity-50" />
              <p className="font-medium text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Tap items on the left to add</p>
            </div>
          ) : (
            cart.map(c => (
              <div key={c.id} className="flex gap-2 items-center bg-ink-50 dark:bg-ink-800/50 p-2 rounded-xl group border border-transparent hover:border-ink-200 dark:hover:border-ink-700 transition-colors">
                <div className="flex flex-col items-center gap-1 bg-white dark:bg-ink-900 rounded-lg p-1 border border-ink-200 dark:border-ink-800 shadow-sm">
                  <button onClick={() => updateQty(c.id, 1)} className="w-6 h-5 flex items-center justify-center hover:bg-ink-100 dark:hover:bg-ink-800 rounded"><Plus size={12} /></button>
                  <span className="text-xs font-black w-6 text-center">{c.quantity}</span>
                  <button onClick={() => updateQty(c.id, -1)} className="w-6 h-5 flex items-center justify-center hover:bg-ink-100 dark:hover:bg-ink-800 rounded"><Minus size={12} /></button>
                </div>
                <div className="flex-1 min-w-0 pl-1">
                  <p className="font-bold text-sm text-ink-900 dark:text-white truncate">{c.name}</p>
                  <p className="text-[10px] text-ink-500 font-mono mt-0.5">₹{c.price} × {c.quantity}</p>
                </div>
                <div className="text-right pl-2">
                  <p className="font-black text-sm text-ink-900 dark:text-white">₹{(c.price * c.quantity).toLocaleString('en-IN')}</p>
                  <button onClick={() => setCart(p => p.filter(i => i.id !== c.id))} className="text-[10px] text-red-500 opacity-0 group-hover:opacity-100 font-semibold uppercase transition-opacity mt-1">Remove</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Panel */}
        <div className="bg-ink-50 dark:bg-ink-950 p-4 border-t border-ink-200 dark:border-ink-800 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          
          {/* Quick Pay / Split */}
          {cart.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">Payment Mode</span>
                <button onClick={addPaymentSplit} className="text-[10px] font-bold text-ink-900 dark:text-white bg-white dark:bg-ink-800 px-2 py-1 rounded shadow-sm border border-ink-200 dark:border-ink-700 hover:bg-ink-100">Split Pay</button>
              </div>
              {payments.map((p, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <select className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-xs font-bold p-2.5 rounded-lg w-24 focus:ring-1 focus:ring-ink-900 outline-none" value={p.mode} onChange={e => updatePayment(i, 'mode', e.target.value)}>
                    <option value="CASH">Cash</option>
                    <option value="ONLINE">Online</option>
                    {customer && <option value="KHATA">Khata</option>}
                    {customer && custBalances.advance > 0 && <option value="ADVANCE">Advance</option>}
                  </select>
                  {p.mode === 'ONLINE' ? (
                    <select className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-xs font-bold p-2.5 rounded-lg w-20 focus:ring-1 focus:ring-ink-900 outline-none" value={p.subtype} onChange={e => updatePayment(i, 'subtype', e.target.value)}>
                      <option value="UPI">UPI</option><option value="CREDIT_CARD">CC</option><option value="DEBIT_CARD">DC</option>
                    </select>
                  ) : <div className="w-20 hidden sm:block"></div>}
                  <input type="number" className="flex-1 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-sm font-black p-2.5 rounded-lg text-right focus:ring-1 focus:ring-ink-900 outline-none tabular-nums" value={p.amount} onChange={e => updatePayment(i, 'amount', e.target.value)} />
                  {payments.length > 1 && <button onClick={() => removePayment(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><X size={14}/></button>}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-end mb-4">
            <span className="text-sm font-bold text-ink-500">Total Due</span>
            <span className="text-4xl font-black text-ink-900 dark:text-white tabular-nums tracking-tight leading-none">₹{total.toLocaleString('en-IN')}</span>
          </div>
          
          <div className="flex gap-2">
            {payments.length === 1 && payments[0].mode === 'CASH' ? (
              <button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2" onClick={handleExactCash} disabled={cart.length===0 || loading}>
                <Banknote size={20} /> EXACT CASH (₹{total})
              </button>
            ) : (
              <button className="btn-primary flex-1 py-4 rounded-xl text-lg disabled:opacity-50" onClick={() => handleBill()} disabled={cart.length===0 || loading || Math.abs(total-totalPaid)>0.01}>
                {loading ? 'Processing...' : 'Confirm Payment'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
