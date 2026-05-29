import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { BarChart2, TrendingUp, DollarSign, Package, Calendar, Clock, Eye, Download, Info } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

const NOTES = [2000, 500, 200, 100, 50, 20, 10]
const COINS = [20, 10, 5, 2, 1]
const ALL_DENOMS = [...NOTES, ...COINS]

export default function AnalyticsPage() {
  const { branchId, role } = useAuthStore()
  const [activeTab, setActiveTab] = useState('revenue') // 'revenue' | 'sessions'
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({ revenue: 0, orders: 0, profit: 0, avgOrder: 0 })
  const [chartData, setChartData] = useState([])
  const [dateRange, setDateRange] = useState('7d')
  const [customRange, setCustomRange] = useState({ 
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  // Sessions Tab states
  const [sessionsList, setSessionsList] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionPayments, setSessionPayments] = useState([])
  const [sessionCashFlow, setSessionCashFlow] = useState([])

  useEffect(() => {
    if (activeTab === 'revenue') {
      fetchAnalytics()
    } else {
      fetchSessions()
    }
  }, [branchId, activeTab, dateRange, customRange])

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionDetails(selectedSessionId)
    }
  }, [selectedSessionId])

  async function fetchSessions() {
    setLoading(true)
    const branch = branchId || 'gurukul'
    const { data, error } = await supabase
      .from('business_sessions')
      .select('*, users!opened_by(username)')
      .eq('branch_id', branch)
      .order('start_time', { ascending: false })
      .limit(30)

    if (!error && data) {
      setSessionsList(data)
      if (data.length > 0) {
        setSelectedSessionId(data[0].id)
      }
    }
    setLoading(false)
  }

  async function loadSessionDetails(sId) {
    const sess = sessionsList.find(s => s.id === sId)
    if (!sess) return
    setSelectedSession(sess)

    // Load payments for orders in this session
    const { data: orders } = await supabase
      .from('orders')
      .select('total, order_payments(mode, amount)')
      .eq('session_id', sId)
      .neq('status', 'cancelled')

    const byMode = { CASH: 0, ONLINE: 0, KHATA: 0, ADVANCE: 0 }
    if (orders) {
      orders.forEach(o => {
        ;(o.order_payments || []).forEach(p => {
          const mode = p.mode === 'ONLINE' ? 'ONLINE' : p.mode
          byMode[mode] = (byMode[mode] || 0) + Number(p.amount)
        })
      })
    }
    setSessionPayments(Object.entries(byMode).map(([mode, amount]) => ({ mode, amount })))

    // Load cash session movements for this session
    const { data: cashFlow } = await supabase
      .from('cash_sessions')
      .select('*, users!recorded_by(username)')
      .eq('business_session_id', sId)
      .order('created_at', { ascending: true })

    setSessionCashFlow(cashFlow || [])
  }

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
          <div className="flex gap-4 mt-2">
            <button
              onClick={() => setActiveTab('revenue')}
              className={`text-sm font-bold pb-1 border-b-2 transition-all ${activeTab === 'revenue' ? 'border-ember text-ember' : 'border-transparent text-ink-50 hover:text-ink-700'}`}
            >
              Revenue & Performance
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`text-sm font-bold pb-1 border-b-2 transition-all ${activeTab === 'sessions' ? 'border-ember text-ember' : 'border-transparent text-ink-50 hover:text-ink-700'}`}
            >
              Business Sessions Audit
            </button>
          </div>
        </div>
        
        {activeTab === 'revenue' && (
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
        )}
      </div>

      {activeTab === 'revenue' ? (
        <>
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
        </>
      ) : (
        /* Sessions Sub-tab */
        <div className="space-y-6">
          <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs">Select Audit Session</h3>
                <p className="text-xs text-ink-500 font-semibold mt-1">Reviewing EOD cash, SOD opening, discrepancies, and transaction ledgers</p>
              </div>
              <select
                className="select font-bold text-sm w-full md:w-80"
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
              >
                {sessionsList.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.session_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · Status: {s.status.toUpperCase()} ({s.users?.username || 'unknown'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedSession && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Summary Audit Cards */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 shadow-sm space-y-4">
                  <h4 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs border-b border-ink-100 dark:border-ink-800 pb-3 flex items-center gap-2">
                    <Clock size={16} className="text-ember" /> Session Financial Summary
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Opening Balance', val: selectedSession.opening_balance, color: 'text-ink-900 dark:text-white' },
                      { label: 'Closing Balance Counted', val: selectedSession.closing_balance ?? 'N/A', color: 'text-indigo-600' },
                      { label: 'Revenue Generated', val: selectedSession.total_revenue, color: 'text-emerald-600' },
                      { label: 'Recorded Expenses', val: selectedSession.total_expenses, color: 'text-red-600' },
                      { label: 'Recorded Cash Expenses', val: selectedSession.total_cash_expenses ?? selectedSession.total_expenses, color: 'text-orange-600' },
                      { label: 'Expected Final Cash', val: Number(selectedSession.opening_balance) + Number(selectedSession.total_cash) - Number(selectedSession.total_cash_expenses ?? selectedSession.total_expenses), color: 'text-ink-900 dark:text-white' },
                    ].map(card => (
                      <div key={card.label} className="bg-ink-50 dark:bg-ink-950 p-4 rounded-2xl border border-ink-100 dark:border-ink-800">
                        <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest leading-none block">{card.label}</span>
                        <span className={`font-black text-xl block mt-2 ${card.color}`}>
                          {typeof card.val === 'number' ? `₹${card.val.toLocaleString('en-IN')}` : card.val}
                        </span>
                      </div>
                    ))}

                    {/* Discrepancy Card */}
                    {selectedSession.closing_balance !== null && (
                      <div className={`p-4 rounded-2xl border ${
                        Math.abs(Number(selectedSession.closing_balance) - (Number(selectedSession.opening_balance) + Number(selectedSession.total_cash) - Number(selectedSession.total_cash_expenses ?? selectedSession.total_expenses))) > 0
                          ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-600'
                          : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-600'
                      }`}>
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none block">Discrepancy</span>
                        <span className="font-black text-xl block mt-2">
                          ₹{(Number(selectedSession.closing_balance) - (Number(selectedSession.opening_balance) + Number(selectedSession.total_cash) - Number(selectedSession.total_cash_expenses ?? selectedSession.total_expenses))).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SOD vs EOD Denomination Side by Side */}
                <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 shadow-sm">
                  <h4 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs border-b border-ink-100 dark:border-ink-800 pb-3 mb-4">
                    🔍 Denomination Audit Comparison (SOD vs EOD)
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Opening breakdown */}
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Opening Denominations (SOD)</p>
                      <div className="space-y-1.5">
                        {ALL_DENOMS.map(d => {
                          const count = selectedSession.opening_cash_breakdown?.[d] || 0
                          if (!count) return null
                          return (
                            <div key={d} className="flex justify-between items-center text-xs font-semibold text-ink-600 dark:text-ink-400">
                              <span>₹{d} × {count}</span>
                              <span className="font-bold">₹{d * count}</span>
                            </div>
                          )
                        })}
                        {Object.keys(selectedSession.opening_cash_breakdown || {}).length === 0 && (
                          <span className="text-xs text-ink-400">No opening breakdown counted</span>
                        )}
                      </div>
                    </div>
                    {/* Closing breakdown */}
                    <div className="border-l border-ink-100 dark:border-ink-800 pl-6">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Closing Denominations (EOD)</p>
                      <div className="space-y-1.5">
                        {ALL_DENOMS.map(d => {
                          const count = selectedSession.closing_cash_breakdown?.[d] || 0
                          if (!count) return null
                          return (
                            <div key={d} className="flex justify-between items-center text-xs font-semibold text-ink-600 dark:text-ink-400">
                              <span>₹{d} × {count}</span>
                              <span className="font-bold">₹{d * count}</span>
                            </div>
                          )
                        })}
                        {(!selectedSession.closing_cash_breakdown || Object.keys(selectedSession.closing_cash_breakdown).length === 0) && (
                          <span className="text-xs text-ink-400">No closing breakdown counted</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session specific cash movement logs */}
                <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50">
                    <h5 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs">Session Cash Logs</h5>
                  </div>
                  {sessionCashFlow.length === 0 ? (
                    <div className="p-6 text-center text-ink-400 font-bold">No cash transactions during this session</div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-ink-50 dark:bg-ink-950 text-ink-500 font-black uppercase tracking-widest border-b border-ink-100 dark:border-ink-800">
                          <th className="px-6 py-3">Time</th>
                          <th className="px-6 py-3">Type</th>
                          <th className="px-6 py-3">Amount</th>
                          <th className="px-6 py-3">Notes</th>
                          <th className="px-6 py-3">By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                        {sessionCashFlow.map(flow => (
                          <tr key={flow.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-950/30">
                            <td className="px-6 py-3 whitespace-nowrap text-ink-500 font-bold">
                              {new Date(flow.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-6 py-3">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                flow.type === 'ADDITION' || flow.type === 'OPENING'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                                  : flow.type === 'WITHDRAWAL'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30'
                                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30'
                              }`}>
                                {flow.type}
                              </span>
                            </td>
                            <td className="px-6 py-3 font-bold text-ink-900 dark:text-white">
                              ₹{Number(flow.total_amount).toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-3 font-medium text-ink-500 max-w-xs truncate">
                              {flow.reason || (flow.category ? `Category: ${flow.category}` : '')}
                            </td>
                            <td className="px-6 py-3 text-ink-400 font-bold">{flow.users?.username || 'System'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right Column: Payment Methods Pie Breakdown / Metadata */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 shadow-sm space-y-4">
                  <h4 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs border-b border-ink-100 dark:border-ink-800 pb-3">
                    💳 Payment Breakdown
                  </h4>
                  <div className="space-y-3">
                    {sessionPayments.map(p => (
                      <div key={p.mode} className="bg-ink-50 dark:bg-ink-950 p-3 rounded-xl border border-ink-100 dark:border-ink-800 flex justify-between items-center">
                        <span className="text-xs font-black text-ink-500 uppercase tracking-wider">{p.mode}</span>
                        <span className="font-black text-sm text-ink-900 dark:text-white">₹{p.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 shadow-sm space-y-3 text-xs text-ink-500 leading-relaxed">
                  <h4 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs border-b border-ink-100 dark:border-ink-800 pb-3">
                    ℹ️ Audit Details
                  </h4>
                  <p><strong>Session ID:</strong> {selectedSession.id}</p>
                  <p><strong>Session Date:</strong> {selectedSession.session_date}</p>
                  <p><strong>Start Time:</strong> {new Date(selectedSession.start_time).toLocaleString('en-IN')}</p>
                  <p><strong>End Time:</strong> {selectedSession.end_time ? new Date(selectedSession.end_time).toLocaleString('en-IN') : 'Still Open'}</p>
                  {selectedSession.notes && <p><strong>Notes:</strong> {selectedSession.notes}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
