import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Plus, Minus, Trash2, Search, X, CheckCircle2, Receipt, UserPlus, Banknote, ShoppingCart, ChevronUp, Printer, Grid3X3, ArrowLeft, ShoppingBag } from 'lucide-react'

const ALL_CATEGORIES = [
  'Smoke', 'Paan', 'Candy & Chewing', 'Beverages', 'Snacks', 'BB Cafe'
]

export default function BillingPage() {
  const { branchId, user } = useAuthStore()
  const [selectedBranch, setSelectedBranch] = useState(branchId || 'gurukul')
  const [items, setItems] = useState([])
  const [activeCategory, setActiveCategory] = useState(branchId === 'bhat' || selectedBranch === 'bhat' ? 'BB Cafe' : 'Paan')
  
  const [cart, setCart] = useState([])
  const [cartExpanded, setCartExpanded] = useState(false)
  const [qtyEditor, setQtyEditor] = useState(null)
  
  // Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [customer, setCustomer] = useState(null)
  const [customerResults, setCustomerResults] = useState([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [custBalances, setCustBalances] = useState({ khata: 0, advance: 0 })

  // Payments & Checkout
  const [payments, setPayments] = useState([{ mode: 'CASH', subtype: '', amount: 0 }])
  const [loading, setLoading] = useState(true)
  const [orderType, setOrderType] = useState('Dine-in')

  // Search & New Customer
  const [itemSearch, setItemSearch] = useState('')
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [addingCust, setAddingCust] = useState(false)

  // Table billing
  const [cafeTables, setCafeTables] = useState([])
  const [selectedTable, setSelectedTable] = useState(null) // { id, table_number, current_order_id }
  const [loadingTable, setLoadingTable] = useState(false)
  const isBhatBranch = (branchId || selectedBranch) === 'bhat'
  const [posMode, setPosMode] = useState(false) // Toggle between Tables Grid vs POS UI

  // Order Management
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [showOrdersModal, setShowOrdersModal] = useState(false)
  const [recentOrders, setRecentOrders] = useState([])

  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)

  // Cash denomination helper state (UI only, never stored)
  const [cashGiven, setCashGiven] = useState(0)
  const DENOMINATIONS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 2000]
  const cashChange = cashGiven - total
  const hasCashPayment = payments.some(p => p.mode === 'CASH')
  const isSingleCash = payments.length === 1 && payments[0].mode === 'CASH'

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

  // Fetch cafe tables for Bhat
  useEffect(() => {
    const branch = branchId || selectedBranch
    if (branch !== 'bhat') { setCafeTables([]); return }
    async function fetchTables() {
      const { data } = await supabase.from('cafe_tables').select('*').eq('branch_id', branch).order('table_number')
      setCafeTables(data || [])
    }
    fetchTables()
    const ch = supabase.channel('billing_tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables', filter: 'branch_id=eq.bhat' }, fetchTables)
      .subscribe()
    return () => supabase.removeChannel(ch)
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
    setShowAddCustomer(false)
    const [khata, adv] = await Promise.all([
      supabase.from('khata_ledger').select('type,amount').eq('customer_id', c.id),
      supabase.from('advance_ledger').select('type,amount').eq('customer_id', c.id)
    ])
    const khataBal = (khata.data || []).reduce((sum, l) => l.type === 'CREDIT' ? sum + Number(l.amount) : sum - Number(l.amount), 0)
    const advBal = (adv.data || []).reduce((sum, l) => l.type === 'TOPUP' ? sum + Number(l.amount) : sum - Number(l.amount), 0)
    setCustBalances({ khata: khataBal, advance: advBal })
  }

  async function quickAddCustomer() {
    if (!newCustName || !customerSearch) { toast.error('Enter name and 10-digit mobile number'); return }
    setAddingCust(true)
    try {
      const { data, error } = await supabase.from('customers').insert({
        name: newCustName,
        mobile_number: customerSearch,
        branch_id: branchId || selectedBranch
      }).select().single()
      if (error) throw error
      toast.success('Customer registered!')
      selectCustomer(data)
    } catch (e) {
      toast.error('Registration failed: ' + e.message)
    } finally {
      setAddingCust(false)
    }
  }

  async function fetchRecentOrders() {
    const today = new Date().toISOString().split('T')[0]
    let q = supabase.from('orders').select('*, customers(name), order_payments(mode, amount), order_items(quantity, price, items(name, variant))').gte('created_at', today).order('created_at', {ascending: false})
    if (branchId || selectedBranch) q = q.eq('branch_id', branchId || selectedBranch)
    const { data } = await q
    setRecentOrders(data || [])
  }

  async function editOrder(order) {
    if (order.status === 'cancelled') { toast.error('Order is cancelled'); return }
    setLoading(true)
    const { data: orderItems } = await supabase.from('order_items').select('*, items(*)').eq('order_id', order.id)
    const cartItems = orderItems.map(oi => ({ ...oi.items, quantity: oi.quantity, price: oi.price }))
    setCart(cartItems)
    setEditingOrderId(order.id)
    setOrderType(order.order_type || 'Dine-in')
    if (order.customer_id && order.customers) {
      setCustomer({ id: order.customer_id, name: order.customers.name })
      const [khata, adv] = await Promise.all([
        supabase.from('khata_ledger').select('type,amount').eq('customer_id', order.customer_id),
        supabase.from('advance_ledger').select('type,amount').eq('customer_id', order.customer_id)
      ])
      const khataBal = (khata.data || []).reduce((sum, l) => l.type === 'CREDIT' ? sum + Number(l.amount) : sum - Number(l.amount), 0)
      const advBal = (adv.data || []).reduce((sum, l) => l.type === 'TOPUP' ? sum + Number(l.amount) : sum - Number(l.amount), 0)
      setCustBalances({ khata: khataBal, advance: advBal })
    }
    const { data: payments } = await supabase.from('order_payments').select('*').eq('order_id', order.id)
    if (payments && payments.length > 0) {
      setPayments(payments.map(p => {
        if (['UPI', 'CREDIT_CARD', 'DEBIT_CARD'].includes(p.mode)) {
          return { mode: 'ONLINE', subtype: p.mode, amount: p.amount }
        }
        return { mode: p.mode, subtype: '', amount: p.amount }
      }))
    }
    setShowOrdersModal(false)
    setLoading(false)
    toast.success('Order loaded for editing')
  }

  async function cancelOrder(orderId) {
    if (!window.confirm('Are you sure you want to cancel this order?')) return
    // restore stock
    const { data: oldItems } = await supabase.from('order_items').select('item_id, quantity').eq('order_id', orderId)
    if (oldItems) {
       for (const oi of oldItems) {
          await supabase.rpc('decrement_stock', { p_item_id: oi.item_id, p_amount: -oi.quantity })
       }
    }
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    await supabase.from('khata_ledger').delete().eq('order_id', orderId)
    await supabase.from('advance_ledger').delete().eq('order_id', orderId)
    toast.success('Order cancelled & stock restored')
    fetchRecentOrders()
  }

  // Load table order into cart
  async function loadTableOrder(table) {
    if (!table.current_order_id) {
      // Just select the table, empty cart
      setSelectedTable(table)
      setCart([])
      toast(`Table ${table.table_number} selected — cart cleared`)
      return
    }
    setLoadingTable(true)
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*, items(*)')
      .eq('order_id', table.current_order_id)
    setSelectedTable(table)
    if (orderItems && orderItems.length > 0) {
      const cartItems = orderItems.map(oi => ({
        ...oi.items,
        quantity: oi.quantity,
        price: oi.price,
      }))
      setCart(cartItems)
      toast.success(`Loaded ${cartItems.length} items from Table ${table.table_number}`)
    } else {
      setCart([])
    }
    // Link customer from order if available
    const { data: ord } = await supabase.from('orders').select('customer_id, customers(*)').eq('id', table.current_order_id).single()
    if (ord?.customers) selectCustomer(ord.customers)
    setLoadingTable(false)
  }

  function clearTable() {
    setSelectedTable(null)
    setCart([])
    setCustomer(null)
    setCustBalances({ khata: 0, advance: 0 })
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
    let finalPayments = overridePayments || payments
    
    // Auto-convert KHATA to ADVANCE if customer has advance balance
    if (customer && custBalances.advance > 0) {
      let remainingAdv = custBalances.advance
      let adjusted = []
      for (const p of finalPayments) {
        if (p.mode === 'KHATA' && remainingAdv > 0) {
          const amt = parseFloat(p.amount)
          if (amt <= remainingAdv) {
            adjusted.push({ ...p, mode: 'ADVANCE' })
            remainingAdv -= amt
          } else {
            adjusted.push({ ...p, mode: 'ADVANCE', amount: remainingAdv })
            adjusted.push({ ...p, amount: amt - remainingAdv })
            remainingAdv = 0
          }
        } else {
          adjusted.push(p)
        }
      }
      finalPayments = adjusted
    }

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
      
      // If editing an order, restore stock for old items first
      if (editingOrderId) {
        const { data: oldItems } = await supabase.from('order_items').select('item_id, quantity').eq('order_id', editingOrderId)
        if (oldItems) {
           for (const oi of oldItems) {
              await supabase.rpc('decrement_stock', { p_item_id: oi.item_id, p_amount: -oi.quantity })
           }
        }
      }

      // If billing from a table or editing, update the existing order; otherwise create new
      let order
      if (editingOrderId || selectedTable?.current_order_id) {
        const orderIdToUpdate = editingOrderId || selectedTable.current_order_id
        const { data: updatedOrder, error } = await supabase.from('orders')
          .update({ customer_id: customer?.id || null, subtotal: total, total, status: 'completed', order_type: orderType })
          .eq('id', orderIdToUpdate)
          .select().single()
        if (error) throw error
        order = updatedOrder
        
        await supabase.from('khata_ledger').delete().eq('order_id', order.id)
        await supabase.from('advance_ledger').delete().eq('order_id', order.id)
        await supabase.from('order_items').delete().eq('order_id', order.id)
        await supabase.from('order_payments').delete().eq('order_id', order.id)

        // Replace order items with final cart
        await supabase.from('order_items').insert(cart.map(c => ({
          order_id: order.id, item_id: c.id, quantity: c.quantity, price: c.price, total: c.quantity * c.price
        })))
      } else {
        const { data: newOrder, error } = await supabase.from('orders').insert({
          customer_id: customer?.id || null, branch_id: target_branch, subtotal: total, discount: 0, total, status: 'completed',
          table_number: selectedTable?.table_number || null, order_type: orderType
        }).select().single()
        if (error) throw error
        order = newOrder
        await supabase.from('order_items').insert(cart.map(c => ({
          order_id: order.id, item_id: c.id, quantity: c.quantity, price: c.price, total: c.quantity * c.price
        })))
      }
      
      // Real DB Stock deduction & Disposables Logic
      let cafeDishCount = 0;
      let maggiBowlCount = 0;

      for (const c of cart) {
        await supabase.rpc('decrement_stock', { p_item_id: c.id, p_amount: c.quantity })
        
        // Dynamic Recipe Ingredient Deduction
        const { data: ingredients } = await supabase.from('item_ingredients')
          .select('ingredient_item_id, quantity_per_unit').eq('item_id', c.id)
        
        if (ingredients && ingredients.length > 0) {
          for (const ing of ingredients) {
            const totalDeduction = ing.quantity_per_unit * c.quantity
            await supabase.rpc('decrement_stock', { p_item_id: ing.ingredient_item_id, p_amount: totalDeduction })
          }
        }

        // Hardcoded fallback for BB Cafe disposables if not configured in recipe system
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

      const { error: paymentError } = await supabase.from('order_payments').insert(finalPayments.map(p => ({
        order_id: order.id, 
        mode: p.mode === 'ONLINE' ? (p.subtype || 'UPI') : p.mode, 
        amount: parseFloat(p.amount)
      })))
      if (paymentError) {
         console.error('Payment Error:', paymentError)
         throw paymentError
      }

      for (const p of finalPayments) {
        if (p.mode === 'KHATA') {
          await supabase.from('khata_ledger').insert({
            customer_id: customer.id, branch_id: target_branch, type: 'CREDIT', amount: parseFloat(p.amount),
            reason: `Order #${order.order_number || order.id.slice(0, 8)}`, order_id: order.id, recorded_by: user.username
          })
        }
        if (p.mode === 'ADVANCE') {
          await supabase.from('advance_ledger').insert({
            customer_id: customer.id, branch_id: target_branch, type: 'DEDUCTION', amount: parseFloat(p.amount),
            reason: `Order #${order.order_number || order.id.slice(0, 8)}`, order_id: order.id, recorded_by: user.username
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

      // Silent Receipt Generation for Bhat
      const receiptData = { order, cart: [...cart], total, customer, payments: finalPayments, tableNumber: selectedTable?.table_number }
      const isBhat = (branchId || selectedBranch) === 'bhat'
      if (isBhat) {
        // Run print seamlessly in background
        printBillPDF(receiptData)
      }

      // Clear table
      if (selectedTable) {
        await supabase.from('cafe_tables').update({ status: 'available', current_order_id: null }).eq('id', selectedTable.id)
        setSelectedTable(null)
      }
      // RESET POS (Blanking)
      setCart([]); setCustomer(null); setCustomerSearch(''); setOrderType('Dine-in'); setShowAddCustomer(false); setNewCustName('');
      setPayments([{ mode: 'CASH', subtype: '', amount: 0 }])
      setCashGiven(0)
      setCartExpanded(false)
      const wasEditing = editingOrderId
      setEditingOrderId(null)
      toast.success(wasEditing ? 'Order updated successfully!' : 'Bill generated & cart cleared!')
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

  function printBillPDF(r) {
    const isBhat = (branchId || selectedBranch) === 'bhat'
    if (!isBhat) return
    const rows = r.cart.map(c =>
      `<tr><td>${c.name}${c.variant ? ' <small>('+c.variant+')</small>' : ''}</td><td style="text-align:center">${c.quantity}</td><td style="text-align:right">₹${(c.price*c.quantity).toLocaleString('en-IN')}</td></tr>`
    ).join('')
    const payRows = r.payments.map(p =>
      `<tr><td>${p.mode}${p.subtype ? ' - '+p.subtype : ''}</td><td style="text-align:right">₹${parseFloat(p.amount).toLocaleString('en-IN')}</td></tr>`
    ).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>BB Cafe Bill</title><style>
      body{font-family:Arial,sans-serif;max-width:320px;margin:0 auto;padding:16px;font-size:12px;}
      h2{text-align:center;margin:0;font-size:16px;letter-spacing:2px;}
      .sub{text-align:center;color:#666;font-size:10px;margin-bottom:8px;}
      table{width:100%;border-collapse:collapse;margin:8px 0;}
      td{padding:4px 2px;vertical-align:top;}
      .divider{border-top:1px dashed #000;margin:8px 0;}
      .total-row td{font-weight:bold;font-size:14px;padding-top:6px;}
      .footer{text-align:center;font-size:10px;color:#888;margin-top:12px;}
      @media print{body{margin:0;padding:8px;}}
    </style></head><body>
      <h2>BB CAFE</h2>
      <div class="sub">Bhat · Order #${r.order.order_number || r.order.id.slice(0,8).toUpperCase()}</div>
      <div class="sub">${new Date().toLocaleString('en-IN')}</div>
      ${r.customer ? `<div class="sub">Customer: <b>${r.customer.name}</b>${r.customer.mobile_number ? ' · '+r.customer.mobile_number : ''}</div>` : ''}
      <div class="divider"></div>
      <table><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Amt</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="divider"></div>
      <table><tbody><tr class="total-row"><td>TOTAL</td><td style="text-align:right">₹${r.total.toLocaleString('en-IN')}</td></tr></tbody></table>
      <div class="divider"></div>
      <table><thead><tr><th style="text-align:left">Payment</th><th style="text-align:right">Amount</th></tr></thead><tbody>${payRows}</tbody></table>
      <div class="footer">Thank you for visiting Bombay Bethak!<br>bombay-bethak.vercel.app</div>
    </body></html>`
    const w = window.open('', '_blank', 'width=400,height=600')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  const activeSubcategories = useMemo(() => {
    let filtered = items
    if (itemSearch) {
      filtered = filtered.filter(i => (i.name||'').toLowerCase().includes(itemSearch.toLowerCase()) || (i.variant||'').toLowerCase().includes(itemSearch.toLowerCase()))
    } else {
      filtered = filtered.filter(i => i.category === activeCategory)
    }
    const subs = filtered.map(i => i.subcategory).filter(Boolean)
    return [...new Set(subs)].sort()
  }, [items, activeCategory, itemSearch])

  const activeItems = useMemo(() => {
    if (itemSearch) return items.filter(i => (i.name||'').toLowerCase().includes(itemSearch.toLowerCase()) || (i.variant||'').toLowerCase().includes(itemSearch.toLowerCase()))
    return items.filter(i => i.category === activeCategory)
  }, [items, activeCategory, itemSearch])
  const subcategories = activeSubcategories

  const renderTableDashboard = () => (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-ink-900 dark:text-white">Active Orders</h1>
        <div className="flex gap-2">
          {!branchId && (
            <select className="input font-bold" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
              <option value="gurukul">Gurukul</option><option value="bhat">Bhat</option><option value="visat">Visat</option>
            </select>
          )}
          <button onClick={() => { fetchRecentOrders(); setShowOrdersModal(true); }} className="btn-secondary whitespace-nowrap text-xs md:text-sm px-4">Manage Orders</button>
        </div>
      </div>

      {isBhatBranch && (
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-ink-900 dark:text-white"><Grid3X3 className="text-ember"/> Dine-in Tables</h2>
          {cafeTables.length === 0 ? (
            <p className="text-ink-500 italic">No tables active.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {cafeTables.map(t => {
                const isOccupied = t.status === 'occupied'
                return (
                  <div key={t.id} className={`card p-4 flex flex-col items-center justify-center gap-3 border-2 transition-all shadow-md ${isOccupied ? 'border-red-400 bg-red-50 dark:bg-red-900/10' : 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10'}`}>
                    <h3 className={`text-3xl font-black ${isOccupied ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{t.table_number}</h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${isOccupied ? 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300' : 'bg-emerald-200 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'}`}>
                      {t.status}
                    </span>
                    <button onClick={() => { loadTableOrder(t); setPosMode(true); }} className={`w-full py-2.5 rounded-xl text-sm font-black text-white shadow-lg transition-transform active:scale-95 ${isOccupied ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'}`}>
                      {isOccupied ? 'Update Order' : 'New Order'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-ink-900 dark:text-white"><ShoppingBag className="text-ember"/> Direct Orders</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card p-6 border-2 border-amber-500 flex flex-col justify-between gap-4 bg-amber-50/30 dark:bg-amber-900/10">
            <div>
              <h3 className="text-2xl font-black text-amber-600 mb-1">Takeaway</h3>
              <p className="text-sm text-ink-500 font-medium">Walk-in customers picking up orders.</p>
            </div>
            <button onClick={() => { setOrderType('Takeaway'); setSelectedTable(null); setPosMode(true); }} className="btn-primary bg-amber-500 hover:bg-amber-600 w-full py-3.5 shadow-lg shadow-amber-500/30 font-black">Start Takeaway Order</button>
          </div>
          <div className="card p-6 border-2 border-rose-500 flex flex-col justify-between gap-4 bg-rose-50/30 dark:bg-rose-900/10">
            <div>
              <h3 className="text-2xl font-black text-rose-600 mb-1">Zomato / Swiggy</h3>
              <p className="text-sm text-ink-500 font-medium">Online delivery aggregators.</p>
            </div>
            <button onClick={() => { setOrderType('Zomato/Swiggy'); setSelectedTable(null); setPosMode(true); }} className="btn-primary bg-rose-500 hover:bg-rose-600 w-full py-3.5 shadow-lg shadow-rose-500/30 font-black">Start Delivery Order</button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!posMode) {
    return (
      <div className="h-full overflow-y-auto">
        {renderTableDashboard()}
        
        {/* Manage Orders Modal (shared) */}
        {showOrdersModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm">
            <div className="bg-ink-50 dark:bg-ink-950 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
              <div className="flex justify-between items-center p-4 border-b border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900">
                <h3 className="font-black text-lg text-ink-900 dark:text-white flex items-center gap-2"><Receipt size={20} className="text-ember"/> Manage Today's Orders</h3>
                <button onClick={() => setShowOrdersModal(false)} className="text-ink-400 hover:text-red-500"><X size={24}/></button>
              </div>
              <div className="p-4 overflow-y-auto no-scrollbar space-y-3 flex-1">
                {recentOrders.length === 0 ? <p className="text-center text-ink-400 py-10">No orders today.</p> :
                 recentOrders.map(o => (
                   <div key={o.id} className={`p-4 rounded-xl border ${o.status==='cancelled'?'bg-red-50/50 border-red-100':'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800'}`}>
                     <div className="flex justify-between items-start mb-2">
                       <div>
                         <p className={`font-bold text-sm ${o.status==='cancelled'?'text-red-500 line-through':'text-ink-900 dark:text-white'}`}>
                           {o.order_number || `#${o.id.slice(0,8).toUpperCase()}`}
                           <span className="ml-2 text-xs font-normal text-ink-400 no-underline">{new Date(o.created_at).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</span>
                         </p>
                         <p className="text-xs text-ink-500 mt-0.5">{o.customers?.name || 'Guest'} {o.table_number ? `· T-${o.table_number}` : ''}</p>
                       </div>
                       <div className="text-right">
                         <p className="font-black text-lg text-ink-900 dark:text-white">₹{o.total}</p>
                         {o.status === 'cancelled' ? <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded">Cancelled</span> :
                          <div className="flex gap-2 justify-end mt-1">
                            <button onClick={() => editOrder(o)} className="text-xs font-bold text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded">Edit</button>
                            <button onClick={() => cancelOrder(o.id)} className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded">Cancel</button>
                          </div>
                         }
                       </div>
                     </div>
                     <div className="text-xs text-ink-500 mt-2 border-t border-ink-100 dark:border-ink-800/50 pt-2 flex flex-col gap-0.5">
                       {(o.order_items||[]).map((oi, idx) => (
                         <div key={idx} className="flex justify-between">
                           <span><span className="font-bold">{oi.quantity}x</span> {oi.items?.name} {oi.items?.variant && `(${oi.items.variant})`}</span>
                           <span>₹{oi.price * oi.quantity}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                 ))
                }
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-5rem)] -m-4 md:-m-6 bg-ink-100 dark:bg-ink-950 relative overflow-hidden">
      
      {/* LEFT / TOP: Category Tabs */}
      <div className="md:w-32 lg:w-40 bg-white dark:bg-ink-900 border-b md:border-b-0 md:border-r border-ink-200 dark:border-ink-800 flex-shrink-0 z-10 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-x-auto md:overflow-y-auto no-scrollbar flex md:flex-col p-1.5 md:p-3 gap-1 md:gap-2 mt-2 md:mt-0">
          {availableTabs.map(cat => (
            <button key={cat} onClick={() => { setActiveCategory(cat); setItemSearch(''); }}
              className={`px-4 py-3 md:py-4 rounded-xl md:rounded-2xl text-sm md:text-base font-bold whitespace-nowrap md:whitespace-normal text-left transition-all flex flex-col md:gap-1 flex-shrink-0
              ${activeCategory === cat && !itemSearch ? 'bg-ember text-white shadow-md shadow-ember/20' : 'bg-ink-50 dark:bg-ink-950/50 text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
              {cat}
            </button>
          ))}

          {/* Removed internal table selector, now handled in Table Dashboard */}
        </div>
      </div>

      {/* MIDDLE: Items Grid (The POS area) */}
      <div className="flex-1 flex flex-col min-w-0 bg-ink-50 dark:bg-ink-950 pb-16 md:pb-0 relative overflow-hidden">
        {/* Table Selector moved to left sidebar */}

        {/* Top Search Bar (Menu + Customer) */}
        <div className="p-3 bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 flex flex-col md:flex-row items-center gap-3 shadow-sm z-20">
          <button onClick={() => setPosMode(false)} className="btn-secondary w-full md:w-auto md:px-4 py-2.5 md:mr-2 shrink-0 border-ink-300 hover:bg-ink-100 flex items-center justify-center gap-2">
            <ArrowLeft size={16}/> Back to Dashboard
          </button>
          
          <div className="flex w-full gap-3">
            {/* 1. Menu Search */}
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input 
                type="text" 
                placeholder="Search Cafe Menu..." 
                className="w-full bg-ink-50 dark:bg-ink-950 border border-ink-200 dark:border-ink-800 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:ring-2 focus:ring-ember outline-none transition-all"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
              />
              {itemSearch && <button onClick={() => setItemSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"><X size={14}/></button>}
            </div>

            {/* 2. Customer Search / Selected Customer */}
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
              {dropdownOpen && customerSearch.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-xl shadow-modal overflow-hidden">
                  {customerResults.map(c => (
                    <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-700 border-b border-ink-100 dark:border-ink-700 last:border-0" onClick={() => selectCustomer(c)}>
                      <p className="font-bold text-sm text-ink-900 dark:text-white">{c.name} <span className="font-normal text-[10px] text-ink-400 ml-1">@{c.username || c.mobile_number}</span></p>
                    </button>
                  ))}
                  {customerResults.length === 0 && customerSearch.length >= 10 && (
                    <div className="p-3">
                      <p className="text-xs text-ink-500 mb-2">Customer not found. Register?</p>
                      <button onClick={() => { setShowAddCustomer(true); setDropdownOpen(false) }} className="btn-secondary w-full py-2 flex justify-center text-sm"><UserPlus size={14} className="mr-2"/> Add New Customer</button>
                    </div>
                  )}
                  {customerResults.length === 0 && customerSearch.length < 10 && (
                    <div className="p-4 text-center text-xs text-ink-400">No results found</div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Editing Banner */}
        {editingOrderId && (
          <div className="bg-amber-100 text-amber-800 text-xs font-bold p-2 text-center flex justify-center items-center gap-2">
            ⚠️ EDITING ORDER: #{editingOrderId.slice(0,8).toUpperCase()}
            <button onClick={() => setEditingOrderId(null)} className="underline ml-2 hover:text-amber-900">Cancel Edit</button>
          </div>
        )}

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
            <div className="mb-4 space-y-3">
              {/* Add Customer Inline Form */}
              {showAddCustomer && (
                <div className="p-3 bg-ember/5 border border-ember/20 rounded-xl space-y-2 mb-2 animate-slide-up">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-ember uppercase tracking-widest">New Customer</span>
                    <button onClick={() => setShowAddCustomer(false)} className="text-ink-400 hover:text-ink-900"><X size={14}/></button>
                  </div>
                  <input className="input text-sm w-full py-2 bg-white" placeholder="Customer Name" value={newCustName} onChange={e => setNewCustName(e.target.value)} autoFocus />
                  <input className="input text-sm w-full py-2 bg-white text-ink-500" value={customerSearch} disabled />
                  <button onClick={quickAddCustomer} disabled={addingCust} className="btn-primary w-full py-2.5 text-sm">{addingCust ? 'Registering...' : 'Save & Link Customer'}</button>
                </div>
              )}

              {/* Order Type Toggle */}
              <div>
                <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-1.5 block">Order Type</span>
                <div className="flex bg-ink-50 dark:bg-ink-950 p-1 rounded-lg">
                  {['Dine-in', 'Parcel (BB)', 'Parcel (Swiggy)'].map(type => (
                    <button key={type} onClick={() => setOrderType(type)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${orderType === type ? 'bg-white dark:bg-ink-800 shadow text-ink-900 dark:text-white' : 'text-ink-500 hover:text-ink-700'}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payments */}
              <div>
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
              {/* Cash Denomination Helper - UI only */}
              {isSingleCash && total > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Cash Helper</span>
                    {cashGiven > 0 && (
                      <button onClick={() => setCashGiven(0)} className="text-[9px] text-emerald-600 hover:text-emerald-800 font-bold">Reset</button>
                    )}
                  </div>
                  {/* Denomination Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {DENOMINATIONS.map(d => (
                      <button key={d} onClick={() => setCashGiven(g => g + d)}
                        className="px-2 py-1 bg-white dark:bg-ink-800 border border-emerald-200 dark:border-emerald-700 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors active:scale-95">
                        {`+₹${d}`}
                      </button>
                    ))}
                  </div>
                  {/* Running total */}
                  <div className="flex justify-between items-center pt-1 border-t border-emerald-200 dark:border-emerald-800">
                    <div className="text-xs">
                      <span className="text-ink-500">Given: </span>
                      <span className="font-black text-ink-900 dark:text-white">₹{cashGiven.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-xs">
                      {cashGiven >= total ? (
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          Return: ₹{cashChange.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-red-500 font-bold">
                          Short: ₹{Math.abs(cashChange).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </div>
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

      {/* Orders Management Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowOrdersModal(false)}>
          <div className="bg-white dark:bg-ink-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-ink-200 dark:border-ink-800 flex justify-between items-center bg-ink-50 dark:bg-ink-950/50">
              <h2 className="font-bold text-lg text-ink-900 dark:text-white">Manage Today's Orders</h2>
              <button onClick={() => setShowOrdersModal(false)} className="p-2 text-ink-400 hover:text-ink-900"><X size={18}/></button>
            </div>
            <div className="p-4 overflow-y-auto no-scrollbar space-y-3 flex-1">
              {recentOrders.length === 0 ? <p className="text-center text-ink-400 py-10">No orders today.</p> :
               recentOrders.map(o => (
                 <div key={o.id} className={`p-4 rounded-xl border ${o.status==='cancelled'?'bg-red-50/50 border-red-100':'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800'}`}>
                   <div className="flex justify-between items-start mb-2">
                     <div>
                       <p className={`font-bold text-sm ${o.status==='cancelled'?'text-red-500 line-through':'text-ink-900 dark:text-white'}`}>
                         {o.order_number || `#${o.id.slice(0,8).toUpperCase()}`}
                         <span className="ml-2 text-xs font-normal text-ink-400 no-underline">{new Date(o.created_at).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</span>
                       </p>
                       <p className="text-xs text-ink-500 mt-0.5">{o.customers?.name || 'Guest'} {o.table_number ? `· T-${o.table_number}` : ''}</p>
                     </div>
                     <div className="text-right">
                       <p className="font-black text-lg text-ink-900 dark:text-white">₹{o.total}</p>
                       {o.status === 'cancelled' ? <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded">Cancelled</span> :
                        <div className="flex gap-2 justify-end mt-1">
                          <button onClick={() => editOrder(o)} className="text-xs font-bold text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded">Edit</button>
                          <button onClick={() => cancelOrder(o.id)} className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded">Cancel</button>
                        </div>
                       }
                     </div>
                   </div>
                   <div className="text-xs text-ink-500 mt-2 border-t border-ink-100 dark:border-ink-800/50 pt-2 flex flex-col gap-0.5">
                     {(o.order_items||[]).map((oi, idx) => (
                       <div key={idx} className="flex justify-between">
                         <span><span className="font-bold">{oi.quantity}x</span> {oi.items?.name} {oi.items?.variant && `(${oi.items.variant})`}</span>
                         <span>₹{oi.price * oi.quantity}</span>
                       </div>
                     ))}
                   </div>
                 </div>
               ))
              }
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
