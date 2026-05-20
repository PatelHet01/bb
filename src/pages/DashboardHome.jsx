import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { TrendingUp, ShoppingCart, Users, AlertTriangle, ArrowRight, CreditCard, X, UtensilsCrossed, GitBranch, Clock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

export default function DashboardHome() {
  const { role, branchId, branchName } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ revenue: 0, cashRev: 0, onlineRev: 0, orders: 0, customers: 0, outKhata: 0 })
  const [lowStockItems, setLowStockItems] = useState({}) // Grouped by category
  const [openCategories, setOpenCategories] = useState({}) // Accordion state
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState([])
  const [todayOrders, setTodayOrders] = useState([])
  const [recentTransfers, setRecentTransfers] = useState([])

  // Modal states
  const [activeModal, setActiveModal] = useState(null) // 'revenue', 'khata', 'orders', 'customers'
  const [khataList, setKhataList] = useState([])
  const [recentCustomers, setRecentCustomers] = useState([])

  // Active Tables (Bhat only)
  const isBhatBranch = branchId === 'bhat' || (!branchId && role === 'super_admin')
  const [activeTables, setActiveTables] = useState([])

  // Quick Attendance
  const [staffStatus, setStaffStatus] = useState([])

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = new Date().toISOString().split('T')[0]

        let oQ = supabase.from('orders').select('id, order_number, total, created_at, status, table_number, order_type, order_payments(mode, amount), customers(name), order_items(quantity, price, items(name, variant))').gte('created_at', today)
        if (branchId) oQ = oQ.eq('branch_id', branchId)
        const { data: orders, error: ordersError } = await oQ.order('created_at', { ascending: false })
        if (ordersError) throw ordersError

        // Fetch payments separately to ensure reliability
        const { data: allPayments, error: payError } = await supabase.from('order_payments').select('*').in('order_id', orders.map(o => o.id))
        if (payError) console.error('Error fetching payments:', payError)

        // Map payments to orders
        const ordersWithPayments = orders.map(o => ({
          ...o,
          order_payments: (allPayments || []).filter(p => p.order_id === o.id)
        }))

        let cQ = supabase.from('customers').select('id', { count: 'exact', head: true })
        if (branchId) cQ = cQ.eq('branch_id', branchId)
        const { count: custCount } = await cQ

        // Fetch items for low stock calculation
        let sQ = supabase.from('items').select('id, name, stock_quantity, low_stock_threshold, category').eq('is_active', true)
        if (branchId) sQ = sQ.eq('branch_id', branchId)
        const { data: items, error: itemsError } = await sQ
        if (itemsError) console.error('Error fetching low stock:', itemsError)
        
        const lowStockList = (items || []).filter(i => (i.stock_quantity || 0) <= (i.low_stock_threshold || 5))

        const groupedLowStock = {}
        lowStockList.forEach(i => {
          const catName = i.category || 'Uncategorized'
          if (!groupedLowStock[catName]) groupedLowStock[catName] = []
          groupedLowStock[catName].push(i)
        })
        setLowStockItems(groupedLowStock)

        // Open all categories by default
        const initialOpen = {}
        Object.keys(groupedLowStock).forEach(k => initialOpen[k] = true)
        setOpenCategories(initialOpen)

        let kQ = supabase.from('khata_ledger').select('type, amount, customers(id, name, mobile_number)')
        if (branchId) kQ = kQ.eq('branch_id', branchId)
        const { data: khataLedger } = await kQ

        let khataBalances = {}
        let outKhataTotal = 0
          ; (khataLedger || []).forEach(l => {
            const amt = Number(l.amount)
            const isCredit = l.type === 'CREDIT'
            outKhataTotal += isCredit ? amt : -amt

            if (l.customers) {
              const cid = l.customers.id
              if (!khataBalances[cid]) khataBalances[cid] = { customer: l.customers, balance: 0 }
              khataBalances[cid].balance += isCredit ? amt : -amt
            }
          })
        setKhataList(Object.values(khataBalances).filter(k => k.balance > 0).sort((a, b) => b.balance - a.balance))

        let rCQ = supabase.from('customers').select('id, name, mobile_number, created_at').order('created_at', { ascending: false }).limit(20)
        if (branchId) rCQ = rCQ.eq('branch_id', branchId)
        const { data: recCust } = await rCQ
        setRecentCustomers(recCust || [])

        // Calculate Cash/Online — ONLY from non-cancelled orders
        const activeOrders = (ordersWithPayments || []).filter(o => o.status !== 'cancelled')
        let cashRev = 0; let onlineRev = 0;
        activeOrders.forEach(o => {
          (o.order_payments || []).forEach(p => {
            if (p.mode === 'CASH') cashRev += Number(p.amount);
            if (['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'GPAY', 'PHONEPE', 'ONLINE'].includes(p.mode)) onlineRev += Number(p.amount);
          })
        })

        setStats({
          revenue: activeOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
          cashRev, onlineRev,
          orders: activeOrders.length,
          customers: custCount || 0,
          outKhata: outKhataTotal
        })
        setRecentOrders(activeOrders || [])
        setTodayOrders(activeOrders || [])

        // Fetch Recent Transfers for Super Admin
        if (role === 'super_admin') {
          const { data: transfers } = await supabase.from('branch_transfers')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5)
          setRecentTransfers(transfers || [])
        }

        // Active occupied tables (bhat only)
        if (branchId === 'bhat' || !branchId) {
          const { data: tables } = await supabase
            .from('cafe_tables')
            .select('id, table_number, status, current_order_id')
            .eq('branch_id', 'bhat')
            .eq('status', 'occupied')
          if (tables && tables.length > 0) {
            const enriched = await Promise.all(tables.map(async t => {
              if (!t.current_order_id) return { ...t, itemCount: 0, amount: 0 }
              const { data: oi } = await supabase.from('order_items')
                .select('quantity, price, items(name, variant), item_id').eq('order_id', t.current_order_id)
              const itemCount = (oi || []).reduce((s, i) => s + i.quantity, 0)
              const amount = (oi || []).reduce((s, i) => s + i.quantity * i.price, 0)
              
              const { data: ord } = await supabase.from('orders').select('status').eq('id', t.current_order_id).single()

              return { ...t, itemCount, amount, orderStatus: ord?.status, orderItems: oi }
            }))
            setActiveTables(enriched)
          } else {
            setActiveTables([])
          }
        }

        // Fetch Quick Attendance
        const [wRes, sRes] = await Promise.all([
          supabase.from('workers').select('id, name, branch_id').eq('is_active', true),
          supabase.from('shifts').select('*').gte('clock_in', `${today}T00:00:00Z`)
        ])
        const branchWorkers = (wRes.data || []).filter(w => !branchId || w.branch_id === branchId)
        const staffWithStatus = branchWorkers.map(w => {
          const shift = (sRes.data || []).find(s => s.worker_id === w.id && !s.clock_out)
          return { ...w, activeShift: shift }
        })
        setStaffStatus(staffWithStatus)

      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()

    // Real-time Sync
    const channel = supabase.channel('dashboard_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_payments' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'khata_ledger' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, fetchStats)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [branchId])

  async function startPreparing(table) {
    if (!table.current_order_id) return
    try {
      await supabase.from('orders').update({ status: 'preparing' }).eq('id', table.current_order_id)
      
      const kdsPayload = (table.orderItems || []).map(oi => ({
        order_id: table.current_order_id,
        item_id: oi.item_id,
        item_name: oi.items?.name + (oi.items?.variant ? ` (${oi.items.variant})` : ''),
        quantity: oi.quantity,
        status: 'pending',
        is_addon: false
      }))
      await supabase.from('kds_items').delete().eq('order_id', table.current_order_id)
      if (kdsPayload.length > 0) {
        await supabase.from('kds_items').insert(kdsPayload)
      }
      
      // Optimistic update
      setActiveTables(prev => prev.map(t => t.id === table.id ? { ...t, orderStatus: 'preparing' } : t))
    } catch (e) {
      console.error('Failed to start preparing:', e)
    }
  }

  async function clearAllTables() {
    if (!window.confirm('Are you sure you want to clear ALL active tables? This will reset them to available.')) return
    try {
      const { error } = await supabase.from('cafe_tables')
        .update({ status: 'available', current_order_id: null })
        .eq('branch_id', 'bhat')
        .eq('status', 'occupied')
      
      if (error) throw error
      setActiveTables([])
      toast.success('All active tables cleared')
    } catch (e) {
      console.error('Failed to clear tables:', e)
      toast.error('Failed to clear tables: ' + e.message)
    }
  }

  async function clearTable(tableId) {
    if (!window.confirm('Clear this table?')) return
    try {
      const { error } = await supabase.from('cafe_tables')
        .update({ status: 'available', current_order_id: null })
        .eq('id', tableId)
      
      if (error) throw error
      setActiveTables(prev => prev.filter(t => t.id !== tableId))
      toast.success('Table cleared')
    } catch (e) {
      console.error('Failed to clear table:', e)
      toast.error('Failed to clear table: ' + e.message)
    }
  }

  async function handleQuickClock(workerId, activeShift) {
    if (activeShift) {
      await supabase.from('shifts').update({ clock_out: new Date().toISOString() }).eq('id', activeShift.id)
    } else {
      const todayStr = new Date().toISOString().split('T')[0]
      const dayCode = todayStr.replace(/-/g, '').slice(-4)
      await supabase.from('shifts').insert({
        worker_id: workerId, branch_id: branchId || 'gurukul', day_code: dayCode, clock_in: new Date().toISOString()
      })
    }
  }

  const STATS = [
    { id: 'revenue', label: "Today's Revenue", value: `₹${stats.revenue.toLocaleString('en-IN')}`, icon: TrendingUp, trend: '+', subtext: `Cash: ₹${stats.cashRev.toLocaleString('en-IN')} | UPI: ₹${stats.onlineRev.toLocaleString('en-IN')}` },
    { id: 'khata', label: 'Out. Khata (Levana)', value: `₹${stats.outKhata.toLocaleString('en-IN')}`, icon: CreditCard, trend: null, color: 'text-red-500' },
    { id: 'orders', label: 'Orders Today', value: stats.orders, icon: ShoppingCart, trend: null },
    { id: 'customers', label: 'Customers', value: stats.customers, icon: Users, trend: null },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-ink-400 mt-0.5">
            {branchName} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link to="/admin/billing" className="btn-primary btn-sm hidden sm:flex">
          + New Bill
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading
          ? Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)
          : STATS.map((s, i) => (
            <button key={i} onClick={() => setActiveModal(s.id)} className="stat-card text-left hover:scale-[1.02] transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-ember relative">
              <div className="flex-1 min-w-0">
                <p className="label mb-2">{s.label}</p>
                <p className={`text-2xl font-bold tracking-tight ${s.color || 'text-ink-900 dark:text-white'}`}>{s.value}</p>
                {s.subtext && <p className="text-[10px] text-ink-500 font-semibold mt-1">{s.subtext}</p>}
                {s.trend === '!' && <p className="text-[10px] text-red-500 font-semibold mt-1 uppercase tracking-wide">Needs restocking</p>}
              </div>
              <div className="w-9 h-9 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center flex-shrink-0">
                <s.icon size={16} className="text-ink-600 dark:text-ink-400" strokeWidth={2} />
              </div>
            </button>
          ))
        }
      </div>

      {/* Active Tables Widget — Bhat branch only */}
      {(branchId === 'bhat' || role === 'super_admin') && activeTables.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800 bg-amber-50/50 dark:bg-amber-900/10">
            <h2 className="font-semibold text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
              <UtensilsCrossed size={16} /> Active Tables — Bhat ({activeTables.length} occupied)
            </h2>
            <div className="flex items-center gap-4">
              <button onClick={clearAllTables} className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 font-bold px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded">
                Clear All
              </button>
              <Link to="/admin/billing" className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 font-bold">Go to Billing →</Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-800/50">
                <tr>
                  {['Table', 'Items', 'Pending Amount', 'Action'].map(h => (
                    <th key={h} className="tbl-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {activeTables.map(t => (
                  <tr key={t.id} className="tbl-row hover:bg-amber-50/30 dark:hover:bg-amber-900/10 cursor-pointer"
                    onClick={() => navigate(`/admin/billing?table=${t.table_number}`)}>
                    <td className="tbl-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center font-black text-sm">{t.table_number}</div>
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      </div>
                    </td>
                    <td className="tbl-cell">
                      <span className="font-bold text-ink-900 dark:text-white">{t.itemCount}</span>
                      <span className="text-ink-500 text-xs ml-1">item{t.itemCount !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="tbl-cell font-black text-amber-600 dark:text-amber-400 text-base">
                      ₹{t.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="tbl-cell">
                      <div className="flex gap-2">
                        {t.orderStatus === 'pending' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); startPreparing(t); }} 
                            className="text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 px-2 py-1 rounded border border-amber-200 dark:border-amber-800"
                          >
                            Start Preparing
                          </button>
                        )}
                        <button className="text-xs font-bold text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                          Bill →
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); clearTable(t.id); }} 
                          className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded"
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="card overflow-hidden lg:col-span-2 flex flex-col h-full">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800">
            <h2 className="font-semibold text-ink-900 dark:text-white text-sm">Recent Orders</h2>
            <Link to="/admin/billing" className="text-xs text-ink-500 hover:text-ink-900 dark:hover:text-white flex items-center gap-1 transition-colors">
              New Bill <ArrowRight size={12} />
            </Link>
          </div>
          {loading
            ? <div className="p-5 space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-8" />)}</div>
            : recentOrders.length === 0
              ? <p className="text-center py-10 text-sm text-ink-400">No orders today yet</p>
              : (
                <div className="flex-1 overflow-y-auto max-h-[400px] no-scrollbar">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-50 dark:bg-ink-800/50">
                      <tr>
                        {['Date', 'Order ID', 'Customer', 'Table No', 'Total', 'Payment'].map(h => (
                          <th key={h} className="tbl-head">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map(o => (
                        <tr key={o.id} className="tbl-row">
                          <td className="tbl-cell text-ink-500 whitespace-nowrap">
                            {new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} <span className="text-[10px]">{new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="tbl-cell font-mono text-[11px] text-ember font-bold">
                            {o.order_number || `#${o.id.slice(0, 8).toUpperCase()}`}
                          </td>
                          <td className="tbl-cell text-ink-700 dark:text-ink-300 truncate max-w-[120px]">
                            {o.customers?.name || <span className="italic text-ink-400">Guest</span>}
                          </td>
                          <td className="tbl-cell text-ink-500 font-mono">
                            {o.table_number || '-'}
                          </td>
                          <td className="tbl-cell font-semibold text-ink-900 dark:text-white">₹{o.total.toLocaleString('en-IN')}</td>
                          <td className="tbl-cell">
                            <div className="flex gap-1 flex-wrap">
                              {o.order_payments && o.order_payments.length > 0 ? (
                                o.order_payments.map((p, idx) => (
                                  <span key={idx} className={`badge text-[9px] ${['UPI', 'ONLINE', 'GPAY', 'PHONEPE', 'PAYTM', 'CREDIT_CARD', 'DEBIT_CARD'].includes(p.mode) ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : p.mode === 'CASH' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-ink-100 text-ink-600'}`}>
                                    {p.mode}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-ink-400 italic">No payment logged</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          }
        </div>

        {/* Low Stock Alerts */}
        <div className="card flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800 bg-red-50/50 dark:bg-red-900/10">
            <h2 className="font-semibold text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> Low Stock Alerts
            </h2>
            <Link to="/admin/inventory?filter=low_stock" className="text-xs text-red-500 hover:text-red-700 font-bold transition-colors">
              Manage
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar max-h-[400px]">
            {loading ? (
              <div className="p-5 space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-8" />)}</div>
            ) : Object.keys(lowStockItems).length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
                  <span className="text-emerald-500 text-xl">✓</span>
                </div>
                <p className="text-sm font-bold text-ink-700 dark:text-ink-300">Stock levels good</p>
                <p className="text-[10px] text-ink-400 mt-1">No items below threshold</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {Object.entries(lowStockItems).map(([category, items]) => (
                  <div key={category} className="border-b border-ink-100 dark:border-ink-800 last:border-0">
                    <button
                      onClick={() => setOpenCategories(p => ({ ...p, [category]: !p[category] }))}
                      className="w-full flex items-center justify-between p-3 bg-ink-50/50 dark:bg-ink-800/30 hover:bg-ink-100 dark:hover:bg-ink-800/60 transition-colors"
                    >
                      <span className="font-bold text-sm text-ink-900 dark:text-white">{category} <span className="text-xs text-ink-500 font-normal ml-1">({items.length})</span></span>
                      <span className="text-ink-400 text-xs font-mono">{openCategories[category] ? '▼' : '▶'}</span>
                    </button>
                    {openCategories[category] && (
                      <div className="divide-y divide-ink-50 dark:divide-ink-800/50 bg-white dark:bg-ink-900">
                        {items.map(item => (
                          <div key={item.id} className="p-3 pl-4 flex items-center justify-between hover:bg-ink-50/30 dark:hover:bg-ink-800/20 transition-colors">
                            <div>
                              <p className="text-sm font-bold text-ink-900 dark:text-white">{item.name}</p>
                              <p className="text-[10px] text-ink-500">Threshold: {item.low_stock_threshold || 5}</p>
                            </div>
                            <div className={`px-2 py-1 rounded border text-xs font-black ${item.stock_quantity <= 0 ? 'bg-red-100 border-red-200 text-red-700' : 'bg-orange-100 border-orange-200 text-orange-700'}`}>
                              {item.stock_quantity} Left
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Branch Transfers (Super Admin only) */}
        {role === 'super_admin' && (
          <div className="card flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800 bg-indigo-50/50 dark:bg-indigo-900/10">
              <h2 className="font-semibold text-indigo-600 dark:text-indigo-400 text-sm flex items-center gap-2">
                <GitBranch size={16} /> Recent Branch Transfers
              </h2>
              <Link to="/admin/settings?tab=transfers" className="text-xs text-indigo-500 hover:text-indigo-700 font-bold transition-colors">
                View All
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar max-h-[400px]">
              {loading ? (
                <div className="p-5 space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-8" />)}</div>
              ) : recentTransfers.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                  <p className="text-sm font-bold text-ink-700 dark:text-ink-300">No transfers yet</p>
                  <p className="text-[10px] text-ink-400 mt-1">Inter-branch movements will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-ink-100 dark:divide-ink-800">
                  {recentTransfers.map(t => (
                    <div key={t.id} className="p-4 hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-bold text-ink-900 dark:text-white truncate max-w-[150px]">{t.item_name}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${t.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>{t.status}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <div className="flex items-center gap-1 text-ink-500">
                          <span className="font-bold text-ink-700 dark:text-ink-300 capitalize">{t.from_branch_id}</span>
                          <ArrowRight size={8} />
                          <span className="font-bold text-ink-700 dark:text-ink-300 capitalize">{t.to_branch_id}</span>
                        </div>
                        <p className="font-black text-ink-900 dark:text-white">Qty: {t.quantity}</p>
                      </div>
                      <div className="mt-1 text-right">
                        <p className="text-[10px] font-bold text-emerald-600">₹{Number(t.total_value).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Staff Attendance Card */}
        <div className="card flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800 bg-emerald-50/50 dark:bg-emerald-900/10">
            <h2 className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
              <Clock size={16} /> Quick Staff Attendance
            </h2>
            <Link to="/admin/hr" className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 font-bold transition-colors">
              Full HR
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar max-h-[400px]">
            {loading ? (
              <div className="p-5 space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
            ) : staffStatus.length === 0 ? (
              <p className="p-8 text-center text-ink-500">No active staff found.</p>
            ) : (
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {staffStatus.map(staff => (
                  <div key={staff.id} className="p-4 flex items-center justify-between hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center font-bold text-ink-600 dark:text-ink-300">
                        {staff.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-ink-900 dark:text-white">{staff.name}</p>
                        <p className={`text-[10px] font-bold uppercase mt-0.5 ${staff.activeShift ? 'text-emerald-500' : 'text-ink-400'}`}>
                          {staff.activeShift ? `Clocked in at ${new Date(staff.activeShift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not clocked in'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleQuickClock(staff.id, staff.activeShift)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-transform active:scale-95 ${staff.activeShift
                          ? 'bg-red-100 text-red-600 hover:bg-red-200 border border-red-200'
                          : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 border border-emerald-200'
                        }`}
                    >
                      {staff.activeShift ? 'Clock Out' : 'Clock In'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
          <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-modal w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex justify-between items-center bg-ink-50 dark:bg-ink-900">
              <h2 className="font-bold text-lg text-ink-900 dark:text-white">
                {activeModal === 'revenue' ? "Today's Revenue Breakdown" :
                  activeModal === 'khata' ? 'Outstanding Khata (Levana)' :
                    activeModal === 'orders' ? "Today's Orders" :
                      "Recent Customers"}
              </h2>
              <button onClick={() => setActiveModal(null)} className="p-2 text-ink-400 hover:text-ink-900 dark:hover:text-white bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700"><X size={16} /></button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar">
              {activeModal === 'revenue' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-xl">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">Cash Collections</span>
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">₹{stats.cashRev.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl">
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">Online (UPI) Collections</span>
                    <span className="text-xl font-black text-indigo-700 dark:text-indigo-400">₹{stats.onlineRev.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-center pt-4">
                    <p className="text-sm text-ink-500">Total: <span className="font-bold text-ink-900 dark:text-white">₹{stats.revenue.toLocaleString('en-IN')}</span></p>
                  </div>
                </div>
              )}

              {activeModal === 'khata' && (
                <div className="space-y-3">
                  {khataList.length === 0 ? <p className="text-center text-ink-400 py-4">No outstanding khata balances.</p> :
                    khataList.map(k => (
                      <div key={k.customer.id} className="flex justify-between items-center p-3 border border-ink-100 dark:border-ink-800 rounded-xl">
                        <div>
                          <p className="font-bold text-ink-900 dark:text-white">{k.customer.name}</p>
                          <p className="text-[10px] text-ink-500 font-mono">{k.customer.mobile_number}</p>
                        </div>
                        <p className="font-black text-red-500">₹{k.balance}</p>
                      </div>
                    ))
                  }
                  <Link to="/admin/customers" className="btn-secondary w-full justify-center mt-4 text-sm">View All Customers</Link>
                </div>
              )}

              {activeModal === 'orders' && (
                <div className="space-y-3">
                  {todayOrders.length === 0 ? <p className="text-center text-ink-400 py-4">No orders today.</p> :
                    todayOrders.map(o => (
                      <div key={o.id} className="p-3 border border-ink-100 dark:border-ink-800 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-sm text-ink-900 dark:text-white">
                              {o.order_number || `#${o.id.slice(0, 8).toUpperCase()}`}
                              <span className="ml-2 text-[10px] font-normal text-ink-400">{new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </p>
                            <p className="text-[10px] text-ink-500 mt-0.5">{o.customers?.name || 'Guest'} {o.table_number ? `· T-${o.table_number}` : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-ink-900 dark:text-white">₹{o.total}</p>
                            <div className="flex gap-1 justify-end mt-1">
                              {(o.order_payments || []).map((p, i) => <span key={i} className="text-[8px] font-bold px-1 py-0.5 bg-ink-100 dark:bg-ink-800 rounded text-ink-500">{p.mode}</span>)}
                            </div>
                          </div>
                        </div>

                        {/* Show Items */}
                        <div className="pt-2 border-t border-ink-100 dark:border-ink-800/50 flex flex-col gap-1">
                          {(o.order_items || []).map((oi, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-ink-600 dark:text-ink-400">
                              <span><span className="font-bold">{oi.quantity}x</span> {oi.items?.name} {oi.items?.variant && <span className="text-[9px]">({oi.items?.variant})</span>}</span>
                              <span>₹{oi.price * oi.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}

              {activeModal === 'customers' && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-4">Total Customers: {stats.customers}</p>
                  {recentCustomers.length === 0 ? <p className="text-center text-ink-400 py-4">No recent customers found.</p> :
                    recentCustomers.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-3 border border-ink-100 dark:border-ink-800 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-ember/10 text-ember flex items-center justify-center font-bold">{c.name[0]?.toUpperCase()}</div>
                          <div>
                            <p className="font-bold text-sm text-ink-900 dark:text-white">{c.name}</p>
                            <p className="text-[10px] text-ink-500 font-mono">{c.mobile_number}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-ink-400">{new Date(c.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</p>
                      </div>
                    ))
                  }
                  <Link to="/admin/customers" className="btn-secondary w-full justify-center mt-4 text-sm">Manage Customers</Link>
                </div>
              )}


            </div>
          </div>
        </div>
      )}
    </div>
  )
}
