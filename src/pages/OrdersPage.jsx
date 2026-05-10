import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Search, Filter, ArrowUpDown, Edit2, X, ArrowLeft, Download } from 'lucide-react'

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

  const isSuperAdmin = role === 'super_admin'

  useEffect(() => { fetchOrders() }, [branchId])

  async function fetchOrders() {
    setLoading(true)
    let q = supabase
      .from('orders')
      .select(`
        id, order_number, created_at, total, subtotal, discount, status, table_number, order_type,
        branch_id,
        customers(id, name, mobile_number),
        order_items(id, quantity, price, total, items(name, variant)),
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
    // Navigate to billing page with order context
    navigate(`/admin/billing?editOrder=${order.id}`)
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
    </div>
  )
}
