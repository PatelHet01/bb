import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Search, Filter, ArrowUpDown, Edit2, X, ArrowLeft, Download, Plus, Minus, Trash2 } from 'lucide-react'

const PAYMENT_FILTERS = ['All', 'CASH', 'UPI', 'ONLINE', 'KHATA', 'ADVANCE', 'Cancelled']
const SORT_OPTIONS = ['Newest', 'Oldest', 'Highest Amount', 'Lowest Amount']
const STATUS_BADGE = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  new:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  preparing:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ready:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}

export default function OrdersPage() {
  const { branchId, role } = useAuthStore()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [payFilter, setPayFilter] = useState('All')
  const [sortBy, setSortBy] = useState('Newest')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [cancellingId, setCancellingId] = useState(null)
  const [editingOrder, setEditingOrder] = useState(null)
  const [allItems, setAllItems] = useState([])
  const [itemSearch, setItemSearch] = useState('')

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustMobile, setNewCustMobile] = useState('')
  const [isEditingCustomer, setIsEditingCustomer] = useState(false)
  const [editCustName, setEditCustName] = useState('')
  const [editCustMobile, setEditCustMobile] = useState('')

  useEffect(() => {
    if (customerSearch.trim().length < 2) {
      setCustomerResults([])
      return
    }
    const delayDebounceFn = setTimeout(async () => {
      let q = supabase.from('customers').select('*')
      const isNum = /^\d+$/.test(customerSearch)
      if (isNum) {
        q = q.ilike('mobile_number', `%${customerSearch}%`)
      } else {
        q = q.or(`name.ilike.%${customerSearch}%,username.ilike.%${customerSearch}%`)
      }
      if (branchId) {
        q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
      }
      const { data } = await q.limit(10)
      setCustomerResults(data || [])
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [customerSearch, branchId])

  const isSuperAdmin = role === 'super_admin'

  useEffect(() => { 
    fetchOrders()
    fetchAllItems()
  }, [branchId])

  async function fetchAllItems() {
    let q = supabase.from('items').select('id, name, variant, price').eq('is_active', true).eq('is_archived', false)
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setAllItems(data || [])
  }

  async function fetchOrders() {
    setLoading(true)
    let q = supabase
      .from('orders')
      .select(`
        id, order_number, created_at, total, subtotal, discount, status, table_number, order_type,
        branch_id,
        customers(id, name, mobile_number),
        order_items(id, item_id, quantity, price, total, items(name, variant)),
        order_payments(id, mode, amount)
      `)
      .order('created_at', { ascending: false })
    if (branchId) q = q.eq('branch_id', branchId)
    const { data, error } = await q
    if (error) { toast.error('Failed to load orders'); setLoading(false); return }
    setOrders(data || [])
    setLoading(false)
  }

  async function handleCancel(order) {
    if (!window.confirm(`Cancel order ${order.order_number || '#' + order.id.slice(0,8).toUpperCase()}? This cannot be undone.`)) return
    setCancellingId(order.id)
    // Restore stock for each item
    const { data: oldItems } = await supabase.from('order_items').select('item_id, quantity').eq('order_id', order.id)
    if (oldItems) {
      for (const oi of oldItems) {
        await supabase.rpc('decrement_stock', { p_item_id: oi.item_id, p_amount: -oi.quantity })
      }
    }
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o))
    toast.success('Order cancelled & stock restored')
    setCancellingId(null)
  }

  function handleEditNav(order) {
    setEditingOrder({
      ...order,
      newStatus: order.status,
      newPaymentMode: (order.order_payments && order.order_payments.length > 0) ? order.order_payments[0].mode : 'CASH',
      selectedCustomer: order.customers || null,
      editingItems: order.order_items.map(oi => ({
        id: oi.id, // existing order_item id
        item_id: oi.item_id,
        name: oi.items?.name,
        variant: oi.items?.variant,
        price: oi.price,
        quantity: oi.quantity,
        original_quantity: oi.quantity // to track stock diffs
      }))
    })
    setItemSearch('')
    setCustomerSearch('')
    setCustomerResults([])
    setShowAddCustomer(false)
    setNewCustName('')
    setNewCustMobile('')
    setIsEditingCustomer(false)
    setEditCustName(order.customers?.name || '')
    setEditCustMobile(order.customers?.mobile_number || '')
  }

  function addEditItem(item) {
    setEditingOrder(prev => {
      const existing = prev.editingItems.find(i => i.item_id === item.id)
      if (existing) {
        return { ...prev, editingItems: prev.editingItems.map(i => i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return {
        ...prev,
        editingItems: [...prev.editingItems, {
          id: null, // new item
          item_id: item.id,
          name: item.name,
          variant: item.variant,
          price: item.price,
          quantity: 1,
          original_quantity: 0
        }]
      }
    })
    setItemSearch('')
  }

  function updateEditItemQty(itemId, delta) {
    setEditingOrder(prev => ({
      ...prev,
      editingItems: prev.editingItems.map(i => {
        if (i.item_id === itemId) {
          const newQ = i.quantity + delta
          return { ...i, quantity: newQ > 0 ? newQ : 1 }
        }
        return i
      })
    }))
  }

  function removeEditItem(itemId) {
    setEditingOrder(prev => ({
      ...prev,
      editingItems: prev.editingItems.filter(i => i.item_id !== itemId)
    }))
  }

  async function saveEditedOrder(e) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editingOrder.newStatus === 'cancelled' && editingOrder.status !== 'cancelled') {
        return handleCancel(editingOrder)
      }

      let finalCustomerId = editingOrder.selectedCustomer?.id || null

      if (showAddCustomer && newCustName.trim() && newCustMobile.trim().length === 10) {
        const username = newCustName.split(' ')[0].toLowerCase() + Math.floor(Math.random() * 1000)
        const { data: newCust, error: custErr } = await supabase.from('customers').insert({
          name: newCustName,
          mobile_number: newCustMobile,
          username,
          ghoda_coins: 0,
          registration_type: 'admin',
          branch_id: branchId || 'gurukul'
        }).select().single()

        if (custErr) throw custErr
        if (newCust) finalCustomerId = newCust.id
      } else if (isEditingCustomer && editingOrder.selectedCustomer?.id && editCustName.trim() && editCustMobile.trim().length === 10) {
        const { error: editErr } = await supabase.from('customers').update({
          name: editCustName,
          mobile_number: editCustMobile
        }).eq('id', editingOrder.selectedCustomer.id)

        if (editErr) throw editErr
      }

      // Calculate new totals
      const newSubtotal = editingOrder.editingItems.reduce((sum, i) => sum + (i.price * i.quantity), 0)
      const newTotal = newSubtotal - (editingOrder.discount || 0) // simplify tax for quick edit if needed, assuming total approx subtotal here
      
      // Update order details
      await supabase.from('orders').update({ 
        status: editingOrder.newStatus,
        subtotal: newSubtotal,
        total: newTotal,
        customer_id: finalCustomerId
      }).eq('id', editingOrder.id)
      
      // Update payments
      if (editingOrder.order_payments && editingOrder.order_payments.length > 0) {
        await supabase.from('order_payments')
          .update({ mode: editingOrder.newPaymentMode, amount: newTotal })
          .eq('id', editingOrder.order_payments[0].id)
      } else if (editingOrder.newPaymentMode) {
        await supabase.from('order_payments').insert({
           order_id: editingOrder.id,
           mode: editingOrder.newPaymentMode,
           amount: newTotal
        })
      }

      // Handle Items & Stock
      // 1. Process removals and decrements (restore stock)
      for (const orig of editingOrder.order_items) {
        const curr = editingOrder.editingItems.find(i => i.item_id === orig.item_id)
        if (!curr) {
          // Item completely removed
          await supabase.from('order_items').delete().eq('id', orig.id)
          await supabase.rpc('decrement_stock', { p_item_id: orig.item_id, p_amount: -orig.quantity })
        } else if (curr.quantity < orig.quantity) {
          // Quantity decreased
          const diff = orig.quantity - curr.quantity
          await supabase.from('order_items').update({ quantity: curr.quantity, total: curr.price * curr.quantity }).eq('id', orig.id)
          await supabase.rpc('decrement_stock', { p_item_id: orig.item_id, p_amount: -diff })
        }
      }

      // 2. Process additions and increments (deduct stock)
      for (const curr of editingOrder.editingItems) {
        if (!curr.id) {
          // Brand new item added
          await supabase.from('order_items').insert({
            order_id: editingOrder.id,
            item_id: curr.item_id,
            quantity: curr.quantity,
            price: curr.price,
            total: curr.price * curr.quantity
          })
          await supabase.rpc('decrement_stock', { p_item_id: curr.item_id, p_amount: curr.quantity })
        } else if (curr.quantity > curr.original_quantity) {
          // Quantity increased
          const diff = curr.quantity - curr.original_quantity
          await supabase.from('order_items').update({ quantity: curr.quantity, total: curr.price * curr.quantity }).eq('id', curr.id)
          await supabase.rpc('decrement_stock', { p_item_id: curr.item_id, p_amount: diff })
        }
      }

      toast.success('Order updated successfully')
      setEditingOrder(null)
      fetchOrders()
    } catch (err) {
      toast.error('Failed to update order')
      setLoading(false)
    }
  }

  function exportCSV() {
    const rows = [['Order ID', 'Date', 'Time', 'Branch', 'Customer', 'Mobile', 'Items', 'Total', 'Payment Mode', 'Status']]
    filteredOrders.forEach(o => {
      const items = (o.order_items || []).map(oi => `${oi.quantity}x ${oi.items?.name}`).join('; ')
      const payments = (o.order_payments || []).map(p => p.mode).join('+')
      const dt = new Date(o.created_at)
      rows.push([
        o.order_number || o.id.slice(0,8).toUpperCase(),
        dt.toLocaleDateString('en-IN'),
        dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        o.branch_id,
        o.customers?.name || 'Guest',
        o.customers?.mobile_number || '',
        items,
        o.total,
        payments,
        o.status
      ])
    })
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orders_export_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const filteredOrders = useMemo(() => {
    let result = [...orders]
    
    // Date filter
    if (dateFrom) result = result.filter(o => o.created_at >= dateFrom)
    if (dateTo) result = result.filter(o => o.created_at <= dateTo + 'T23:59:59')
    
    // Payment/Status filter
    if (payFilter === 'Cancelled') {
      result = result.filter(o => o.status === 'cancelled')
    } else if (payFilter !== 'All') {
      result = result.filter(o =>
        (o.order_payments || []).some(p =>
          p.mode === payFilter || (payFilter === 'ONLINE' && ['UPI','GPAY','PHONEPE','CREDIT_CARD','DEBIT_CARD'].includes(p.mode))
        )
      )
    }
    
    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(o =>
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.customers?.name || '').toLowerCase().includes(q) ||
        (o.customers?.mobile_number || '').includes(q) ||
        (o.id || '').toLowerCase().includes(q)
      )
    }
    
    // Sort
    if (sortBy === 'Newest') result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    else if (sortBy === 'Oldest') result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    else if (sortBy === 'Highest Amount') result.sort((a, b) => b.total - a.total)
    else if (sortBy === 'Lowest Amount') result.sort((a, b) => a.total - b.total)
    
    return result
  }, [orders, search, payFilter, sortBy, dateFrom, dateTo])

  // Revenue = only non-cancelled orders
  const totalRevenue = useMemo(() =>
    filteredOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)
  , [filteredOrders])

  const orderCount = filteredOrders.filter(o => o.status !== 'cancelled').length
  const cancelledCount = filteredOrders.filter(o => o.status === 'cancelled').length

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/admin/dashboard" className="p-2 rounded-xl bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 transition-colors">
            <ArrowLeft size={16} className="text-ink-600 dark:text-ink-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight">All Orders</h1>
            <p className="text-sm text-ink-500 mt-0.5">
              {orderCount} completed · {cancelledCount} cancelled · Revenue: <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{totalRevenue.toLocaleString('en-IN')}</span>
            </p>
          </div>
        </div>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            className="input pl-9 w-full text-sm"
            placeholder="Search order ID, customer name, mobile..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Date range */}
        <div className="flex gap-2 items-center">
          <input type="date" className="input text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-ink-400 text-sm">to</span>
          <input type="date" className="input text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {/* Sort */}
        <select className="input text-sm w-40" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {PAYMENT_FILTERS.map(f => (
          <button key={f} onClick={() => setPayFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              payFilter === f
                ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 dark:border-white'
                : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-400 hover:border-ink-400 dark:hover:border-ink-500'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800/50 border-b border-ink-100 dark:border-ink-800">
              <tr>
                {['Order ID', 'Date / Time', 'Branch', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Actions'].map(h => (
                  <th key={h} className="tbl-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {loading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="p-3"><div className="skeleton h-8 w-full" /></td></tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-ink-400 font-medium">No orders found</td></tr>
              ) : filteredOrders.map(order => {
                const isCancelled = order.status === 'cancelled'
                const dt = new Date(order.created_at)
                const payModes = [...new Set((order.order_payments || []).map(p => p.mode))]
                const itemCount = (order.order_items || []).reduce((s, oi) => s + oi.quantity, 0)
                const itemSummary = (order.order_items || []).slice(0, 2).map(oi => `${oi.quantity}× ${oi.items?.name || '?'}`).join(', ') +
                  (order.order_items?.length > 2 ? ` +${order.order_items.length - 2} more` : '')

                return (
                  <tr key={order.id} className={`tbl-row group ${isCancelled ? 'opacity-60 bg-red-50/30 dark:bg-red-900/5' : ''}`}>
                    {/* Order ID */}
                    <td className="tbl-cell">
                      <span className={`font-mono text-xs font-bold ${isCancelled ? 'text-red-500 line-through' : 'text-ember'}`}>
                        {order.order_number || '#' + order.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    {/* Date/Time */}
                    <td className="tbl-cell whitespace-nowrap text-ink-600 dark:text-ink-400">
                      <div className="text-xs font-semibold">{dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</div>
                      <div className="text-[10px] text-ink-400">{dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    {/* Branch */}
                    <td className="tbl-cell">
                      <span className="badge-default text-[10px] capitalize">{order.branch_id}</span>
                    </td>
                    {/* Customer */}
                    <td className="tbl-cell max-w-[120px]">
                      <div className="font-semibold text-ink-900 dark:text-white truncate">
                        {order.customers?.name || <span className="italic text-ink-400">Guest</span>}
                      </div>
                      {order.customers?.mobile_number && (
                        <div className="text-[10px] text-ink-400 font-mono">{order.customers.mobile_number}</div>
                      )}
                      {order.table_number && <div className="text-[10px] text-ink-400">T-{order.table_number}</div>}
                    </td>
                    {/* Items */}
                    <td className="tbl-cell max-w-[150px]">
                      <div className="text-xs text-ink-700 dark:text-ink-300 truncate">{itemSummary || '—'}</div>
                      <div className="text-[10px] text-ink-400">{itemCount} item{itemCount !== 1 ? 's' : ''}</div>
                    </td>
                    {/* Total */}
                    <td className="tbl-cell font-black text-base text-ink-900 dark:text-white whitespace-nowrap">
                      ₹{Number(order.total).toLocaleString('en-IN')}
                    </td>
                    {/* Payment */}
                    <td className="tbl-cell">
                      <div className="flex flex-wrap gap-1">
                        {payModes.length > 0 ? payModes.map((m, i) => (
                          <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                            ['UPI','GPAY','PHONEPE','CREDIT_CARD','DEBIT_CARD','ONLINE'].includes(m)
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800'
                              : m === 'CASH' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'
                              : m === 'KHATA' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800'
                              : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 border-ink-200 dark:border-ink-700'
                          }`}>{m}</span>
                        )) : <span className="text-[10px] text-ink-400 italic">No payment</span>}
                      </div>
                    </td>
                    {/* Status */}
                    <td className="tbl-cell">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize ${STATUS_BADGE[order.status] || 'bg-ink-100 text-ink-600'}`}>
                        {order.status}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="tbl-cell">
                      {!isCancelled && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleEditNav(order)}
                            className="p-1.5 text-ink-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit order"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleCancel(order)}
                            disabled={cancellingId === order.id}
                            className="p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Cancel order"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      {!loading && filteredOrders.length > 0 && (
        <div className="flex flex-wrap gap-4 p-4 bg-ink-50 dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 text-sm">
          <div>
            <span className="text-ink-500">Showing:</span>{' '}
            <span className="font-bold text-ink-900 dark:text-white">{filteredOrders.length} orders</span>
          </div>
          <div>
            <span className="text-ink-500">Revenue (excl. cancelled):</span>{' '}
            <span className="font-black text-emerald-600 dark:text-emerald-400">₹{totalRevenue.toLocaleString('en-IN')}</span>
          </div>
          <div>
            <span className="text-ink-500">Avg order:</span>{' '}
            <span className="font-bold text-ink-900 dark:text-white">₹{orderCount > 0 ? Math.round(totalRevenue / orderCount).toLocaleString('en-IN') : 0}</span>
          </div>
          <div>
            <span className="text-ink-500">Cancelled:</span>{' '}
            <span className="font-bold text-red-500">{cancelledCount}</span>
          </div>
        </div>
      )}

      {/* Quick Edit Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <form onSubmit={saveEditedOrder} className="bg-white dark:bg-ink-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex justify-between items-center bg-ink-50 dark:bg-ink-950/50">
              <div>
                <h3 className="font-bold text-ink-900 dark:text-white">Edit Order</h3>
                <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mt-0.5">
                  {editingOrder.order_number || '#' + editingOrder.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <button type="button" onClick={() => setEditingOrder(null)} className="text-ink-400 hover:text-ink-900"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Order Status</label>
                  <select 
                    className="input font-semibold"
                    value={editingOrder.newStatus}
                    onChange={e => setEditingOrder({...editingOrder, newStatus: e.target.value})}
                  >
                    <option value="new">New</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                
                <div>
                  <label className="label">Payment Mode</label>
                  <select 
                    className="input font-semibold"
                    value={editingOrder.newPaymentMode}
                    onChange={e => setEditingOrder({...editingOrder, newPaymentMode: e.target.value})}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="ONLINE">Online</option>
                    <option value="KHATA">Khata</option>
                    <option value="ADVANCE">Advance</option>
                  </select>
                </div>
              </div>

              {/* Customer Info Card */}
              <div className="pt-4 border-t border-ink-100 dark:border-ink-800">
                <label className="label mb-2 flex justify-between items-center">
                  <span>Customer Details</span>
                  {editingOrder.selectedCustomer && !isEditingCustomer && (
                    <button
                      type="button"
                      onClick={() => setIsEditingCustomer(true)}
                      className="text-xs text-blue-500 hover:text-blue-600 font-bold"
                    >
                      Edit Profile
                    </button>
                  )}
                </label>

                {editingOrder.selectedCustomer ? (
                  <div className="p-3 bg-ink-50 dark:bg-ink-950/50 rounded-xl border border-ink-100 dark:border-ink-800 animate-fade-in">
                    {isEditingCustomer ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-ink-400">Name</label>
                            <input
                              type="text"
                              className="input text-xs w-full mt-1 bg-white dark:bg-ink-900"
                              value={editCustName}
                              onChange={e => setEditCustName(e.target.value)}
                              placeholder="Name"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-ink-400">Mobile (10 digits)</label>
                            <input
                              type="tel"
                              maxLength={10}
                              className="input text-xs w-full mt-1 bg-white dark:bg-ink-900"
                              value={editCustMobile}
                              onChange={e => setEditCustMobile(e.target.value.replace(/\D/g, ''))}
                              placeholder="Mobile"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingCustomer(false)
                              setEditCustName(editingOrder.selectedCustomer.name)
                              setEditCustMobile(editingOrder.selectedCustomer.mobile_number)
                            }}
                            className="px-2 py-1 text-[10px] font-bold text-ink-500 hover:text-ink-700 bg-ink-100 dark:bg-ink-800 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!editCustName.trim() || editCustMobile.length !== 10) {
                                toast.error('Enter a valid name and 10-digit mobile number')
                                return
                              }
                              setEditingOrder({
                                ...editingOrder,
                                selectedCustomer: {
                                  ...editingOrder.selectedCustomer,
                                  name: editCustName,
                                  mobile_number: editCustMobile
                                }
                              })
                              setIsEditingCustomer(false)
                            }}
                            className="px-2 py-1 text-[10px] font-bold text-white bg-blue-500 hover:bg-blue-600 rounded"
                          >
                            Apply Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-ink-900 dark:text-white">
                            {editingOrder.selectedCustomer.name}
                          </p>
                          <p className="text-xs text-ink-500 font-mono">
                            {editingOrder.selectedCustomer.mobile_number || 'No Phone'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrder({ ...editingOrder, selectedCustomer: null })
                            setIsEditingCustomer(false)
                            setEditCustName('')
                            setEditCustMobile('')
                          }}
                          className="p-1 text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Remove customer"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {showAddCustomer ? (
                      <div className="p-3 bg-amber-50/50 dark:bg-ink-950/50 rounded-xl border border-amber-200 dark:border-ink-800 space-y-3 animate-fade-in">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Register New Customer</span>
                          <button
                            type="button"
                            onClick={() => setShowAddCustomer(false)}
                            className="text-ink-400 hover:text-ink-600"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-ink-400">Full Name *</label>
                            <input
                              type="text"
                              className="input text-xs w-full mt-1 bg-white dark:bg-ink-900"
                              value={newCustName}
                              onChange={e => setNewCustName(e.target.value)}
                              placeholder="John Doe"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-ink-400">Mobile (10 digits) *</label>
                            <input
                              type="tel"
                              maxLength={10}
                              className="input text-xs w-full mt-1 bg-white dark:bg-ink-900"
                              value={newCustMobile}
                              onChange={e => setNewCustMobile(e.target.value.replace(/\D/g, ''))}
                              placeholder="9876543210"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                          type="text"
                          className="input pl-9 text-xs w-full bg-white dark:bg-ink-900"
                          placeholder="Search existing customer by name or mobile..."
                          value={customerSearch}
                          onChange={e => setCustomerSearch(e.target.value)}
                        />
                        {customerSearch.trim().length >= 2 && (
                          <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                            {customerResults.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setEditingOrder({ ...editingOrder, selectedCustomer: c })
                                  setEditCustName(c.name)
                                  setEditCustMobile(c.mobile_number)
                                  setCustomerSearch('')
                                  setCustomerResults([])
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-ink-50 dark:hover:bg-ink-800 flex justify-between items-center group"
                              >
                                <div>
                                  <p className="text-xs font-bold text-ink-900 dark:text-white">{c.name}</p>
                                  <p className="text-[10px] text-ink-500 font-mono">{c.mobile_number}</p>
                                </div>
                                <span className="text-[10px] bg-ink-100 dark:bg-ink-800 text-ink-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Select
                                </span>
                              </button>
                            ))}
                            {customerResults.length === 0 && (
                              <div className="px-4 py-3 text-center text-xs text-ink-500">
                                No matching customer found.
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-2 px-1">
                          <span className="text-xs text-ink-400 italic">Order is currently marked as Guest.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddCustomer(true)
                              setNewCustName('')
                              setNewCustMobile(/^\d+$/.test(customerSearch) && customerSearch.length === 10 ? customerSearch : '')
                            }}
                            className="text-xs text-ember hover:underline font-bold flex items-center gap-1"
                          >
                            <Plus size={12} /> Create New Customer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="pt-2 border-t border-ink-100 dark:border-ink-800">
                <label className="label mb-2 flex justify-between items-end">
                  <span>Order Items</span>
                  <span className="text-emerald-600 font-bold">Total: ₹{(editingOrder.editingItems.reduce((s,i) => s + (i.price*i.quantity),0) - (editingOrder.discount||0)).toLocaleString()}</span>
                </label>
                
                {/* Search Add Item */}
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    className="input pl-9 text-sm"
                    placeholder="Search to add item..."
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                  />
                  {itemSearch.trim() && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                      {allItems.filter(i => (i.name+' '+i.variant).toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 10).map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addEditItem(item)}
                          className="w-full text-left px-4 py-2 hover:bg-ink-50 dark:hover:bg-ink-800 flex justify-between items-center group"
                        >
                          <div>
                            <p className="text-sm font-bold text-ink-900 dark:text-white">{item.name}</p>
                            {item.variant && <p className="text-[10px] text-ink-500">{item.variant}</p>}
                          </div>
                          <span className="text-xs font-bold text-emerald-600 group-hover:scale-110 transition-transform">₹{item.price} <Plus size={12} className="inline"/></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  {editingOrder.editingItems.map(item => (
                    <div key={item.item_id} className="flex items-center justify-between p-2 bg-ink-50 dark:bg-ink-950/50 rounded-xl border border-ink-100 dark:border-ink-800">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-ink-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-ink-500">₹{item.price} {item.variant ? `• ${item.variant}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-700 shadow-sm overflow-hidden">
                          <button type="button" onClick={() => updateEditItemQty(item.item_id, -1)} className="px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-600"><Minus size={12}/></button>
                          <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                          <button type="button" onClick={() => updateEditItemQty(item.item_id, 1)} className="px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-600"><Plus size={12}/></button>
                        </div>
                        <button type="button" onClick={() => removeEditItem(item.item_id)} className="p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                  ))}
                  {editingOrder.editingItems.length === 0 && (
                    <p className="text-xs text-center py-4 text-ink-500 italic border border-dashed border-ink-200 rounded-xl">No items in order.</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-ink-50 dark:bg-ink-950/50 flex gap-3 border-t border-ink-100 dark:border-ink-800">
              <button type="button" onClick={() => setEditingOrder(null)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={loading || editingOrder.editingItems.length === 0}>
                {loading ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
