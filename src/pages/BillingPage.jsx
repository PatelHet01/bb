import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { playBell } from '../utils/bell'
import { Plus, Minus, Trash2, Search, X, CheckCircle2, Receipt, UserPlus, Banknote, ShoppingCart, ChevronUp, Printer, Grid3X3, ArrowLeft, ShoppingBag, Flame, Edit2, Calendar, ScanLine, Camera, CameraOff } from 'lucide-react'

const ALL_CATEGORIES = [
  'Smoke', 'Paan', 'Candy & Chewing', 'Beverages', 'Snacks', 'BB Cafe'
]

// Simple debounce utility
function debounce(fn, delay) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay) }
}

export default function BillingPage() {
  const { branchId, user } = useAuthStore()
  const [selectedBranch, setSelectedBranch] = useState(branchId || 'gurukul')
  const [items, setItems] = useState([])
  const [activeCategory, setActiveCategory] = useState(branchId === 'bhat' || selectedBranch === 'bhat' ? 'BB Cafe' : 'Paan')

  // ── Active Context States ──────────────────────────────────────────────────
  const [cart, setCart] = useState([])
  const [customer, setCustomer] = useState(null)
  const [custBalances, setCustBalances] = useState({ khata: 0, advance: 0 })
  const [orderType, setOrderType] = useState('Dine-in')
  const [discountType, setDiscountType] = useState('FLAT')
  const [discountValue, setDiscountValue] = useState(0)
  const [discountOpen, setDiscountOpen] = useState(false)

  // Session
  const [currentSessionId, setCurrentSessionId] = useState(null)
  
  // ── Multi-table cart cache ─────────────────────────────────────────────────
  // Used merely as a background cache to restore state when switching
  const [tableCarts, setTableCarts] = useState({})

  const [cartExpanded, setCartExpanded] = useState(false)
  const [qtyEditor, setQtyEditor] = useState(null)
  const [packMode, setPackMode] = useState({}) // { [item_id]: true = pack mode (in cart) }
  const [cardPackMode, setCardPackMode] = useState({}) // { [item_id]: true = pack selected on item card (before add) }

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Payments & Checkout
  const [payments, setPayments] = useState([{ mode: 'CASH', subtype: '', amount: 0 }])
  const [loading, setLoading] = useState(true)

  // Search & New Customer
  const [itemSearch, setItemSearch] = useState('')
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [addingCust, setAddingCust] = useState(false)
  const [isEditingCustomer, setIsEditingCustomer] = useState(false)
  const [editCustName, setEditCustName] = useState('')
  const [editCustMobile, setEditCustMobile] = useState('')
  const [savingCust, setSavingCust] = useState(false)

  // Backdated POS order date support
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0])

  // Helper to construct a backdated timestamp preserving current entry time
  const getOrderTimestamp = () => {
    const todayStr = new Date().toISOString().split('T')[0]
    if (orderDate === todayStr) {
      return new Date().toISOString()
    }
    const now = new Date()
    const timeStr = now.toTimeString().split(' ')[0] // e.g. "12:18:10"
    return new Date(`${orderDate}T${timeStr}`).toISOString()
  }

  // Barcode Scanner
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [barcodeResult, setBarcodeResult] = useState(null)
  const [barcodeError, setBarcodeError] = useState(null)

  // Camera scanning ref & state
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const [scannerActive, setScannerActive] = useState(false)

  // --- Barcode / OpenFoodFacts ---
  async function lookupBarcode(code) {
    if (!code.trim()) return
    setBarcodeLoading(true)
    setBarcodeResult(null)
    setBarcodeError(null)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code.trim()}.json`)
      const data = await res.json()
      if (data.status === 1) {
        const p = data.product
        const name = p.product_name
        const brand = p.brands
        const qty = p.quantity
        setBarcodeResult({ name: name || 'Product found (no name)', brand, qty, found: true, code: code.trim() })
      } else {
        setBarcodeResult({ found: false, code: code.trim() })
        setBarcodeError('Not found in OpenFoodFacts. Try entering the name manually.')
      }
    } catch (err) {
      setBarcodeError('Network error. Check your connection.')
    } finally {
      setBarcodeLoading(false)
    }
  }

  async function startCameraScanning() {
    setBarcodeResult(null)
    setBarcodeError(null)
    if (!('mediaDevices' in navigator)) {
      setBarcodeError('Camera not supported in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setScannerActive(true)
      
      // Start polling for barcodes every 500ms
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !streamRef.current) return
        if (!('BarcodeDetector' in window)) {
          setBarcodeError('Live scanning needs Chrome/Edge. Type the barcode below instead.')
          stopCameraScanning()
          return
        }
        try {
          const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] })
          const codes = await detector.detect(videoRef.current)
          if (codes && codes.length > 0) {
            playBell() // Visual audio feedback
            stopCameraScanning()
            setBarcodeInput(codes[0].rawValue)
            await lookupBarcode(codes[0].rawValue)
          }
        } catch (e) {
          // Silent detector check
        }
      }, 500)
    } catch (err) {
      setBarcodeError('Camera access denied. Please allow camera permissions.')
      setScannerActive(false)
    }
  }

  function stopCameraScanning() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setScannerActive(false)
  }

  function closeBarcodeModal() {
    stopCameraScanning()
    setShowBarcodeModal(false)
    setBarcodeInput('')
    setBarcodeResult(null)
    setBarcodeError(null)
  }

  function applyBarcodeResult(name) {
    setItemSearch(name)
    closeBarcodeModal()
    toast.success(`Searching for "${name}"`)
  }

  useEffect(() => {
    if (customer) {
      setEditCustName(customer.name || '')
      setEditCustMobile(customer.mobile_number || '')
    } else {
      setEditCustName('')
      setEditCustMobile('')
    }
    setIsEditingCustomer(false)
  }, [customer])


  // Table billing
  const [cafeTables, setCafeTables] = useState([])
  const [selectedTable, setSelectedTable] = useState(null) // { id, table_number, current_order_id }
  const [loadingTable, setLoadingTable] = useState(false)
  const isBhatBranch = (branchId || selectedBranch) === 'bhat'

  // Kitchen State
  const [kitchenOrderId, setKitchenOrderId] = useState(null)   // non-table kitchen order
  const [sentToKitchenQtys, setSentToKitchenQtys] = useState({}) // { [itemId]: quantity }
  const sentToKitchenIds = useMemo(() => Object.keys(sentToKitchenQtys).filter(id => sentToKitchenQtys[id] > 0), [sentToKitchenQtys])
  const isKitchenSent = sentToKitchenIds.length > 0

  // Order Management
  const [editingOrderId, setEditingOrderId] = useState(null)
  const [showOrdersModal, setShowOrdersModal] = useState(false)
  const [recentOrders, setRecentOrders] = useState([])

  // Offers
  const [activeOffers, setActiveOffers] = useState([])

  // Load active business session for this branch
  useEffect(() => {
    async function loadActiveSession() {
      const branch = branchId || selectedBranch
      if (!branch) return
      const { data } = await supabase
        .from('business_sessions')
        .select('id')
        .eq('branch_id', branch)
        .eq('status', 'open')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setCurrentSessionId(data.id)
    }
    loadActiveSession()
  }, [branchId, selectedBranch])

  const subtotal = cart.reduce((s, c) => {
    const isPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
    return s + (isPack ? (c.pack_price || c.price) : c.price) * c.quantity
  }, 0)

  const calculatedDiscount = discountType === 'PERCENT' ? (subtotal * (discountValue / 100)) : discountValue
  const total = Math.max(0, subtotal - calculatedDiscount)

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
    const targetBranch = branchId || selectedBranch

    async function fetchInventory() {
      setLoading(true)
      const { data } = await supabase.from('items').select('*')
        .eq('branch_id', targetBranch)
        .neq('category', 'Inventory')
        .eq('is_active', true)
        .eq('is_archived', false)
        .neq('item_type', 'RAW_MATERIAL')
      setItems(data || [])
      
      const { data: offersData } = await supabase.from('offers').select('*, offer_items(*, items(*))')
        .eq('is_active', true)
        .or(`branch_id.eq.${targetBranch},branch_id.is.null`)
      setActiveOffers(offersData || [])
      
      setLoading(false)
    }
    fetchInventory()

    const filter = (targetBranch && targetBranch !== 'All Branches') ? `branch_id=eq.${targetBranch}` : undefined
    const ch = supabase.channel('billing_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter }, () => fetchInventory())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter }, () => fetchInventory())
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [branchId, selectedBranch])

  // Fetch cafe tables for Bhat & pre-load any pending carts from DB
  useEffect(() => {
    const branch = branchId || selectedBranch
    if (branch !== 'bhat') { setCafeTables([]); return }
    async function fetchTables() {
      const { data } = await supabase.from('cafe_tables').select('*').eq('branch_id', branch).order('table_number')
      setCafeTables(data || [])

      // Pre-load temporary carts from pos_carts
      const { data: posCarts } = await supabase.from('pos_carts').select('*').eq('branch_id', branch)
      const newTableCarts = {}
      for (const tCart of (posCarts || [])) {
        newTableCarts[tCart.table_id] = {
          cart: tCart.cart_data || [],
          customer: tCart.customer_data || null,
          custBalances: tCart.cust_balances || { khata: 0, advance: 0 },
          orderType: tCart.order_type || 'Dine-in',
          discountType: tCart.discount_type || 'FLAT',
          discountValue: tCart.discount_value || 0
        }
      }
      setTableCarts(prev => ({ ...prev, ...newTableCarts }))
    }
    fetchTables()
    const ch = supabase.channel('billing_tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables', filter: 'branch_id=eq.bhat' }, fetchTables)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [branchId, selectedBranch])

  useEffect(() => {
    if (selectedTable) {
      const match = cafeTables.find(t => t.id === selectedTable.id)
      // If the currently selected table was cleared remotely or from another screen
      if (match && match.status === 'available') {
        setSelectedTable(null)
        setCart([])
        setOrderType('Takeaway')
        setKitchenOrderId(null)
        setSentToKitchenQtys({})
      }
    }
  }, [cafeTables])

  async function clearAllTables() {
    if (!window.confirm('Are you sure you want to clear ALL tables? This will reset them to available.')) return
    try {
      await supabase.from('cafe_tables')
        .update({ status: 'available', current_order_id: null })
        .eq('branch_id', 'bhat')
      
      setTableCarts({})
      if (selectedTable) {
        setSelectedTable(null)
        setCart([])
        setOrderType('Takeaway')
      }
      setKitchenOrderId(null)
      setSentToKitchenQtys({})
      toast.success('All tables cleared')
    } catch (e) {
      toast.error('Failed to clear tables')
    }
  }

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      let q = supabase.from('customers').select('*')
        .or(`username.ilike.%${customerSearch}%,mobile_number.ilike.%${customerSearch}%,name.ilike.%${customerSearch}%`)
      const { data } = await q.limit(5)
      setCustomerResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [customerSearch])

  // ── Subscribe to order-ready broadcast (bell + toast) ───────────────────────
  useEffect(() => {
    const ch = supabase.channel('order-ready-broadcast')
      .on('broadcast', { event: 'order_ready' }, ({ payload }) => {
        playBell()
        const label = payload.table_number ? `Table ${payload.table_number}` : (payload.order_type || 'Direct')
        toast(`🔔 Order #${payload.order_number || ''} READY — ${label}`, {
          duration: 8000,
          style: { background: '#d97706', color: '#fff', fontWeight: 'bold' }
        })
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ── Send to Kitchen ───────────────────────────────────────────────────────────
  async function sendToKitchen() {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    const branch = branchId || selectedBranch
    let orderId = selectedTable?.current_order_id || kitchenOrderId

    try {
      if (!orderId) {
        // Create new order in 'preparing' state
        const { data: newOrder, error } = await supabase.from('orders').insert({
          branch_id: branch,
          subtotal, total,
          status: 'preparing',
          table_number: selectedTable?.table_number || null,
          order_type: orderType,
          customer_id: customer?.id || null,
          created_at: getOrderTimestamp()
        }).select().single()
        if (error) throw error
        orderId = newOrder.id
        setKitchenOrderId(orderId)

        await supabase.from('order_items').insert(
          cart.map(c => {
            const cIsPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
            const linePrice = cIsPack ? (c.pack_price || c.price) : c.price
            return {
              order_id: orderId,
              item_id: c.isOffer ? null : c.id,
              offer_id: c.isOffer ? c.id : null,
              quantity: c.quantity,
              price: linePrice,
              total: linePrice * c.quantity,
              sell_mode: cIsPack ? 'pack' : 'single'
            }
          })
        )
        if (selectedTable) {
          await supabase.from('cafe_tables').update({ status: 'occupied', current_order_id: orderId }).eq('id', selectedTable.id)
          setSelectedTable(prev => prev ? { ...prev, current_order_id: orderId } : prev)
          setCafeTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'occupied', current_order_id: orderId } : t))
        }
      } else {
        // Update existing order to 'preparing' and re-sync items
        await supabase.from('orders').update({ status: 'preparing', subtotal, total, customer_id: customer?.id || null }).eq('id', orderId)
        await supabase.from('order_items').delete().eq('order_id', orderId)
        await supabase.from('order_items').insert(
          cart.map(c => {
            const cIsPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
            const linePrice = cIsPack ? (c.pack_price || c.price) : c.price
            return {
              order_id: orderId,
              item_id: c.isOffer ? null : c.id,
              offer_id: c.isOffer ? c.id : null,
              quantity: c.quantity,
              price: linePrice,
              total: linePrice * c.quantity,
              sell_mode: cIsPack ? 'pack' : 'single'
            }
          })
        )
      }

      // Insert kds_items (clear old, insert fresh — not addon)
      const { error: delErr } = await supabase.from('kds_items').delete().eq('order_id', orderId)
      if (delErr) throw delErr

      const { error: insErr } = await supabase.from('kds_items').insert(
        cart.map(c => ({
          order_id: orderId,
          item_id: c.isOffer ? null : c.id,
          item_name: c.name + (c.variant ? ` (${c.variant})` : '') + (c.isOffer ? ' [Combo]' : ''),
          quantity: c.quantity,
          status: 'pending',
          is_addon: false
        }))
      )

      const qtys = {}
      cart.forEach(c => {
        qtys[c.id] = c.quantity
      })
      setSentToKitchenQtys(qtys)
      toast.success('Sent to Kitchen! 🍳', { duration: 3000 })
    } catch (e) {
      toast.error('Send to Kitchen failed: ' + e.message)
    }
  }

  // ── Send Individual Item to Kitchen ──────────────────────────────────────────
  async function sendIndividualToKitchen(item) {
    const branch = branchId || selectedBranch
    let orderId = selectedTable?.current_order_id || kitchenOrderId

    const alreadySentQty = sentToKitchenQtys[item.id] || 0
    const qtyToSend = item.quantity - alreadySentQty
    if (qtyToSend <= 0) return

    try {
      if (!orderId) {
        // Create new order in 'preparing' state
        const { data: newOrder, error } = await supabase.from('orders').insert({
          branch_id: branch,
          subtotal, total,
          status: 'preparing',
          table_number: selectedTable?.table_number || null,
          order_type: orderType,
          customer_id: customer?.id || null,
          created_at: getOrderTimestamp()
        }).select().single()
        if (error) throw error
        orderId = newOrder.id
        setKitchenOrderId(orderId)

        // Insert all current cart items into order_items so the order is complete
        await supabase.from('order_items').insert(
          cart.map(c => {
            const cIsPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
            const linePrice = cIsPack ? (c.pack_price || c.price) : c.price
            return {
              order_id: orderId,
              item_id: c.isOffer ? null : c.id,
              offer_id: c.isOffer ? c.id : null,
              quantity: c.quantity,
              price: linePrice,
              total: linePrice * c.quantity,
              sell_mode: cIsPack ? 'pack' : 'single'
            }
          })
        )
        if (selectedTable) {
          await supabase.from('cafe_tables').update({ status: 'occupied', current_order_id: orderId }).eq('id', selectedTable.id)
          setSelectedTable(prev => prev ? { ...prev, current_order_id: orderId } : prev)
          setCafeTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'occupied', current_order_id: orderId } : t))
        }
      } else {
        // Update existing order to 'preparing' and sync order_items
        await supabase.from('orders').update({ status: 'preparing', subtotal, total, customer_id: customer?.id || null }).eq('id', orderId)
        
        await supabase.from('order_items').delete().eq('order_id', orderId)
        await supabase.from('order_items').insert(
          cart.map(c => {
            const cIsPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
            const linePrice = cIsPack ? (c.pack_price || c.price) : c.price
            return {
              order_id: orderId,
              item_id: c.isOffer ? null : c.id,
              offer_id: c.isOffer ? c.id : null,
              quantity: c.quantity,
              price: linePrice,
              total: linePrice * c.quantity,
              sell_mode: cIsPack ? 'pack' : 'single'
            }
          })
        )
      }

      // Insert this item into kds_items (as pending)
      const { error: insErr } = await supabase.from('kds_items').insert({
        order_id: orderId,
        item_id: item.isOffer ? null : item.id,
        item_name: item.name + (item.variant ? ` (${item.variant})` : '') + (item.isOffer ? ' [Combo]' : ''),
        quantity: qtyToSend,
        status: 'pending',
        is_addon: alreadySentQty > 0 || isKitchenSent
      })
      if (insErr) throw insErr

      // Add to sentToKitchenQtys state
      setSentToKitchenQtys(prev => ({
        ...prev,
        [item.id]: item.quantity
      }))
      toast.success(`${item.name} sent to kitchen! 🍳`, { duration: 3000 })
    } catch (e) {
      toast.error('Send failed: ' + e.message)
    }
  }

  // ── Append add-ons to kitchen order ──────────────────────────────────────────
  async function appendKdsAddon(item, qty) {
    const orderId = selectedTable?.current_order_id || kitchenOrderId
    if (!orderId) return
    // Append to order_items
    const { error: itemErr } = await supabase.from('order_items').insert({
      order_id: orderId, item_id: item.id, quantity: qty, price: item.price, total: item.price * qty
    })
    if (itemErr) { toast.error('Failed to add item: ' + itemErr.message); return }
    
    // Insert kds_item with is_addon=true
    const { error: kdsErr } = await supabase.from('kds_items').insert({
      order_id: orderId,
      item_id: item.id,
      item_name: item.name + (item.variant ? ` (${item.variant})` : ''),
      quantity: qty,
      status: 'pending',
      is_addon: true
    })
    if (kdsErr) { toast.error('Failed to send to KDS: ' + kdsErr.message); return }

    // Update order totals
    const newTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0) + item.price * qty
    await supabase.from('orders').update({ subtotal: newTotal, total: newTotal }).eq('id', orderId)
  }

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
    let q = supabase.from('orders').select('*, customers(*), order_payments(mode, amount), order_items(quantity, price, items(name, variant))').gte('created_at', today).order('created_at', {ascending: false})
    if (branchId || selectedBranch) q = q.eq('branch_id', branchId || selectedBranch)
    const { data } = await q
    setRecentOrders(data || [])
  }

  async function editOrder(order) {
    if (order.status === 'cancelled') { toast.error('Order is cancelled'); return }
    setLoading(true)
    const [{ data: orderItems }, { data: kds }] = await Promise.all([
      supabase.from('order_items').select('*, items(*)').eq('order_id', order.id),
      supabase.from('kds_items').select('item_id, quantity').eq('order_id', order.id)
    ])
    const qtys = {}
    if (kds) {
      kds.forEach(k => {
        if (k.item_id) {
          qtys[k.item_id] = (qtys[k.item_id] || 0) + (k.quantity || 0)
        }
      })
    }
    setSentToKitchenQtys(qtys)
    const loadedPackMode = {}
    const cartItems = (orderItems || []).map(oi => {
      if (oi.sell_mode === 'pack') {
        loadedPackMode[oi.item_id] = true
      }
      return { ...oi.items, quantity: oi.quantity, price: oi.price }
    })
    setPackMode(prev => ({ ...prev, ...loadedPackMode }))
    setCart(cartItems)
    setEditingOrderId(order.id)
    setOrderType(order.order_type || 'Dine-in')
    if (order.customer_id && order.customers) {
      setCustomer(order.customers)
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
    // restore stock — pack-aware: if sold as pack, restore qty × units_per_box singles
    const { data: oldItems } = await supabase.from('order_items').select('item_id, quantity, price, sell_mode, items(units_per_box, pack_price)').eq('order_id', orderId)
    if (oldItems) {
       for (const oi of oldItems) {
          if (!oi.item_id) continue
          const unitsPerBox = oi.items?.units_per_box || 1
          const isPackPrice = unitsPerBox > 1 && oi.items?.pack_price && Math.abs(oi.price - oi.items.pack_price) < 0.01
          const isPack = oi.sell_mode === 'pack' || isPackPrice
          const restoreQty = isPack ? oi.quantity * unitsPerBox : oi.quantity
          await supabase.rpc('decrement_stock', { p_item_id: oi.item_id, p_amount: -restoreQty })
       }
    }
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    await supabase.from('khata_ledger').delete().eq('order_id', orderId)
    await supabase.from('advance_ledger').delete().eq('order_id', orderId)
    toast.success('Order cancelled & stock restored')
    fetchRecentOrders()
  }

  // ── Debounced DB sync for pending table carts ──────────────────────────────
  const syncCartToDB = useCallback(
    debounce(async (tableId, ctx, currentOrderId, tableNumber) => {
      if (!tableId) return
      
      // 1. Sync UI cache to pos_carts
      const { error } = await supabase.from('pos_carts').upsert({
        table_id: tableId,
        branch_id: branchId || selectedBranch,
        cart_data: ctx.cart,
        customer_data: ctx.customer,
        cust_balances: ctx.custBalances,
        order_type: ctx.orderType,
        discount_type: ctx.discountType,
        discount_value: ctx.discountValue,
        last_updated: new Date().toISOString()
      }, { onConflict: 'table_id' })
      if (error) {
        console.error('Failed to sync cart to pos_carts:', error)
        toast.error('Cart sync failed: ' + error.message)
        return
      }

      // 2. Sync real DB for KDS (mirrors to `orders` table)
      let realOrderId = currentOrderId
      if (!realOrderId && ctx.cart.length > 0) {
        const { data: newOrder } = await supabase.from('orders').insert({
          branch_id: branchId || selectedBranch, subtotal: 0, total: 0, status: 'pending',
          table_number: tableNumber, order_type: ctx.orderType,
          created_at: getOrderTimestamp()
        }).select().single()
        if (newOrder) {
          realOrderId = newOrder.id
          await supabase.from('cafe_tables').update({ status: 'occupied', current_order_id: realOrderId }).eq('id', tableId)
          setSelectedTable(prev => prev?.id === tableId ? { ...prev, current_order_id: realOrderId } : prev)
        }
      }

      if (realOrderId) {
        await supabase.from('order_items').delete().eq('order_id', realOrderId)
        if (ctx.cart.length > 0) {
          await supabase.from('order_items').insert(
            ctx.cart.map(c => {
              const cIsPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
              const linePrice = cIsPack ? (c.pack_price || c.price) : c.price
              return {
                order_id: realOrderId,
                item_id: c.isOffer ? null : c.id,
                offer_id: c.isOffer ? c.id : null,
                quantity: c.quantity,
                price: linePrice,
                total: linePrice * c.quantity,
                sell_mode: cIsPack ? 'pack' : 'single'
              }
            })
          )
        }
        const sub = ctx.cart.reduce((s, c) => {
          const cIsPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
          const linePrice = cIsPack ? (c.pack_price || c.price) : c.price
          return s + linePrice * c.quantity
        }, 0)
        await supabase.from('orders').update({ subtotal: sub, total: sub }).eq('id', realOrderId)
      }
    }, 500),
    [branchId, selectedBranch, orderDate, packMode]
  )

  // ── Central Sync Effect ────────────────────────────────────────────────────
  // Auto-syncs active context to tableCarts cache and to Supabase whenever changes occur
  useEffect(() => {
    if (!selectedTable) return
    const ctx = { cart, customer, custBalances, orderType, discountType, discountValue, sentToKitchenQtys }
    
    // Update local cache without triggering a deep dependency loop
    setTableCarts(prev => ({ ...prev, [selectedTable.id]: ctx }))
    
    // Trigger debounced DB sync
    syncCartToDB(selectedTable.id, ctx, selectedTable.current_order_id, selectedTable.table_number)
  }, [cart, customer, custBalances, orderType, discountType, discountValue, sentToKitchenQtys, selectedTable, syncCartToDB])

  // ── Fast table switching (reads in-memory first, DB only on first load) ─────
  async function switchTable(table) {
    setSelectedTable(table)
    setCashGiven(0)

    const cached = tableCarts[table.id]
    if (cached) {
      setCart(cached.cart || [])
      setCustomer(cached.customer || null)
      setCustBalances(cached.custBalances || { khata: 0, advance: 0 })
      setOrderType(cached.orderType || 'Dine-in')
      setDiscountType(cached.discountType || 'FLAT')
      setDiscountValue(cached.discountValue || 0)
      setSentToKitchenQtys(cached.sentToKitchenQtys || {})
      setPayments([{ mode: 'CASH', subtype: '', amount: 0 }])
      return
    }

    // Check if the table has an active order in DB (e.g., from QR / KDS)
    if (table.current_order_id) {
      setLoadingTable(true)
      const [{ data: ois }, { data: ord }, { data: kds }] = await Promise.all([
        supabase.from('order_items').select('*, items(*)').eq('order_id', table.current_order_id),
        supabase.from('orders').select('customer_id, customers(*), order_type, status').eq('id', table.current_order_id).single(),
        supabase.from('kds_items').select('item_id, quantity').eq('order_id', table.current_order_id)
      ])
      const loadedPackMode = {}
      const cartItems = (ois || []).map(oi => {
        if (oi.sell_mode === 'pack') {
          loadedPackMode[oi.item_id] = true
        }
        return { ...oi.items, quantity: oi.quantity, price: oi.price }
      })
      setPackMode(prev => ({ ...prev, ...loadedPackMode }))
      const qtys = {}
      if (kds) {
        kds.forEach(k => {
          if (k.item_id) {
            qtys[k.item_id] = (qtys[k.item_id] || 0) + (k.quantity || 0)
          }
        })
      }
      setSentToKitchenQtys(qtys)
      const ctx = {
        cart: cartItems,
        customer: ord?.customers || null,
        custBalances: { khata: 0, advance: 0 },
        orderType: ord?.order_type || 'Dine-in',
        discountType: 'FLAT', discountValue: 0,
        sentToKitchenQtys: qtys
      }
      setTableCarts(prev => ({ ...prev, [table.id]: ctx }))
      setCart(ctx.cart)
      setCustomer(ctx.customer)
      setOrderType(ctx.orderType)
      setLoadingTable(false)
      if (cartItems.length > 0) toast.success(`Table ${table.table_number} — ${cartItems.length} item(s) loaded`)
      return
    }

    // Fresh empty table
    setTableCarts(prev => ({
      ...prev,
      [table.id]: { cart: [], customer: null, custBalances: { khata: 0, advance: 0 }, orderType: 'Dine-in', discountType: 'FLAT', discountValue: 0, sentToKitchenQtys: {} }
    }))
    setCart([])
    setCustomer(null)
    setCustBalances({ khata: 0, advance: 0 })
    setOrderType('Dine-in')
    setDiscountType('FLAT')
    setDiscountValue(0)
    setPayments([{ mode: 'CASH', subtype: '', amount: 0 }])
    setKitchenOrderId(null)
    setSentToKitchenQtys({})
  }

  // Legacy alias kept for table-dashboard button
  async function loadTableOrder(table) { await switchTable(table); setPosMode(true) }

  function clearTable() {
    if (selectedTable) {
      setTableCarts(prev => { const n = { ...prev }; delete n[selectedTable.id]; return n })
    }
    setSelectedTable(null)
    setCart([])
    setCustomer(null)
    setCustBalances({ khata: 0, advance: 0 })
    setOrderType('Dine-in')
    setDiscountType('FLAT')
    setDiscountValue(0)
  }

  function deselectCustomer() {
    setCustomer(null)
    setCustBalances({ khata: 0, advance: 0 })
    setPayments([{ mode: 'CASH', subtype: '', amount: total }])
  }

  function addToCart(item, qty = 1) {
    const currentItem = items.find(i => i.id === item.id) || item
    const wantPack = !!(cardPackMode[item.id] && (currentItem.units_per_box || 1) > 1 && (currentItem.pack_price || 0) > 0)
    const stockDecrement = wantPack ? qty * (currentItem.units_per_box || 1) : qty
    if (!currentItem.is_active || !currentItem.price || currentItem.stock_quantity < stockDecrement) {
      toast.error(`Not enough stock. Available: ${currentItem.stock_quantity}`)
      return
    }
    const alreadyInCart = cart.some(c => c.id === item.id)
    const isNewAddon = isKitchenSent && !sentToKitchenIds.includes(item.id) && !alreadyInCart
    // Inherit cardPackMode selection when adding to cart
    if (!alreadyInCart) {
      setPackMode(prev => ({ ...prev, [item.id]: wantPack }))
    }
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === item.id)
      return idx >= 0 ? prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + qty } : c) : [{ ...currentItem, quantity: qty, isAddon: isNewAddon }, ...prev]
    })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_quantity: i.stock_quantity - stockDecrement } : i))
  }

  function handleOfferTap(offer) {
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === offer.id)
      if (idx >= 0) return prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + 1 } : c)
      return [{ ...offer, isOffer: true, quantity: 1, stock_quantity: 999, category: 'Offer', subcategory: 'Combo' }, ...prev]
    })
  }

  function updateQty(id, delta) {
    const cartItem = cart.find(c => c.id === id)
    if (!cartItem) return
    const isPackItem = packMode[id] && (cartItem.units_per_box || 1) > 1 && (cartItem.pack_price || 0) > 0
    const stockDelta = isPackItem ? delta * (cartItem.units_per_box || 1) : delta

    if (delta > 0) {
      const dbItem = items.find(i => i.id === id)
      if (!dbItem || dbItem.stock_quantity < stockDelta) {
        toast.error("Not enough stock available!")
        return
      }
    }

    setCart(prev => {
      const next = prev.map(c => c.id === id ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0)
      return next
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, stock_quantity: i.stock_quantity - stockDelta } : i))
  }
  
  function setExactQty(id, qty) {
    const cartItem = cart.find(c => c.id === id)
    if (!cartItem) return
    const isPackItem = packMode[id] && (cartItem.units_per_box || 1) > 1 && (cartItem.pack_price || 0) > 0
    const unitsPerBox = isPackItem ? (cartItem.units_per_box || 1) : 1
    if (qty <= 0) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, stock_quantity: i.stock_quantity + cartItem.quantity * unitsPerBox } : i))
      setCart(prev => prev.filter(c => c.id !== id))
    } else {
      const oldQty = cartItem.quantity
      const delta = qty - oldQty
      if (delta > 0) {
        const dbItem = items.find(i => i.id === id)
        if (!dbItem || dbItem.stock_quantity < delta * unitsPerBox) {
          toast.error("Not enough stock available!")
          return
        }
      }
      setItems(itemsPrev => itemsPrev.map(i => i.id === id ? { ...i, stock_quantity: i.stock_quantity - delta * unitsPerBox } : i))
      setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: qty } : c))
    }
  }

  // Payment UI
  function addPaymentSplit() {
    const half = Math.round(total / 2)
    setPayments(p => {
      if (p.length === 1) {
        return [
          { ...p[0], amount: half },
          { mode: 'ONLINE', subtype: 'UPI', amount: total - half }
        ]
      } else {
        return [...p, { mode: 'ONLINE', subtype: 'UPI', amount: Math.max(0, total - totalPaid) }]
      }
    })
  }
  function updatePayment(index, field, val) {
    setPayments(prev => {
      let next = prev.map((pay, i) => i === index ? { ...pay, [field]: val } : pay)
      if (next.length === 2 && field === 'amount') {
        const otherIndex = index === 0 ? 1 : 0
        const parsedVal = parseFloat(val) || 0
        const remainder = Math.max(0, total - parsedVal)
        next[otherIndex] = { ...next[otherIndex], amount: remainder }
      }
      return next
    })
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
        const { data: oldItems } = await supabase.from('order_items').select('item_id, quantity, price, sell_mode, items(units_per_box, pack_price)').eq('order_id', editingOrderId)
        if (oldItems) {
           for (const oi of oldItems) {
              if (!oi.item_id) continue
              const unitsPerBox = oi.items?.units_per_box || 1
              const isPackPrice = unitsPerBox > 1 && oi.items?.pack_price && Math.abs(oi.price - oi.items.pack_price) < 0.01
              const isPack = oi.sell_mode === 'pack' || isPackPrice
              const restoreQty = isPack ? oi.quantity * unitsPerBox : oi.quantity
              await supabase.rpc('decrement_stock', { p_item_id: oi.item_id, p_amount: -restoreQty })
           }
        }
      }

      // If billing from a table, kitchen order, or editing, update the existing order; otherwise create new
      let order
      if (editingOrderId || selectedTable?.current_order_id || kitchenOrderId) {
        const orderIdToUpdate = editingOrderId || selectedTable?.current_order_id || kitchenOrderId
        const { data: updatedOrder, error } = await supabase.from('orders')
          .update({ customer_id: customer?.id || null, subtotal, discount: calculatedDiscount, total, status: 'completed', order_type: orderType, received_by: user?.id && !String(user.id).startsWith('hardcoded') ? user.id : null, session_id: currentSessionId, created_at: getOrderTimestamp() })
          .eq('id', orderIdToUpdate)
          .select().single()
        if (error) throw error
        order = updatedOrder
        
        await supabase.from('khata_ledger').delete().eq('order_id', order.id)
        await supabase.from('advance_ledger').delete().eq('order_id', order.id)
        await supabase.from('order_items').delete().eq('order_id', order.id)
        await supabase.from('order_payments').delete().eq('order_id', order.id)

        // Replace order items with final cart
        await supabase.from('order_items').insert(cart.map(c => {
          const cIsPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
          const linePrice = cIsPack ? (c.pack_price || c.price) : c.price
          return {
            order_id: order.id,
            item_id: c.isOffer ? null : c.id,
            offer_id: c.isOffer ? c.id : null,
            quantity: c.quantity,
            price: linePrice,
            total: c.quantity * linePrice,
            sell_mode: cIsPack ? 'pack' : 'single'
          }
        }))
      } else {
        const { data: newOrder, error } = await supabase.from('orders').insert({
          customer_id: customer?.id || null, branch_id: target_branch, subtotal, discount: calculatedDiscount, total, status: 'completed',
          table_number: selectedTable?.table_number || null, order_type: orderType,
          received_by: user?.id && !String(user.id).startsWith('hardcoded') ? user.id : null, session_id: currentSessionId,
          created_at: getOrderTimestamp()
        }).select().single()
        if (error) throw error
        order = newOrder
        await supabase.from('order_items').insert(cart.map(c => {
          const cIsPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
          const linePrice = cIsPack ? (c.pack_price || c.price) : c.price
          return {
            order_id: order.id,
            item_id: c.isOffer ? null : c.id,
            offer_id: c.isOffer ? c.id : null,
            quantity: c.quantity,
            price: linePrice,
            total: c.quantity * linePrice,
            sell_mode: cIsPack ? 'pack' : 'single'
          }
        }))
      }
      
      // Real DB Stock deduction & Disposables Logic
      let cafeDishCount = 0;
      let maggiBowlCount = 0;

      for (const c of cart) {
        if (c.isOffer) {
          const { data: offerItems } = await supabase.from('offer_items').select('item_id, quantity').eq('offer_id', c.id)
          if (offerItems) {
            for (const oi of offerItems) {
              await supabase.rpc('decrement_stock', { p_item_id: oi.item_id, p_amount: oi.quantity * c.quantity })
              // Ingredients of combo items
              const { data: ingredients } = await supabase.from('item_ingredients').select('ingredient_item_id, quantity_per_unit').eq('item_id', oi.item_id)
              if (ingredients && ingredients.length > 0) {
                for (const ing of ingredients) {
                  await supabase.rpc('decrement_stock', { p_item_id: ing.ingredient_item_id, p_amount: ing.quantity_per_unit * (oi.quantity * c.quantity) })
                }
              }
            }
          }
        } else {
          // Pack-aware stock deduction: selling a pack deducts qty × units_per_box singles
          const cIsPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
          const stockDeduction = cIsPack ? c.quantity * (c.units_per_box || 1) : c.quantity
          await supabase.rpc('decrement_stock', { p_item_id: c.id, p_amount: stockDeduction })
          
          // Dynamic Recipe Ingredient Deduction
          const { data: ingredients } = await supabase.from('item_ingredients')
            .select('ingredient_item_id, quantity_per_unit').eq('item_id', c.id)
          
          if (ingredients && ingredients.length > 0) {
            for (const ing of ingredients) {
              const totalDeduction = ing.quantity_per_unit * c.quantity
              await supabase.rpc('decrement_stock', { p_item_id: ing.ingredient_item_id, p_amount: totalDeduction })
            }
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
            reason: `Order #${order.order_number || order.id.slice(0, 8)}`, order_id: order.id, recorded_by: user.username,
            created_at: order.created_at
          })
        }
        if (p.mode === 'ADVANCE') {
          await supabase.from('advance_ledger').insert({
            customer_id: customer.id, branch_id: target_branch, type: 'DEDUCTION', amount: parseFloat(p.amount),
            reason: `Order #${order.order_number || order.id.slice(0, 8)}`, order_id: order.id, recorded_by: user.username,
            created_at: order.created_at
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

      // Clear table cart from map & DB
      if (selectedTable) {
        await supabase.from('cafe_tables').update({ status: 'available', current_order_id: null }).eq('id', selectedTable.id)
        await supabase.from('pos_carts').delete().eq('table_id', selectedTable.id)
        setTableCarts(prev => { const n = { ...prev }; delete n[selectedTable.id]; return n })
        setCafeTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'available', current_order_id: null } : t))
        setSelectedTable(null)
      }
      // RESET POS (Blanking)
      setCart([]); setCustomer(null); setCustomerSearch(''); setOrderType('Dine-in'); setShowAddCustomer(false); setNewCustName('');
      setDiscountType('FLAT'); setDiscountValue(0);
      setPayments([{ mode: 'CASH', subtype: '', amount: 0 }])
      setCashGiven(0)
      setShowOrdersModal(false)
      setCart([])
      setKitchenOrderId(null)
      setSentToKitchenQtys({})
      const wasEditing = editingOrderId
      setEditingOrderId(null)
      setOrderDate(new Date().toISOString().split('T')[0])
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
    const dbItem = items.find(i => i.id === item.id) || item
    const wantPack = !!(cardPackMode[dbItem.id] && (dbItem.units_per_box || 1) > 1 && (dbItem.pack_price || 0) > 0)
    // Effective stock: for pack mode, need at least units_per_box singles
    const effectiveStock = wantPack ? Math.floor(dbItem.stock_quantity / (dbItem.units_per_box || 1)) : dbItem.stock_quantity
    if (!dbItem.is_active || !dbItem.price || effectiveStock <= 0) return
    if (tapTimer) {
      clearTimeout(tapTimer)
      tapTimer = null
      setQtyEditor(dbItem) // Double tap
    } else {
      tapTimer = setTimeout(() => {
        tapTimer = null
        addToCart(dbItem, 1) // Single tap
      }, 250)
    }
  }

  function printBillPDF(r) {
    const isBhat = (branchId || selectedBranch) === 'bhat'
    if (!isBhat) return
    const rows = r.cart.map(c => {
      const cIsPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
      const linePrice = cIsPack ? (c.pack_price || c.price) : c.price
      const label = `${c.name}${c.variant ? ' <small>('+c.variant+')</small>' : ''}${cIsPack ? ` <small style="color:#6366f1">[Pack ×${c.units_per_box}pcs]</small>` : ''}`
      return `<tr><td>${label}</td><td style="text-align:center">${c.quantity}</td><td style="text-align:right">₹${(linePrice*c.quantity).toLocaleString('en-IN')}</td></tr>`
    }).join('')
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
    if (!w) {
      toast.error('Popup blocked! Please allow popups for this site to print receipts.', { id: 'popup-blocked' })
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { if (w) { w.print(); w.close() } }, 400)
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

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-5rem)] -m-4 md:-m-6 bg-ink-100 dark:bg-ink-950 relative overflow-hidden">
      
      {/* Manage Orders Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm">
          <div className="bg-ink-50 dark:bg-ink-950 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            <div className="flex justify-between items-center p-4 border-b border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900">
              <h3 className="font-black text-lg text-ink-900 dark:text-white flex items-center gap-2"><Receipt size={20} className="text-ember"/> Manage Today's Orders</h3>
              <div className="flex gap-2">
                {!branchId && (
                  <select className="input font-bold h-8 py-0" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                    <option value="gurukul">Gurukul</option><option value="bhat">Bhat</option><option value="visat">Visat</option>
                  </select>
                )}
                <button onClick={() => setShowOrdersModal(false)} className="text-ink-400 hover:text-red-500"><X size={24}/></button>
              </div>
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

      {/* ── Table Switcher Dropdown (Bhat only, in POS mode) ───────────────────── */}
      {isBhatBranch && cafeTables.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 flex-shrink-0 shadow-sm z-30">
          <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest flex-shrink-0">Table Context:</span>
          <select 
            className="flex-1 bg-ink-50 dark:bg-ink-950 border border-ink-200 dark:border-ink-800 text-sm font-bold text-ink-900 dark:text-white p-2 rounded-xl focus:ring-2 focus:ring-ember outline-none cursor-pointer"
            value={selectedTable?.id || 'direct'}
            onChange={e => {
              const val = e.target.value
              if (val === 'direct') {
                setSelectedTable(null)
                setCustomer(null)
                setCustBalances({ khata: 0, advance: 0 })
                setSelectedTable(null)
                setCart([])
                setKitchenOrderId(null)
                setSentToKitchenQtys({})
              } else {
                const tbl = cafeTables.find(t => t.id === val)
                if (tbl) switchTable(tbl)
              }
            }}
          >
            <option value="direct">🚀 Takeaway / Zomato (No Table)</option>
            {cafeTables.map(t => {
              const tc = tableCarts[t.id]
              const itemCount = tc?.cart?.reduce((s, c) => s + c.quantity, 0) || 0
              const label = `Table ${t.table_number} ${itemCount > 0 ? `(${itemCount} items)` : t.status === 'occupied' ? '(Occupied)' : ''}`
              return <option key={t.id} value={t.id}>{label}</option>
            })}
          </select>
          <button 
            onClick={clearAllTables}
            className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 px-2 py-2 rounded-lg border border-red-200 dark:border-red-800 flex-shrink-0"
            title="Reset all tables to available"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Top Search Bar (Menu + Customer) */}
        <div className="p-3 bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 flex flex-col md:flex-row items-center gap-3 shadow-sm z-20">
          <button onClick={() => { fetchRecentOrders(); setShowOrdersModal(true); }} className="btn-secondary w-full md:w-auto md:px-4 py-2.5 md:mr-2 shrink-0 border-ink-300 hover:bg-ink-100 flex items-center justify-center gap-2">
            <Receipt size={16}/> Manage Orders
          </button>
          
          {/* POS Date Selection */}
          <div className="flex items-center gap-2 bg-ink-50 dark:bg-ink-950 border border-ink-200 dark:border-ink-800 rounded-xl px-3 py-2 shrink-0 relative transition-all duration-200 hover:border-ink-300 dark:hover:border-ink-700">
            <Calendar 
              size={16} 
              className={orderDate === new Date().toISOString().split('T')[0] ? "text-ink-400" : "text-amber-500 animate-pulse"} 
            />
            <input 
              type="date" 
              className="bg-transparent border-none text-xs font-bold text-ink-700 dark:text-ink-300 outline-none cursor-pointer focus:ring-0"
              value={orderDate}
              onChange={e => setOrderDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            {orderDate !== new Date().toISOString().split('T')[0] && (
              <span className="text-[10px] font-black text-white bg-amber-500 px-2 py-0.5 rounded-lg uppercase tracking-wider animate-bounce shadow-sm">
                Backdated
              </span>
            )}
          </div>
          
          <div className="flex w-full gap-3">
            {/* 1. Menu Search */}
            <div className="flex-1 relative flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                <input 
                  type="text" 
                  placeholder="Search Cafe Menu..." 
                  className="w-full bg-ink-50 dark:bg-ink-950 border border-ink-200 dark:border-ink-800 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:ring-2 focus:ring-ember outline-none transition-all"
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                />
                {itemSearch && <button onClick={() => setItemSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"><X size={14}/></button>}
              </div>
              <button
                onClick={() => { setShowBarcodeModal(true); startCameraScanning(); }}
                title="Scan Barcode to search product name"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-950 text-ink-600 dark:text-ink-300 hover:border-ember hover:text-ember transition-all text-xs font-semibold shrink-0"
              >
                <ScanLine size={15} />
                <span className="hidden sm:inline">Scan</span>
              </button>
            </div>

            {/* 2. Customer Search / Selected Customer */}
            {customer ? (
              isEditingCustomer ? (
                <div className="flex-1 bg-ink-50 dark:bg-ink-950 rounded-xl p-3 border border-indigo-200 dark:border-indigo-800 space-y-2 relative z-30">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Edit Customer</span>
                    <button onClick={() => setIsEditingCustomer(false)} className="text-ink-400 hover:text-ink-900"><X size={14}/></button>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="input text-xs w-full py-1.5 bg-white"
                      placeholder="Customer Name"
                      value={editCustName}
                      onChange={e => setEditCustName(e.target.value)}
                    />
                    <input
                      type="tel"
                      maxLength={10}
                      className="input text-xs w-full py-1.5 bg-white text-ink-500 font-mono"
                      placeholder="Mobile Number"
                      value={editCustMobile}
                      onChange={e => setEditCustMobile(e.target.value.replace(/\D/g, ''))}
                    />
                    <button
                      onClick={async () => {
                        if (!editCustName.trim() || editCustMobile.trim().length !== 10) {
                          toast.error('Enter valid name and 10-digit mobile number')
                          return
                        }
                        setSavingCust(true)
                        try {
                          const { data, error } = await supabase
                            .from('customers')
                            .update({ name: editCustName.trim(), mobile_number: editCustMobile.trim() })
                            .eq('id', customer.id)
                            .select()
                            .single()
                          if (error) throw error
                          setCustomer(data)
                          setIsEditingCustomer(false)
                          toast.success('Customer updated!')
                        } catch (err) {
                          toast.error(err.message)
                        } finally {
                          setSavingCust(false)
                        }
                      }}
                      disabled={savingCust}
                      className="btn-primary w-full py-2 text-xs"
                    >
                      {savingCust ? 'Saving...' : 'Apply Changes'}
                    </button>
                  </div>
                </div>
              ) : (
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
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditCustName(customer.name || ''); setEditCustMobile(customer.mobile_number || ''); setIsEditingCustomer(true); }} className="p-1.5 text-ink-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-md transition-colors"><Edit2 size={14}/></button>
                    <button onClick={deselectCustomer} className="p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"><X size={16}/></button>
                  </div>
                </div>
              )
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
              {/* Active Offers Ribbon */}
              {activeOffers.length > 0 && (
                <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-3 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 mb-6">
                  <h3 className="font-black text-indigo-900 dark:text-indigo-300 text-sm mb-3 uppercase tracking-wider px-1 flex items-center gap-2">🔥 Active Combos & Offers</h3>
                  <div className="flex overflow-x-auto pb-2 -mx-1 px-1 gap-2 no-scrollbar snap-x">
                    {activeOffers.map(offer => {
                      const inCart = cart.find(c => c.id === offer.id)
                      const qty = inCart ? inCart.quantity : 0
                      return (
                        <button key={offer.id} 
                          onClick={() => handleOfferTap(offer)}
                          className={`relative flex-shrink-0 snap-start w-[140px] h-[110px] flex flex-col justify-between p-2.5 rounded-xl text-left select-none transition-all
                            ${qty > 0 ? 'bg-indigo-900 border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 
                              'bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-700 hover:border-indigo-400'}
                          `}>
                          {qty > 0 && (
                            <div className="absolute -top-2 -right-2 bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow-md z-10">
                              {qty}
                            </div>
                          )}
                          <div>
                            <div className={`font-black text-sm leading-tight line-clamp-2 ${qty > 0 ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
                              {offer.name}
                            </div>
                            <div className={`text-[10px] mt-0.5 font-bold ${qty > 0 ? 'text-indigo-200' : 'text-zinc-500'}`}>
                              {offer.description || 'Combo Deal'}
                            </div>
                          </div>
                          <div className="text-right mt-1">
                            <span className={`font-black text-lg ${qty > 0 ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`}>₹{offer.price}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Regular Items */}
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
                        const wantPack = !!(cardPackMode[item.id] && (item.units_per_box || 1) > 1 && (item.pack_price || 0) > 0)
                        const availablePacks = wantPack ? Math.floor(item.stock_quantity / (item.units_per_box || 1)) : null
                        // Out-of-stock check is pack-aware
                        const isOut = wantPack ? availablePacks <= 0 : item.stock_quantity <= 0
                        const isInactive = !item.is_active || !item.price
                        const packNotAvailable = (item.units_per_box || 1) > 1 && (item.pack_price || 0) > 0 && item.stock_quantity < (item.units_per_box || 1)
                        
                        return (
                          <button key={item.id} 
                            onClick={() => handleCardTap(item)}
                            onContextMenu={(e) => { e.preventDefault(); setQtyEditor(item) }}
                            disabled={isInactive || (isOut && qty === 0)}
                            className={`relative flex-shrink-0 snap-start w-[100px] min-h-[100px] h-auto flex flex-col justify-between p-2.5 rounded-xl text-left select-none transition-all
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
                              <div className={`font-bold text-sm leading-tight ${qty > 0 ? 'text-white' : isInactive ? 'text-ink-400' : 'text-white'}`}>
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
                                {isInactive ? 'NO PRICE' : (() => {
                                  const wantPack = cardPackMode[item.id] && (item.units_per_box || 1) > 1 && (item.pack_price || 0) > 0
                                  return wantPack ? `₹${item.pack_price}` : `₹${item.price}`
                                })()}
                              </div>
                              {isOut && qty === 0 && !isInactive && (
                                <div className="text-[9px] font-bold text-red-400 uppercase bg-red-950/50 px-1 rounded">Out</div>
                              )}
                            </div>

                            {/* Pack toggle pill — only for pack-enabled non-BB-Cafe items */}
                            {(item.units_per_box || 1) > 1 && (item.pack_price || 0) > 0 && item.category !== 'BB Cafe' && (
                              <div
                                onClick={e => {
                                  e.stopPropagation()
                                  if (!cardPackMode[item.id] && packNotAvailable) return // can't switch to pack if not enough stock
                                  setCardPackMode(p => ({ ...p, [item.id]: !p[item.id] }))
                                }}
                                className={`mt-1 flex rounded overflow-hidden border text-[8px] font-black ${
                                  !cardPackMode[item.id] && packNotAvailable ? 'border-ink-700 opacity-50 cursor-not-allowed' : 'border-ink-600 cursor-pointer'
                                }`}
                                title={packNotAvailable ? `Need ≥${item.units_per_box} pcs in stock for pack` : ''}
                              >
                                <span className={`px-1.5 py-0.5 transition-colors ${!cardPackMode[item.id] ? 'bg-white text-ink-900' : 'bg-transparent text-ink-400'}`}>1pc</span>
                                <span className={`px-1.5 py-0.5 transition-colors ${cardPackMode[item.id] ? 'bg-indigo-500 text-white' : 'bg-transparent text-ink-400'} ${packNotAvailable ? 'line-through' : ''}`}>
                                  {availablePacks !== null ? `📦${availablePacks}` : '📦bx'}
                                </span>
                              </div>
                            )}
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
          <h2 className="font-black text-ink-900 dark:text-white flex items-center gap-2">
            <ShoppingCart size={18}/>
            {selectedTable ? (
              <span>Table <span className="text-ember">{selectedTable.table_number}</span> Cart ({cart.length})</span>
            ) : (
              <span>Cart ({cart.length})</span>
            )}
          </h2>
          {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs font-bold text-red-500 hover:text-red-600 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded">Clear</button>}
        </div>

        {/* Loading overlay during table switch */}
        {loadingTable && (
          <div className="absolute inset-0 z-30 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white dark:bg-ink-900 rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl">
              <div className="w-10 h-10 border-4 border-ember border-t-transparent rounded-full animate-spin" />
              <p className="font-black text-sm text-ink-900 dark:text-white uppercase tracking-widest">Loading Table...</p>
            </div>
          </div>
        )}

        {/* Kitchen Sent Banner */}
        {isKitchenSent && (
          <div className="mx-3 mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            <Flame size={14} className="text-amber-400 flex-shrink-0" />
            <span className="text-xs font-bold text-amber-300">Order in Kitchen — add items freely</span>
          </div>
        )}

        {/* Cart List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-ink-50 dark:bg-ink-950/30">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-ink-300 dark:text-ink-700">
              <Receipt size={48} className="mb-4 opacity-50" />
              <p className="font-medium text-sm">Cart is empty</p>
            </div>
          ) : (
            cart.map(c => {
              const isPack = packMode[c.id] && (c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0
              const linePrice = isPack ? (c.pack_price || c.price) : c.price
              return (
              <div key={c.id} className="flex gap-2 items-center bg-white dark:bg-ink-900 p-2.5 rounded-xl border border-ink-200 dark:border-ink-800 shadow-sm">
                <div className="flex flex-col items-center gap-1 bg-ink-50 dark:bg-ink-800/50 rounded-lg p-1 border border-ink-200 dark:border-ink-700">
                  <button onClick={() => updateQty(c.id, 1)} className="w-7 h-6 flex items-center justify-center hover:bg-ink-200 dark:hover:bg-ink-700 rounded active:scale-95"><Plus size={14} /></button>
                  <span className="text-sm font-black w-7 text-center">{c.quantity}</span>
                  <button onClick={() => updateQty(c.id, -1)} className="w-7 h-6 flex items-center justify-center hover:bg-ink-200 dark:hover:bg-ink-700 rounded active:scale-95"><Minus size={14} /></button>
                </div>
                <div className="flex-1 min-w-0 pl-2">
                  <p className="font-bold text-sm text-ink-900 dark:text-white truncate leading-tight">
                    {c.name}
                    {c.isAddon && <span className="ml-1 text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">ADD-ON</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] font-bold text-ink-500">{c.variant && `${c.variant} • `}₹{linePrice}</p>
                    {(c.units_per_box || 1) > 1 && (c.pack_price || 0) > 0 && (
                      <div className="flex rounded-md overflow-hidden border border-ink-200 dark:border-ink-700 text-[9px] font-black">
                        <button
                          onClick={() => setPackMode(p => ({ ...p, [c.id]: false }))}
                          className={`px-1.5 py-0.5 transition-colors ${!isPack ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900' : 'bg-white dark:bg-ink-900 text-ink-500 hover:bg-ink-100'}`}
                        >Single</button>
                        <button
                          onClick={() => setPackMode(p => ({ ...p, [c.id]: true }))}
                          className={`px-1.5 py-0.5 transition-colors ${isPack ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-ink-900 text-ink-500 hover:bg-ink-100'}`}
                        >Pack</button>
                      </div>
                    )}
                  </div>
                </div>
                {c.category === 'BB Cafe' && (
                  <div className="flex-shrink-0 pl-1">
                    {(sentToKitchenQtys[c.id] || 0) >= c.quantity ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                        <CheckCircle2 size={12} /> Sent
                      </span>
                    ) : (
                      <button
                        onClick={() => sendIndividualToKitchen(c)}
                        className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50 transition-colors active:scale-95 animate-pulse"
                      >
                        <Flame size={12} className="text-amber-500 animate-bounce" />
                        {(sentToKitchenQtys[c.id] || 0) > 0 ? 'Send Addon' : 'Send'}
                      </button>
                    )}
                  </div>
                )}
                <div className="text-right pl-2 pr-1">
                  <p className="font-black text-base text-ink-900 dark:text-white leading-tight">₹{(linePrice * c.quantity).toLocaleString('en-IN')}</p>
                </div>
              </div>
            )})
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

              {/* Discount — collapsible */}
              {discountOpen && (
                <div className="flex gap-2 items-center p-2 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 animate-slide-up">
                  <button onClick={() => setDiscountType('FLAT')} className={`px-3 py-1.5 text-xs font-black rounded-lg flex-shrink-0 ${discountType === 'FLAT' ? 'bg-ember text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>₹ Flat</button>
                  <button onClick={() => setDiscountType('PERCENT')} className={`px-3 py-1.5 text-xs font-black rounded-lg flex-shrink-0 ${discountType === 'PERCENT' ? 'bg-ember text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>% Off</button>
                  <input type="number" min="0" step={discountType === 'PERCENT' ? '1' : '0.5'} className="input flex-1 text-right font-black text-lg"
                    value={discountValue} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} placeholder="0" autoFocus />
                  {calculatedDiscount > 0 && <span className="text-sm font-black text-emerald-600 flex-shrink-0">−₹{calculatedDiscount.toFixed(0)}</span>}
                </div>
              )}

              {/* Payments */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Payment Mode</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setDiscountOpen(d => !d); if (!discountOpen) setTimeout(() => {}, 50) }}
                      className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${discountValue > 0 ? 'bg-ember text-white' : 'bg-ember/10 text-ember hover:bg-ember/20'}`}
                    >
                      🏷️ {discountValue > 0 ? `−₹${calculatedDiscount.toFixed(0)}` : 'Discount'}
                    </button>
                    <button onClick={addPaymentSplit} className="text-[10px] font-bold text-ember bg-ember/10 hover:bg-ember/20 px-2 py-1 rounded transition-colors">Split</button>
                  </div>
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
            {/* Direct checkout option for Bhat branch / always available */}
            {payments.length === 1 && payments[0].mode === 'CASH' ? (
              <button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 flex flex-col justify-center items-center leading-none" onClick={handleExactCash} disabled={cart.length === 0 || loading}>
                <span className="text-[10px] tracking-widest uppercase opacity-80 mb-1">Collect Payment</span>
                <span className="text-xl">₹{total}</span>
              </button>
            ) : (
              <button className="flex-1 bg-ember hover:bg-ember-600 text-white font-black py-4 rounded-xl shadow-[0_8px_20px_rgba(255,100,0,0.3)] transition-all active:scale-95 flex flex-col justify-center items-center leading-none disabled:opacity-50" onClick={() => handleBill()} disabled={cart.length === 0 || loading || Math.abs(total - totalPaid) > 0.01}>
                <span className="text-[10px] tracking-widest uppercase opacity-80 mb-1">Collect Payment</span>
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

      {/* Barcode Scanner Modal */}
      {showBarcodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/50">
              <div>
                <h3 className="font-black text-zinc-900 dark:text-white flex items-center gap-2"><ScanLine size={18} className="text-ember" /> Barcode Lookup</h3>
                <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest mt-0.5">Powered by OpenFoodFacts</p>
              </div>
              <button onClick={closeBarcodeModal} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Camera View */}
              <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                {scannerActive ? (
                  <>
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                    {/* Scan frame overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-32 border-2 border-ember rounded-lg relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-ember rounded-tl" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-ember rounded-tr" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-ember rounded-bl" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-ember rounded-br" />
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-ember/60 animate-pulse" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-0 right-0 text-center">
                      <span className="text-[10px] font-black text-white/80 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full">Point at barcode</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-400">
                    <Camera size={40} className="opacity-30" />
                    <p className="text-xs font-semibold">Camera not active</p>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="flex gap-2">
                {!scannerActive ? (
                  <button onClick={startCameraScanning} className="flex-1 flex items-center justify-center gap-2 bg-ember text-white font-bold py-2.5 rounded-xl hover:bg-ember/90 transition-all active:scale-95 text-sm">
                    <Camera size={16} /> Start Camera Scan
                  </button>
                ) : (
                  <button onClick={stopCameraScanning} className="flex-1 flex items-center justify-center gap-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold py-2.5 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all text-sm">
                    <CameraOff size={16} /> Stop Camera
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Or type barcode</span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
              </div>

              {/* Manual Entry */}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1 font-mono tracking-wider bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-white px-3 py-2 rounded-xl text-sm focus:ring-2 focus:ring-ember outline-none"
                  placeholder="e.g. 8901491108266"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lookupBarcode(barcodeInput)}
                  autoFocus={!scannerActive}
                />
                <button
                  onClick={() => lookupBarcode(barcodeInput)}
                  disabled={!barcodeInput.trim() || barcodeLoading}
                  className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 text-sm"
                >
                  {barcodeLoading ? '…' : 'Lookup'}
                </button>
              </div>

              {/* Error */}
              {barcodeError && !barcodeResult && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 font-semibold">
                  ⚠️ {barcodeError}
                </div>
              )}

              {/* Result */}
              {barcodeResult && (
                <div className={`rounded-xl p-4 border ${barcodeResult.found ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                  {barcodeResult.found ? (
                    <>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Product Found</p>
                      <p className="font-black text-zinc-900 dark:text-white text-base">{barcodeResult.name}</p>
                      {barcodeResult.brand && <p className="text-xs text-zinc-500 mt-0.5">{barcodeResult.brand}{barcodeResult.qty ? ` · ${barcodeResult.qty}` : ''}</p>}
                      <p className="text-[10px] text-zinc-400 font-mono mt-1">{barcodeResult.code}</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => applyBarcodeResult(barcodeResult.name)} className="flex-1 text-xs font-black bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 transition-all active:scale-95">
                          🔍 Search in Menu
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">❌ Barcode <span className="font-mono">{barcodeResult.code}</span> not found in database.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
