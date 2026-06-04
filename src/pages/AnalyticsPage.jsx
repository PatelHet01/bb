import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import {
  BarChart2, TrendingUp, TrendingDown, DollarSign, Package,
  Clock, CreditCard, Users, Wallet
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

// ─── Constants ────────────────────────────────────────────────────────────────
const NOTES = [2000, 500, 200, 100, 50, 20, 10]
const COINS = [20, 10, 5, 2, 1]

const PRESETS = [
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
  { key: '7d',         label: 'Last 7 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'all',        label: 'All Time' },
  { key: 'custom',     label: 'Custom' },
]

const PAYMENT_COLORS = {
  CASH:    '#10b981',
  UPI:     '#6366f1',
  ONLINE:  '#6366f1',
  CARD:    '#6366f1',
  KHATA:   '#f59e0b',
  ADVANCE: '#3b82f6',
  GHODA:   '#ec4899',
}

const BRANCH_COLORS = {
  gurukul: '#E67E22',
  bhat:    '#6366f1',
  visat:   '#10b981',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeDateRange(filter, customStart, customEnd) {
  const now = new Date()
  let start = null
  let end = new Date(now)
  end.setHours(23, 59, 59, 999)

  if (filter === 'today') {
    start = new Date(now); start.setHours(0, 0, 0, 0)
  } else if (filter === 'yesterday') {
    start = new Date(now); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0)
    end   = new Date(now); end.setDate(end.getDate() - 1);     end.setHours(23, 59, 59, 999)
  } else if (filter === '7d') {
    start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0)
  } else if (filter === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  } else if (filter === 'custom') {
    start = customStart ? new Date(customStart) : null
    end   = customEnd   ? new Date(customEnd)   : new Date()
    end.setSeconds(59, 999)
  }
  // 'all' → start = null, no filter

  return { start, end }
}

function getMonthYearsInRange(start, end) {
  if (!start) return null
  const months = []
  const d = new Date(start.getFullYear(), start.getMonth(), 1)
  const endD = new Date(end.getFullYear(), end.getMonth(), 1)
  while (d <= endD) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() + 1)
  }
  return months
}

const fmtRs  = n => `₹${Math.round(n || 0).toLocaleString('en-IN')}`
const fmtNum = n => Math.round(n || 0).toLocaleString('en-IN')

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color = 'text-ink-900 dark:text-white', Icon, iconColor }) {
  return (
    <div className="bg-white dark:bg-ink-900 p-5 rounded-2xl border border-ink-100 dark:border-ink-800 shadow-sm flex flex-col gap-1 transition-all hover:scale-[1.02] cursor-default">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest leading-none">{label}</span>
        {Icon && <Icon size={15} className={iconColor || 'text-ember'} />}
      </div>
      <p className={`text-2xl font-black mt-1 leading-tight ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-400 font-semibold leading-none">{sub}</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { branchId, role } = useAuthStore()

  const [activeTab,    setActiveTab]    = useState('financials')
  const [loading,      setLoading]      = useState(true)
  const [timeFilter,   setTimeFilter]   = useState('7d')
  const [customStart,  setCustomStart]  = useState('')
  const [customEnd,    setCustomEnd]    = useState('')
  const [finData,      setFinData]      = useState(null)

  // Sessions tab state (unchanged)
  const [sessionsList,      setSessionsList]      = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [selectedSession,   setSelectedSession]   = useState(null)
  const [sessionPayments,   setSessionPayments]   = useState([])
  const [sessionCashFlow,   setSessionCashFlow]   = useState([])

  const dateRange = useMemo(
    () => computeDateRange(timeFilter, customStart, customEnd),
    [timeFilter, customStart, customEnd]
  )

  useEffect(() => {
    if (activeTab === 'financials') fetchFinancials()
    else fetchSessions()
  }, [branchId, activeTab, dateRange])

  useEffect(() => {
    if (selectedSessionId) loadSessionDetails(selectedSessionId)
  }, [selectedSessionId])

  // ── Fetch all financial data in parallel ───────────────────────────────────
  async function fetchFinancials() {
    setLoading(true)
    const { start, end } = dateRange
    const branch = branchId
    const months = getMonthYearsInRange(start, end)

    // 1. Orders + payments + items (for CP/SP gross profit)
    let oq = supabase
      .from('orders')
      .select(`
        id, total, discount, status, branch_id, created_at,
        order_payments(mode, amount),
        order_items(quantity, price, items(cost_price))
      `)
      .neq('status', 'cancelled')
    if (branch) oq = oq.eq('branch_id', branch)
    if (start)  oq = oq.gte('created_at', start.toISOString())
    if (end)    oq = oq.lte('created_at', end.toISOString())

    // 2. Expenses (filter by expense_date)
    let eq2 = supabase
      .from('expenses')
      .select('id, amount, category, expense_date, branch_id')
    if (branch) eq2 = eq2.eq('branch_id', branch)
    if (start)  eq2 = eq2.gte('expense_date', start.toISOString().split('T')[0])
    if (end)    eq2 = eq2.lte('expense_date', end.toISOString().split('T')[0])

    // 3. Khata ledger
    let kq = supabase
      .from('khata_ledger')
      .select('id, amount, type, branch_id, created_at')
    if (branch) kq = kq.eq('branch_id', branch)
    if (start)  kq = kq.gte('created_at', start.toISOString())
    if (end)    kq = kq.lte('created_at', end.toISOString())

    // 4. Salary records with workers (branch filter client-side as fallback)
    let sq = supabase
      .from('salary_records')
      .select('id, net_payable, advance_taken, status, month_year, workers(name, branch_id)')
    if (months) sq = sq.in('month_year', months)

    // 5. Ghoda spendings
    let gq = supabase
      .from('ghoda_transactions')
      .select('id, amount, type, branch_id, created_at')
      .eq('type', 'spend')
    if (branch) gq = gq.eq('branch_id', branch)
    if (start)  gq = gq.gte('created_at', start.toISOString())
    if (end)    gq = gq.lte('created_at', end.toISOString())

    const [ordersRes, expensesRes, khataRes, salaryRes, ghodaRes] = await Promise.all([
      oq, eq2, kq, sq, gq
    ])

    const orders   = ordersRes.data   || []
    const expenses = expensesRes.data || []
    const khata    = khataRes.data    || []
    const salary   = salaryRes.data   || []
    const ghoda    = ghodaRes.data    || []

    // ── Aggregate orders ────────────────────────────────────────────────────
    let totalRevenue = 0, totalDiscount = 0, orderCount = 0, grossProfit = 0
    const paymentModes = {}
    const dailyMap   = {}   // date → { revenue, expenses, orders, grossProfit }
    const branchMap  = {}   // branch_id → metrics

    const ensureBranch = (bid) => {
      if (!branchMap[bid]) branchMap[bid] = { revenue: 0, expenses: 0, orders: 0, grossProfit: 0, salary: 0 }
    }
    const ensureDay = (dateStr) => {
      if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, revenue: 0, expenses: 0, orders: 0, grossProfit: 0 }
    }

    orders.forEach(o => {
      const rev  = Number(o.total || 0)
      const disc = Number(o.discount || 0)
      totalRevenue  += rev
      totalDiscount += disc
      orderCount++

      const dateStr = o.created_at.split('T')[0]
      ensureDay(dateStr)
      dailyMap[dateStr].revenue += rev
      dailyMap[dateStr].orders++

      const bid = o.branch_id
      ensureBranch(bid)
      branchMap[bid].revenue += rev
      branchMap[bid].orders++

      // Payment mode aggregation
      ;(o.order_payments || []).forEach(p => {
        const m = ['UPI', 'CARD', 'ONLINE'].includes(p.mode) ? 'UPI' : p.mode
        paymentModes[m] = (paymentModes[m] || 0) + Number(p.amount)
      })

      // CP vs SP gross profit per order
      let orderGross = 0
      ;(o.order_items || []).forEach(oi => {
        const sp  = Number(oi.price || 0)
        const cp  = Number(oi.items?.cost_price || 0)
        const qty = Number(oi.quantity || 0)
        orderGross += (sp - cp) * qty
      })
      grossProfit += orderGross
      dailyMap[dateStr].grossProfit += orderGross
      branchMap[bid].grossProfit    += orderGross
    })

    const netRevenue = totalRevenue - totalDiscount
    const avgOrder   = orderCount > 0 ? totalRevenue / orderCount : 0

    // ── Aggregate expenses ──────────────────────────────────────────────────
    let totalExpenses = 0
    const expByCategory = {}

    expenses.forEach(e => {
      totalExpenses += Number(e.amount || 0)
      expByCategory[e.category] = (expByCategory[e.category] || 0) + Number(e.amount || 0)
      const dateStr = e.expense_date
      ensureDay(dateStr)
      dailyMap[dateStr].expenses += Number(e.amount || 0)
      if (e.branch_id) {
        ensureBranch(e.branch_id)
        branchMap[e.branch_id].expenses += Number(e.amount || 0)
      }
    })

    // ── Aggregate khata ─────────────────────────────────────────────────────
    let khataCredit = 0, khataPayment = 0
    khata.forEach(k => {
      if (k.type === 'CREDIT')  khataCredit  += Number(k.amount || 0)
      if (k.type === 'PAYMENT') khataPayment += Number(k.amount || 0)
    })
    const khataNet = khataCredit - khataPayment

    // ── Aggregate salary ────────────────────────────────────────────────────
    let salaryPaid = 0, salaryPending = 0, advanceTaken = 0
    salary.forEach(s => {
      // Client-side branch filter
      if (branch && s.workers?.branch_id !== branch) return
      const net  = Number(s.net_payable || 0)
      const adv  = Number(s.advance_taken || 0)
      advanceTaken += adv
      if (s.status === 'paid') {
        salaryPaid += net
        const bid = s.workers?.branch_id
        if (bid) { ensureBranch(bid); branchMap[bid].salary += net }
      } else {
        salaryPending += net
      }
    })

    // ── Ghoda spendings ─────────────────────────────────────────────────────
    const totalGhodaSpend = ghoda.reduce((sum, g) => sum + Number(g.amount || 0), 0)

    // ── Net profit ───────────────────────────────────────────────────────────
    const netProfit = grossProfit - totalExpenses - salaryPaid

    // ── Format chart data ────────────────────────────────────────────────────
    const chartData = Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      }))

    const paymentBreakdown = Object.entries(paymentModes)
      .map(([mode, amount]) => ({ mode, amount }))
      .sort((a, b) => b.amount - a.amount)

    const expCategoryBreakdown = Object.entries(expByCategory)
      .map(([cat, amount]) => ({ cat, amount }))
      .sort((a, b) => b.amount - a.amount)

    const branchBreakdown = Object.entries(branchMap)
      .map(([bid, m]) => ({
        branch:    bid,
        ...m,
        netProfit: m.grossProfit - m.expenses - (m.salary || 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)

    setFinData({
      totalRevenue, netRevenue, totalDiscount, orderCount, avgOrder,
      grossProfit, netProfit,
      totalExpenses, expByCategory: expCategoryBreakdown,
      khataCredit, khataPayment, khataNet,
      salaryPaid, salaryPending, advanceTaken,
      totalGhodaSpend,
      paymentBreakdown,
      chartData,
      branchBreakdown,
    })
    setLoading(false)
  }

  // ── Sessions tab (unchanged logic) ─────────────────────────────────────────
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
      if (data.length > 0) setSelectedSessionId(data[0].id)
    }
    setLoading(false)
  }

  async function loadSessionDetails(sId) {
    const sess = sessionsList.find(s => s.id === sId)
    if (!sess) return
    setSelectedSession(sess)

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

    const { data: cashFlow } = await supabase
      .from('cash_sessions')
      .select('*, users!recorded_by(username)')
      .eq('business_session_id', sId)
      .order('created_at', { ascending: true })
    setSessionCashFlow(cashFlow || [])
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight">Analytics & Financials</h1>
          <div className="flex gap-4 mt-2">
            {[['financials', 'Financials'], ['sessions', 'Session Audit']].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`text-sm font-bold pb-1 border-b-2 transition-all ${activeTab === key ? 'border-ember text-ember' : 'border-transparent text-ink-500 hover:text-ink-700 dark:hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'financials' && (
          <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-ink-900 p-1.5 rounded-xl border border-ink-200 dark:border-ink-800 shadow-sm">
            {PRESETS.map(f => (
              <button key={f.key} onClick={() => setTimeFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${timeFilter === f.key ? 'bg-ember text-white shadow-md shadow-ember/20' : 'text-ink-500 hover:text-ink-900 dark:hover:text-white'}`}>
                {f.label}
              </button>
            ))}
            {timeFilter === 'custom' && (
              <div className="flex items-center gap-2 ml-1 pl-2 border-l border-ink-100 dark:border-ink-800">
                <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest flex items-center gap-1 pr-2 border-r border-ink-100 dark:border-ink-700">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  From
                </span>
                <input type="datetime-local"
                  className="bg-transparent text-xs font-bold text-ink-900 dark:text-white focus:outline-none"
                  value={customStart} onChange={e => setCustomStart(e.target.value)} />
                <span className="text-ink-300 text-sm font-bold px-1">→</span>
                <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest flex items-center gap-1 pr-2 border-r border-ink-100 dark:border-ink-700">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  To
                </span>
                <input type="datetime-local"
                  className="bg-transparent text-xs font-bold text-ink-900 dark:text-white focus:outline-none"
                  value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════ FINANCIALS TAB ═══════════════════ */}
      {activeTab === 'financials' && (
        loading ? (
          <div className="h-60 flex items-center justify-center text-ink-400 font-black animate-pulse uppercase tracking-widest text-sm">
            Computing Financials...
          </div>
        ) : finData ? (
          <div className="space-y-6">

            {/* KPI Row 1 — Revenue & Profit */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Total Revenue"       value={fmtRs(finData.totalRevenue)}
                Icon={DollarSign} iconColor="text-ember" />
              <KPICard label="Net Revenue"         value={fmtRs(finData.netRevenue)}
                sub={`Discount: ${fmtRs(finData.totalDiscount)}`}
                Icon={TrendingUp} iconColor="text-blue-500" />
              <KPICard label="Gross Profit (SP−CP)" value={fmtRs(finData.grossProfit)}
                color="text-emerald-600 dark:text-emerald-400"
                Icon={BarChart2} iconColor="text-emerald-500" />
              <KPICard label="Net Profit"          value={fmtRs(finData.netProfit)}
                sub="After expenses & salary"
                color={finData.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}
                Icon={finData.netProfit >= 0 ? TrendingUp : TrendingDown}
                iconColor={finData.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'} />
            </div>

            {/* KPI Row 2 — Operations */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Total Orders"     value={fmtNum(finData.orderCount)}
                Icon={Package} iconColor="text-indigo-500" />
              <KPICard label="Avg Order Value"  value={fmtRs(finData.avgOrder)}
                Icon={CreditCard} iconColor="text-purple-500" />
              <KPICard label="Total Expenses"   value={fmtRs(finData.totalExpenses)}
                color="text-red-600"
                Icon={Wallet} iconColor="text-red-500" />
              <KPICard label="Khata Outstanding" value={fmtRs(finData.khataNet)}
                sub={`Recovered: ${fmtRs(finData.khataPayment)}`}
                color="text-amber-600"
                Icon={Users} iconColor="text-amber-500" />
            </div>

            {/* Revenue vs Expenses Chart */}
            <div className="bg-white dark:bg-ink-900 p-6 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-sm">
              <h3 className="font-black text-sm mb-6 text-ink-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                <div className="w-1.5 h-5 bg-ember rounded-full" />
                Daily Revenue vs Expenses
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={finData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#E67E22" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#E67E22" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#888" opacity={0.1} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: '#888', fontWeight: 'bold' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff', borderRadius: '12px', padding: '12px', border: 'none' }}
                      formatter={(val, name) => [fmtRs(val), name === 'revenue' ? 'Revenue' : 'Expenses']}
                    />
                    <Legend formatter={v => v === 'revenue' ? 'Revenue' : 'Expenses'} />
                    <Area type="monotone" dataKey="revenue"  stroke="#E67E22" strokeWidth={3} fillOpacity={1} fill="url(#gRev)" />
                    <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#gExp)" strokeDasharray="4 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Modes + Expense Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Payment Mode Breakdown */}
              <div className="bg-white dark:bg-ink-900 p-6 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-sm space-y-4">
                <h3 className="font-black text-xs uppercase tracking-widest text-ink-900 dark:text-white flex items-center gap-2">
                  <CreditCard size={14} className="text-indigo-500" /> Payment Mode Breakdown
                </h3>
                {finData.paymentBreakdown.length === 0 ? (
                  <p className="text-xs text-ink-400 font-bold">No payment data</p>
                ) : (
                  finData.paymentBreakdown.map(p => {
                    const pct   = finData.totalRevenue > 0 ? (p.amount / finData.totalRevenue * 100) : 0
                    const color = PAYMENT_COLORS[p.mode] || '#888'
                    return (
                      <div key={p.mode} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-ink-700 dark:text-ink-300">
                          <span>{p.mode}</span>
                          <span>{fmtRs(p.amount)} <span className="text-ink-400 font-semibold">({pct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    )
                  })
                )}
                {/* Ghoda spendings */}
                {finData.totalGhodaSpend > 0 && (
                  <div className="pt-3 border-t border-ink-100 dark:border-ink-800 flex justify-between items-center">
                    <span className="text-xs font-black text-ink-500 uppercase tracking-wide">🐎 Ghoda Coins Spent</span>
                    <span className="font-black text-sm text-pink-500">{fmtNum(finData.totalGhodaSpend)} coins</span>
                  </div>
                )}
              </div>

              {/* Expense Categories */}
              <div className="bg-white dark:bg-ink-900 p-6 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-sm space-y-4">
                <h3 className="font-black text-xs uppercase tracking-widest text-ink-900 dark:text-white flex items-center gap-2">
                  <Wallet size={14} className="text-red-500" /> Expenses by Category
                </h3>
                {finData.expByCategory.length === 0 ? (
                  <p className="text-xs text-ink-400 font-bold">No expenses recorded</p>
                ) : (
                  finData.expByCategory.map(e => {
                    const pct = finData.totalExpenses > 0 ? (e.amount / finData.totalExpenses * 100) : 0
                    return (
                      <div key={e.cat} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-ink-700 dark:text-ink-300">
                          <span>{e.cat}</span>
                          <span>{fmtRs(e.amount)} <span className="text-ink-400 font-semibold">({pct.toFixed(1)}%)</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
                          <div className="h-full rounded-full bg-red-400 transition-all duration-700"
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Khata + Salary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div className="bg-white dark:bg-ink-900 p-6 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-sm space-y-1">
                <h3 className="font-black text-xs uppercase tracking-widest text-ink-900 dark:text-white mb-3">📒 Khata Summary</h3>
                {[
                  { label: 'Credit Given',   val: finData.khataCredit,  color: 'text-amber-600' },
                  { label: 'Recovered',      val: finData.khataPayment, color: 'text-emerald-600' },
                  { label: 'Net Outstanding',val: finData.khataNet,     color: finData.khataNet > 0 ? 'text-red-600' : 'text-emerald-600' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-ink-50 dark:border-ink-800">
                    <span className="text-xs font-bold text-ink-500 uppercase tracking-wide">{row.label}</span>
                    <span className={`font-black text-sm ${row.color}`}>{fmtRs(row.val)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white dark:bg-ink-900 p-6 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-sm space-y-1">
                <h3 className="font-black text-xs uppercase tracking-widest text-ink-900 dark:text-white mb-3">👷 Salary Summary</h3>
                {[
                  { label: 'Salary Paid',    val: finData.salaryPaid,    color: 'text-emerald-600' },
                  { label: 'Salary Pending', val: finData.salaryPending, color: 'text-red-600' },
                  { label: 'Advance Taken',  val: finData.advanceTaken,  color: 'text-amber-600' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-ink-50 dark:border-ink-800">
                    <span className="text-xs font-bold text-ink-500 uppercase tracking-wide">{row.label}</span>
                    <span className={`font-black text-sm ${row.color}`}>{fmtRs(row.val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Branch-wise Breakdown */}
            {finData.branchBreakdown.length > 0 && (
              <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50">
                  <h3 className="font-black text-xs uppercase tracking-widest text-ink-900 dark:text-white">🏢 Branch-wise Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-ink-50 dark:bg-ink-950 text-ink-400 font-black uppercase tracking-widest border-b border-ink-100 dark:border-ink-800">
                        <th className="px-6 py-3">Branch</th>
                        <th className="px-6 py-3">Orders</th>
                        <th className="px-6 py-3">Revenue</th>
                        <th className="px-6 py-3">Gross Profit</th>
                        <th className="px-6 py-3">Expenses</th>
                        <th className="px-6 py-3">Salary</th>
                        <th className="px-6 py-3">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                      {finData.branchBreakdown.map(b => (
                        <tr key={b.branch} className="hover:bg-ink-50/50 dark:hover:bg-ink-950/30">
                          <td className="px-6 py-3 font-black capitalize"
                            style={{ color: BRANCH_COLORS[b.branch] || '#888' }}>{b.branch}</td>
                          <td className="px-6 py-3 font-bold text-ink-600 dark:text-ink-400">{fmtNum(b.orders)}</td>
                          <td className="px-6 py-3 font-bold text-ink-900 dark:text-white">{fmtRs(b.revenue)}</td>
                          <td className="px-6 py-3 font-bold text-emerald-600">{fmtRs(b.grossProfit)}</td>
                          <td className="px-6 py-3 font-bold text-red-600">{fmtRs(b.expenses)}</td>
                          <td className="px-6 py-3 font-bold text-amber-600">{fmtRs(b.salary)}</td>
                          <td className={`px-6 py-3 font-black ${b.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {fmtRs(b.netProfit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Daily Breakdown Table */}
            {finData.chartData.length > 0 && (
              <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50">
                  <h3 className="font-black text-xs uppercase tracking-widest text-ink-900 dark:text-white">📅 Daily Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-ink-50 dark:bg-ink-950 text-ink-400 font-black uppercase tracking-widest border-b border-ink-100 dark:border-ink-800">
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Orders</th>
                        <th className="px-6 py-3">Revenue</th>
                        <th className="px-6 py-3">Gross Profit</th>
                        <th className="px-6 py-3">Expenses</th>
                        <th className="px-6 py-3">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                      {[...finData.chartData].reverse().map(d => {
                        const net = d.grossProfit - d.expenses
                        return (
                          <tr key={d.date} className="hover:bg-ink-50/50 dark:hover:bg-ink-950/30">
                            <td className="px-6 py-3 font-bold text-ink-500">{d.label}</td>
                            <td className="px-6 py-3 font-bold text-ink-600 dark:text-ink-400">{d.orders}</td>
                            <td className="px-6 py-3 font-bold text-ink-900 dark:text-white">{fmtRs(d.revenue)}</td>
                            <td className="px-6 py-3 font-bold text-emerald-600">{fmtRs(d.grossProfit)}</td>
                            <td className="px-6 py-3 font-bold text-red-600">{fmtRs(d.expenses)}</td>
                            <td className={`px-6 py-3 font-black ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {fmtRs(net)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        ) : null
      )}

      {/* ═══════════════════ SESSIONS AUDIT TAB ═══════════════════ */}
      {activeTab === 'sessions' && (
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
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 shadow-sm space-y-4">
                  <h4 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs border-b border-ink-100 dark:border-ink-800 pb-3 flex items-center gap-2">
                    <Clock size={16} className="text-ember" /> Session Financial Summary
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Opening Balance',        val: selectedSession.opening_balance,                                                                                                           color: 'text-ink-900 dark:text-white' },
                      { label: 'Closing Balance Counted',val: selectedSession.closing_balance ?? 'N/A',                                                                                                  color: 'text-indigo-600' },
                      { label: 'Revenue Generated',      val: selectedSession.total_revenue,                                                                                                             color: 'text-emerald-600' },
                      { label: 'Recorded Expenses',      val: selectedSession.total_expenses,                                                                                                            color: 'text-red-600' },
                      { label: 'Recorded Cash Expenses', val: selectedSession.total_cash_expenses ?? selectedSession.total_expenses,                                                                     color: 'text-orange-600' },
                      { label: 'Expected Final Cash',    val: Number(selectedSession.opening_balance) + Number(selectedSession.total_cash) - Number(selectedSession.total_cash_expenses ?? selectedSession.total_expenses), color: 'text-ink-900 dark:text-white' },
                    ].map(card => (
                      <div key={card.label} className="bg-ink-50 dark:bg-ink-950 p-4 rounded-2xl border border-ink-100 dark:border-ink-800">
                        <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest leading-none block">{card.label}</span>
                        <span className={`font-black text-xl block mt-2 ${card.color}`}>
                          {typeof card.val === 'number' ? `₹${card.val.toLocaleString('en-IN')}` : card.val}
                        </span>
                      </div>
                    ))}
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

                {/* SOD vs EOD Denomination Comparison */}
                <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 shadow-sm">
                  <h4 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs border-b border-ink-100 dark:border-ink-800 pb-3 mb-4">
                    🔍 Denomination Audit Comparison (SOD vs EOD)
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Opening (SOD)</p>
                      <div className="space-y-1.5">
                        {NOTES.map(d => {
                          const count = selectedSession.opening_cash_breakdown?.[`note_${d}`] || selectedSession.opening_cash_breakdown?.[d] || 0
                          if (!count) return null
                          return (
                            <div key={`note_${d}`} className="flex justify-between items-center text-xs font-semibold text-ink-600 dark:text-ink-400">
                              <span>₹{d} Note × {count}</span>
                              <span className="font-bold">₹{d * count}</span>
                            </div>
                          )
                        })}
                        {COINS.map(d => {
                          const count = selectedSession.opening_cash_breakdown?.[`coin_${d}`] || (d <= 5 ? selectedSession.opening_cash_breakdown?.[d] : 0) || 0
                          if (!count) return null
                          return (
                            <div key={`coin_${d}`} className="flex justify-between items-center text-xs font-semibold text-ink-600 dark:text-ink-400">
                              <span>₹{d} Coin × {count}</span>
                              <span className="font-bold">₹{d * count}</span>
                            </div>
                          )
                        })}
                        {Object.keys(selectedSession.opening_cash_breakdown || {}).length === 0 && (
                          <span className="text-xs text-ink-400">No opening breakdown counted</span>
                        )}
                      </div>
                    </div>
                    <div className="border-l border-ink-100 dark:border-ink-800 pl-6">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Closing (EOD)</p>
                      <div className="space-y-1.5">
                        {NOTES.map(d => {
                          const count = selectedSession.closing_cash_breakdown?.[`note_${d}`] || selectedSession.closing_cash_breakdown?.[d] || 0
                          if (!count) return null
                          return (
                            <div key={`note_${d}`} className="flex justify-between items-center text-xs font-semibold text-ink-600 dark:text-ink-400">
                              <span>₹{d} Note × {count}</span>
                              <span className="font-bold">₹{d * count}</span>
                            </div>
                          )
                        })}
                        {COINS.map(d => {
                          const count = selectedSession.closing_cash_breakdown?.[`coin_${d}`] || (d <= 5 ? selectedSession.closing_cash_breakdown?.[d] : 0) || 0
                          if (!count) return null
                          return (
                            <div key={`coin_${d}`} className="flex justify-between items-center text-xs font-semibold text-ink-600 dark:text-ink-400">
                              <span>₹{d} Coin × {count}</span>
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

                {/* Session Cash Logs */}
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

              {/* Right Column */}
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
