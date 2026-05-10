import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { BarChart2, TrendingUp, DollarSign, Package, Calendar } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

export default function AnalyticsPage() {
  const { branchId, role } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({ revenue: 0, orders: 0, profit: 0, avgOrder: 0 })
  const [chartData, setChartData] = useState([])
  const [dateRange, setDateRange] = useState('7d')
  const [customRange, setCustomRange] = useState({ 
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  useEffect(() => { fetchAnalytics() }, [branchId, dateRange, customRange])

  async function fetchAnalytics() {
    setLoading(true)
    
    let startDate = null;
    let endDate = new Date();
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
      startDate.setDate(1)
      daysToGenerate = new Date().getDate()
    } else if (dateRange === 'custom') {
      startDate = new Date(customRange.start)
      endDate = new Date(customRange.end)
      daysToGenerate = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
    } else if (dateRange === 'all') {
      daysToGenerate = 30;
    }
    
    let q = supabase.from('orders').select('created_at, total, status')
    if (startDate) q = q.gte('created_at', startDate.toISOString())
    if (dateRange === 'custom') q = q.lte('created_at', new Date(endDate.setHours(23,59,59,999)).toISOString())
    if (branchId) q = q.eq('branch_id', branchId)
    
    const { data: ordersData } = await q
    
    let revenue = 0
    let count = 0
    const dailyMap = {}
    
    for(let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date(endDate)
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
      profit: revenue * 0.45
    })
    
    setChartData(Object.values(dailyMap))
    setLoading(false)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight">Analytics & Financials</h1>
          <p className="text-sm font-semibold text-ink-500 mt-1 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={14} className="text-ember" /> 
            {dateRange === 'custom' ? `${customRange.start} to ${customRange.end}` : dateRange.replace('_',' ')} Report
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-ink-900 p-1.5 rounded-xl border border-ink-200 dark:border-ink-800 shadow-sm">
          {['7d', '30d', 'this_month', 'custom'].map(r => (
            <button 
              key={r} 
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${dateRange === r ? 'bg-ember text-white shadow-md shadow-ember/20' : 'text-ink-500 hover:text-ink-900 dark:hover:text-white'}`}
            >
              {r.replace('_',' ')}
            </button>
          ))}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 pl-3 ml-1 border-l border-ink-100 dark:border-ink-800">
              <input type="date" className="bg-transparent text-xs font-bold text-ink-900 dark:text-white focus:outline-none" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} />
              <span className="text-ink-300">to</span>
              <input type="date" className="bg-transparent text-xs font-bold text-ink-900 dark:text-white focus:outline-none" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} />
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-ink-900 p-5 rounded-2xl border border-ink-100 dark:border-ink-800 shadow-sm flex flex-col gap-1 transition-all hover:scale-[1.02] cursor-default">
          <div className="flex justify-between items-center text-ink-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Total Revenue</span>
            <DollarSign size={16} className="text-ember" />
          </div>
          <p className="text-3xl font-black text-ink-900 dark:text-white">₹{metrics.revenue.toLocaleString('en-IN')}</p>
        </div>
        
        <div className="bg-white dark:bg-ink-900 p-5 rounded-2xl border border-ink-100 dark:border-ink-800 shadow-sm flex flex-col gap-1 transition-all hover:scale-[1.02] cursor-default">
          <div className="flex justify-between items-center text-ink-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Total Orders</span>
            <Package size={16} className="text-indigo-500" />
          </div>
          <p className="text-3xl font-black text-ink-900 dark:text-white">{metrics.orders.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-ink-900 p-5 rounded-2xl border border-ink-100 dark:border-ink-800 shadow-sm flex flex-col gap-1 transition-all hover:scale-[1.02] cursor-default">
          <div className="flex justify-between items-center text-ink-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Avg Order Value</span>
            <TrendingUp size={16} className="text-blue-500" />
          </div>
          <p className="text-3xl font-black text-ink-900 dark:text-white">₹{Math.round(metrics.avgOrder)}</p>
        </div>

        <div className="bg-white dark:bg-ink-900 p-5 rounded-2xl border border-ink-100 dark:border-ink-800 shadow-sm flex flex-col gap-1 transition-all hover:scale-[1.02] cursor-default">
          <div className="flex justify-between items-center text-ink-400">
            <span className="text-[10px] font-black uppercase tracking-widest">Est. Gross Profit</span>
            <BarChart2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">₹{Math.round(metrics.profit).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white dark:bg-ink-900 p-6 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-sm">
        <h3 className="font-black text-lg mb-8 text-ink-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
          <div className="w-1.5 h-6 bg-ember rounded-full"></div>
          Revenue Performance Trend
        </h3>
        {loading ? (
          <div className="h-80 w-full flex items-center justify-center text-ink-400 font-bold animate-pulse uppercase tracking-widest">Compiling Analytics...</div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E67E22" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#E67E22" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#888" opacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff', borderRadius: '12px', padding: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
                  itemStyle={{ color: '#E67E22', fontWeight: 'bold' }}
                  cursor={{ stroke: '#E67E22', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#E67E22" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
