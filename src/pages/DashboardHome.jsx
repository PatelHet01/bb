import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { TrendingUp, ShoppingCart, Users, AlertTriangle, ArrowRight, CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function DashboardHome() {
  const { role, branchId, branchName } = useAuthStore()
  const [stats, setStats] = useState({ revenue: 0, orders: 0, customers: 0, lowStock: 0, outKhata: 0 })
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState([])

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = new Date().toISOString().split('T')[0]

        let oQ = supabase.from('orders').select('id, total, created_at, order_payments(mode)').gte('created_at', today)
        if (branchId) oQ = oQ.eq('branch_id', branchId)
        const { data: orders } = await oQ.order('created_at', { ascending: false })

        let cQ = supabase.from('customers').select('id', { count: 'exact', head: true })
        if (branchId) cQ = cQ.eq('branch_id', branchId)
        const { count: custCount } = await cQ

        let sQ = supabase.from('items').select('id', { count: 'exact', head: true }).lte('stock_quantity', 5).eq('is_active', true)
        if (branchId) sQ = sQ.eq('branch_id', branchId)
        const { count: lowStock } = await sQ

        let kQ = supabase.from('khata_ledger').select('type,amount')
        if (branchId) kQ = kQ.eq('branch_id', branchId)
        const { data: khataLedger } = await kQ
        
        const outKhata = (khataLedger || []).reduce((sum, l) => l.type === 'CREDIT' ? sum + Number(l.amount) : sum - Number(l.amount), 0)

        setStats({
          revenue: orders?.reduce((s, o) => s + (o.total || 0), 0) || 0,
          orders: orders?.length || 0,
          customers: custCount || 0,
          lowStock: lowStock || 0,
          outKhata
        })
        setRecentOrders((orders || []).slice(0, 5))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [branchId])

  const STATS = [
    { label: "Today's Revenue", value: `₹${stats.revenue.toLocaleString('en-IN')}`, icon: TrendingUp, trend: '+' },
    { label: 'Out. Khata (Levana)', value: `₹${stats.outKhata.toLocaleString('en-IN')}`, icon: CreditCard, trend: null, color: 'text-red-500' },
    { label: 'Orders Today',    value: stats.orders,    icon: ShoppingCart, trend: null },
    { label: 'Low Stock',       value: stats.lowStock,   icon: AlertTriangle,trend: stats.lowStock > 0 ? '!' : null },
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
            <div key={i} className="stat-card">
              <div className="flex-1 min-w-0">
                <p className="label mb-2">{s.label}</p>
                <p className={`text-2xl font-bold tracking-tight ${s.color || 'text-ink-900 dark:text-white'}`}>{s.value}</p>
                {s.trend === '!' && <p className="text-[10px] text-red-500 font-semibold mt-1 uppercase tracking-wide">Needs restocking</p>}
              </div>
              <div className="w-9 h-9 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center flex-shrink-0">
                <s.icon size={16} className="text-ink-600 dark:text-ink-400" strokeWidth={2} />
              </div>
            </div>
          ))
        }
      </div>

      {/* Recent orders */}
      <div className="card overflow-hidden">
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
                    {['Order ID','Total','Payments','Time'].map(h => (
                      <th key={h} className="tbl-head">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(o => (
                    <tr key={o.id} className="tbl-row">
                      <td className="tbl-cell font-mono text-[11px] text-ink-500">#{o.id.slice(0,8).toUpperCase()}</td>
                      <td className="tbl-cell font-semibold text-ink-900 dark:text-white">₹{o.total.toLocaleString('en-IN')}</td>
                      <td className="tbl-cell">
                        <div className="flex gap-1 flex-wrap">
                          {(o.order_payments || []).map((p, idx) => (
                            <span key={idx} className="badge-default text-[9px]">{p.mode}</span>
                          ))}
                        </div>
                      </td>
                      <td className="tbl-cell text-ink-400">{new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
      </div>
    </div>
  )
}
