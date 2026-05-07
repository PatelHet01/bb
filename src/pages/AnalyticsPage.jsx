import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { BarChart2, TrendingUp, DollarSign, Package } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

export default function AnalyticsPage() {
  const { branchId, role } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({ revenue: 0, orders: 0, profit: 0, avgOrder: 0 })
  const [chartData, setChartData] = useState([])

  useEffect(() => { fetchAnalytics() }, [branchId])

  async function fetchAnalytics() {
    setLoading(true)
    
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    let q = supabase.from('orders')
      .select('created_at, total, status')
      .gte('created_at', sevenDaysAgo.toISOString())
      
    if (branchId) q = q.eq('branch_id', branchId)
    
    const { data: ordersData } = await q
    
    let revenue = 0
    let count = 0
    const dailyMap = {}
    
    for(let i=6; i>=0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      dailyMap[dateStr] = { date: d.toLocaleDateString('en-US', {weekday:'short'}), revenue: 0, orders: 0 }
    }

    if (ordersData) {
      ordersData.forEach(o => {
        if (o.status !== 'cancelled') {
          revenue += Number(o.total)
          count++
          const dateStr = o.created_at.split('T')[0]
          if (dailyMap[dateStr]) {
            dailyMap[dateStr].revenue += Number(o.total)
            dailyMap[dateStr].orders += 1
          }
        }
      })
    }
    
    setMetrics({
      revenue,
      orders: count,
      avgOrder: count > 0 ? revenue / count : 0,
      profit: revenue * 0.45 // placeholder assumption until we map full COGS
    })
    
    setChartData(Object.values(dailyMap))
    setLoading(false)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-dash-text dark:text-dash-textDark">Analytics & Reports</h1>
        <select className="input w-48 disabled:opacity-50" disabled>
          <option>Last 7 Days</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card flex-col gap-2">
          <div className="flex justify-between w-full text-dash-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Revenue</span>
            <DollarSign size={16} className="text-dash-accent" />
          </div>
          <p className="text-2xl font-bold text-dash-text dark:text-dash-textDark">₹{metrics.revenue.toLocaleString()}</p>
        </div>
        <div className="stat-card flex-col gap-2">
          <div className="flex justify-between w-full text-dash-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Orders</span>
            <Package size={16} className="text-dash-primary dark:text-white" />
          </div>
          <p className="text-2xl font-bold text-dash-text dark:text-dash-textDark">{metrics.orders.toLocaleString()}</p>
        </div>
        <div className="stat-card flex-col gap-2">
          <div className="flex justify-between w-full text-dash-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Order Val</span>
            <TrendingUp size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-dash-text dark:text-dash-textDark">₹{Math.round(metrics.avgOrder)}</p>
        </div>
        <div className="stat-card flex-col gap-2">
          <div className="flex justify-between w-full text-dash-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Est. Gross Profit</span>
            <BarChart2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{Math.round(metrics.profit).toLocaleString()}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="card p-6 bg-dash-bg dark:bg-zinc-900 border-dash-border dark:border-dash-borderDark">
        <h3 className="font-bold text-lg mb-6 text-dash-text dark:text-dash-textDark">Revenue Trend (7 Days)</h3>
        {loading ? (
          <div className="h-72 w-full flex items-center justify-center text-dash-muted">Loading chart data...</div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E67E22" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#E67E22" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1A1A2E', borderColor: '#2D2D4E', color: '#fff', borderRadius: '8px' }}
                  itemStyle={{ color: '#E67E22' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#E67E22" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
