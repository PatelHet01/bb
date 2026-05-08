import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { TrendingUp, ShoppingCart, Users, AlertTriangle, ArrowRight, CreditCard, X } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DashboardHome() {
  const { role, branchId, branchName } = useAuthStore()
  const [stats, setStats] = useState({ revenue: 0, cashRev: 0, onlineRev: 0, orders: 0, customers: 0, outKhata: 0 })
  const [lowStockItems, setLowStockItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState([])
  const [todayOrders, setTodayOrders] = useState([])
  
  // Modal states
  const [activeModal, setActiveModal] = useState(null) // 'revenue', 'khata', 'orders', 'customers'
  const [khataList, setKhataList] = useState([])
  const [recentCustomers, setRecentCustomers] = useState([])

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = new Date().toISOString().split('T')[0]

        let oQ = supabase.from('orders').select('id, order_number, total, created_at, table_number, order_payments(mode, amount), customers(name)').gte('created_at', today)
        if (branchId) oQ = oQ.eq('branch_id', branchId)
        const { data: orders } = await oQ.order('created_at', { ascending: false })

        let cQ = supabase.from('customers').select('id', { count: 'exact', head: true })
        if (branchId) cQ = cQ.eq('branch_id', branchId)
        const { count: custCount } = await cQ

        // Fetch items for low stock calculation
        let sQ = supabase.from('items').select('id, name, stock_quantity, low_stock_threshold').eq('is_active', true)
        if (branchId) sQ = sQ.eq('branch_id', branchId)
        const { data: items } = await sQ
        const lowStockList = (items || []).filter(i => i.stock_quantity <= (i.low_stock_threshold || 5))
        setLowStockItems(lowStockList)

        let kQ = supabase.from('khata_ledger').select('type, amount, customers(id, name, mobile_number)')
        if (branchId) kQ = kQ.eq('branch_id', branchId)
        const { data: khataLedger } = await kQ
        
        let khataBalances = {}
        let outKhataTotal = 0
        ;(khataLedger || []).forEach(l => {
          const amt = Number(l.amount)
          const isCredit = l.type === 'CREDIT'
          outKhataTotal += isCredit ? amt : -amt
          
          if (l.customers) {
            const cid = l.customers.id
            if (!khataBalances[cid]) khataBalances[cid] = { customer: l.customers, balance: 0 }
            khataBalances[cid].balance += isCredit ? amt : -amt
          }
        })
        setKhataList(Object.values(khataBalances).filter(k => k.balance > 0).sort((a,b) => b.balance - a.balance))

        let rCQ = supabase.from('customers').select('id, name, mobile_number, created_at').order('created_at', { ascending: false }).limit(20)
        if (branchId) rCQ = rCQ.eq('branch_id', branchId)
        const { data: recCust } = await rCQ
        setRecentCustomers(recCust || [])

        // Calculate Cash/Online
        let cashRev = 0; let onlineRev = 0;
        (orders || []).forEach(o => {
          (o.order_payments || []).forEach(p => {
            if (p.mode === 'CASH') cashRev += Number(p.amount);
            if (p.mode === 'UPI') onlineRev += Number(p.amount);
          })
        })

        setStats({
          revenue: orders?.reduce((s, o) => s + (o.total || 0), 0) || 0,
          cashRev, onlineRev,
          orders: orders?.length || 0,
          customers: custCount || 0,
          outKhata: outKhataTotal
        })
        setRecentOrders((orders || []).slice(0, 5))
        setTodayOrders(orders || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [branchId])

  const STATS = [
    { id: 'revenue', label: "Today's Revenue", value: `₹${stats.revenue.toLocaleString('en-IN')}`, icon: TrendingUp, trend: '+', subtext: `Cash: ₹${stats.cashRev.toLocaleString('en-IN')} | UPI: ₹${stats.onlineRev.toLocaleString('en-IN')}` },
    { id: 'khata', label: 'Out. Khata (Levana)', value: `₹${stats.outKhata.toLocaleString('en-IN')}`, icon: CreditCard, trend: null, color: 'text-red-500' },
    { id: 'orders', label: 'Orders Today',    value: stats.orders,    icon: ShoppingCart, trend: null },
    { id: 'customers', label: 'Customers',       value: stats.customers, icon: Users, trend: null },
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
                        {new Date(o.created_at).toLocaleDateString('en-IN', {day:'2-digit', month:'short'})} <span className="text-[10px]">{new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="tbl-cell font-mono text-[11px] text-ember font-bold">
                        {o.order_number || `#${o.id.slice(0,8).toUpperCase()}`}
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
                          {(o.order_payments || []).map((p, idx) => (
                            <span key={idx} className={`badge text-[9px] ${p.mode === 'UPI' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : p.mode === 'CASH' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-ink-100 text-ink-600'}`}>
                              {p.mode}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            ) : lowStockItems.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
                  <span className="text-emerald-500 text-xl">✓</span>
                </div>
                <p className="text-sm font-bold text-ink-700 dark:text-ink-300">Stock levels good</p>
                <p className="text-[10px] text-ink-400 mt-1">No items below threshold</p>
              </div>
            ) : (
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {lowStockItems.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-ink-900 dark:text-white">{item.name}</p>
                      <p className="text-[10px] text-ink-500">Threshold: {item.low_stock_threshold}</p>
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg border text-xs font-black ${item.stock_quantity === 0 ? 'bg-red-100 border-red-200 text-red-700' : 'bg-orange-100 border-orange-200 text-orange-700'}`}>
                      {item.stock_quantity} Left
                    </div>
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
              <button onClick={() => setActiveModal(null)} className="p-2 text-ink-400 hover:text-ink-900 dark:hover:text-white bg-white dark:bg-ink-800 rounded-lg border border-ink-200 dark:border-ink-700"><X size={16}/></button>
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
                     <div key={o.id} className="flex justify-between items-center p-3 border border-ink-100 dark:border-ink-800 rounded-xl">
                       <div>
                         <p className="font-bold text-sm text-ink-900 dark:text-white">
                           {o.order_number || `#${o.id.slice(0,8).toUpperCase()}`}
                           <span className="ml-2 text-[10px] font-normal text-ink-400">{new Date(o.created_at).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}</span>
                         </p>
                         <p className="text-[10px] text-ink-500 mt-0.5">{o.customers?.name || 'Guest'} {o.table_number ? `· T-${o.table_number}` : ''}</p>
                       </div>
                       <div className="text-right">
                         <p className="font-black text-ink-900 dark:text-white">₹{o.total}</p>
                         <div className="flex gap-1 justify-end mt-1">
                           {(o.order_payments||[]).map((p,i) => <span key={i} className="text-[8px] font-bold px-1 py-0.5 bg-ink-100 dark:bg-ink-800 rounded text-ink-500">{p.mode}</span>)}
                         </div>
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
                       <p className="text-[10px] text-ink-400">{new Date(c.created_at).toLocaleDateString('en-IN', {month:'short', day:'numeric'})}</p>
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
