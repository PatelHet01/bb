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
  const [dateRange, setDateRange] = useState('7d')

  useEffect(() => { fetchAnalytics() }, [branchId, dateRange])

  async function fetchAnalytics() {
    setLoading(true)
    
    let startDate = null;
    let daysToGenerate = 7;

    if (dateRange === '7d') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      daysToGenerate = 7;
    } else if (dateRange === '30d') {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      daysToGenerate = 30;
    } else if (dateRange === 'this_month') {
      startDate = new Date()
      startDate.setDate(1) // first day of month
      daysToGenerate = new Date().getDate() // days passed this month
    } else if (dateRange === 'all') {
      daysToGenerate = 30; // fallback chart to 30 days for visual clarity if "all time"
    }
    
    let q = supabase.from('orders').select('created_at, total, status')
    if (startDate) q = q.gte('created_at', startDate.toISOString())
    if (branchId) q = q.eq('branch_id', branchId)
    
    const { data: ordersData } = await q
    
    let revenue = 0
    let count = 0
    const dailyMap = {}
    
    for(let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      dailyMap[dateStr] = { 
        date: daysToGenerate <= 7 ? d.toLocaleDateString('en-US', {weekday:'short'}) : d.toLocaleDateString('en-US', {month:'short', day:'numeric'}), 
        revenue: 0, 
        orders: 0 
      }
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
        <select className="input w-48" value={dateRange} onChange={e => setDateRange(e.target.value)}>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="this_month">This Month</option>
          <option value="all">All Time</option>
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
        <h3 className="font-bold text-lg mb-6 text-dash-text dark:text-dash-textDark">Revenue Trend</h3>
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
