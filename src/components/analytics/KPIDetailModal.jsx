import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { X, Download, TrendingUp, TrendingDown, AlertTriangle, Info } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine
} from 'recharts'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtRs  = n => `₹${Math.round(n || 0).toLocaleString('en-IN')}`
const fmtNum = n => Math.round(n || 0).toLocaleString('en-IN')
const fmtPct = n => `${(n || 0).toFixed(1)}%`

const marginColor = p =>
  p >= 40 ? 'text-emerald-600 dark:text-emerald-400' :
  p >= 20 ? 'text-amber-500' :
  p >= 0  ? 'text-red-500' : 'text-red-700 font-black'

const marginBadge = p =>
  p >= 40 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
  p >= 20 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' :
  p >= 0  ? 'bg-red-100 text-red-600 dark:bg-red-900/20' :
            'bg-red-200 text-red-800 dark:bg-red-900/40'

const TOOLTIP_STYLE = {
  backgroundColor: '#111', borderColor: '#333', color: '#fff',
  borderRadius: '10px', padding: '10px', border: 'none'
}

// ─── Period Options ────────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'inherited', label: 'Current Filter' },
  { key: 'today',     label: 'Today' },
  { key: '7d',        label: 'Last 7 Days' },
  { key: 'month',     label: 'This Month' },
]

function computeRange(period, inherited) {
  if (period === 'inherited') return inherited
  const now = new Date()
  if (period === 'today') {
    const s = new Date(now); s.setHours(0,0,0,0)
    const e = new Date(now); e.setHours(23,59,59,999)
    return { start: s, end: e }
  }
  if (period === '7d') {
    const s = new Date(now); s.setDate(s.getDate()-7); s.setHours(0,0,0,0)
    const e = new Date(now); e.setHours(23,59,59,999)
    return { start: s, end: e }
  }
  if (period === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    const e = new Date(now); e.setHours(23,59,59,999)
    return { start: s, end: e }
  }
  return inherited
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(type, data) {
  let headers = [], rows = []
  if (type === 'revenue') {
    headers = ['Period','Orders','Revenue','CASH','UPI','KHATA','ADVANCE']
    rows = data.byPeriod.map(p => [p.label, p.orders, p.revenue, p.CASH||0, p.UPI||0, p.KHATA||0, p.ADVANCE||0])
  } else if (type === 'netRevenue') {
    headers = ['Date','Orders','Gross','Discount','Net Revenue','Discount%']
    rows = data.byDay.map(d => [d.label, d.count, d.gross, d.discount, d.net, d.discPct.toFixed(1)])
  } else if (type === 'grossProfit') {
    headers = ['Item','Category','Qty','Total SP','Total CP','Profit','Margin%']
    rows = data.byItem.map(i => [i.name, i.category, i.qtySold, i.totalSP.toFixed(2), i.totalCP.toFixed(2), i.profit.toFixed(2), i.margin.toFixed(1)])
  } else if (type === 'netProfit') {
    headers = ['Date','Revenue','COGS','Gross Profit','Expenses','Net Profit','Running Total']
    rows = data.byDay.map(d => [d.label, d.revenue, d.cogs, d.grossProfit, d.expenses, d.netDay, d.running])
  } else if (type === 'orders') {
    headers = ['Date','Completed','Cancelled','Total','Revenue','Cancel Rate%']
    rows = data.byDay.map(d => [d.label, d.completed, d.cancelled, d.total, d.revenue, d.cancelRate.toFixed(1)])
  } else if (type === 'avgOrder') {
    headers = ['Date','AOV','Orders']
    rows = data.trend.map(d => [d.label, Math.round(d.aov), d.count || ''])
  } else if (type === 'expenses') {
    headers = ['Date','Category','Description','Amount','Mode','By']
    rows = data.list.map(e => [e.date, e.category, e.description || '', e.amount, e.mode, e.by])
  } else if (type === 'khata') {
    headers = ['Customer','Mobile','Credit (All-time)','Recovered','Outstanding','New Credit (Period)']
    rows = data.byCustomer.map(c => [c.name, c.mobile, c.credited, c.recovered, c.outstanding, c.newCredit])
  }
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

// ─── Data Fetchers ─────────────────────────────────────────────────────────────
async function fetchRevenue(range, branchId) {
  let q = supabase.from('orders')
    .select('id, total, created_at, order_payments(mode, amount)')
    .neq('status', 'cancelled')
  if (branchId) q = q.eq('branch_id', branchId)
  if (range.start) q = q.gte('created_at', range.start.toISOString())
  if (range.end)   q = q.lte('created_at', range.end.toISOString())
  const { data } = await q

  const spanDays = range.start ? Math.ceil((range.end - range.start) / 86400000) : 365
  const byHour = spanDays <= 1
  const periodMap = {}
  const payTotals = { CASH: 0, UPI: 0, KHATA: 0, ADVANCE: 0, GHODA: 0 }
  let totalRevenue = 0, orderCount = 0

  ;(data || []).forEach(o => {
    const d = new Date(o.created_at)
    const key   = byHour ? d.getHours() : o.created_at.split('T')[0]
    const label = byHour
      ? `${String(d.getHours()).padStart(2,'0')}:00`
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    if (!periodMap[key]) periodMap[key] = { label, revenue: 0, orders: 0, CASH:0, UPI:0, KHATA:0, ADVANCE:0, GHODA:0 }
    periodMap[key].revenue += Number(o.total)
    periodMap[key].orders++
    totalRevenue += Number(o.total); orderCount++
    ;(o.order_payments || []).forEach(p => {
      const m = ['UPI','ONLINE','CARD'].includes(p.mode) ? 'UPI' : p.mode
      periodMap[key][m] = (periodMap[key][m] || 0) + Number(p.amount)
      payTotals[m] = (payTotals[m] || 0) + Number(p.amount)
    })
  })

  const byPeriod = Object.entries(periodMap)
    .sort(([a],[b]) => String(a).localeCompare(String(b)))
    .map(([,v]) => v)
  const peak = byPeriod.reduce((mx,p) => p.revenue>(mx?.revenue||0)?p:mx, null)
  return { totalRevenue, orderCount, byPeriod, payTotals, peak, byHour }
}

async function fetchNetRevenue(range, branchId) {
  let q = supabase.from('orders')
    .select('id, order_number, total, discount, created_at, customers(name)')
    .neq('status', 'cancelled')
  if (branchId) q = q.eq('branch_id', branchId)
  if (range.start) q = q.gte('created_at', range.start.toISOString())
  if (range.end)   q = q.lte('created_at', range.end.toISOString())
  const { data } = await q

  let totalGross = 0, totalDiscount = 0
  const dayMap = {}
  ;(data || []).forEach(o => {
    const disc  = Number(o.discount || 0)
    const gross = Number(o.total) + disc
    totalGross    += gross; totalDiscount += disc
    const ds = o.created_at.split('T')[0]
    if (!dayMap[ds]) dayMap[ds] = { date: ds, gross: 0, discount: 0, net: 0, count: 0 }
    dayMap[ds].gross += gross; dayMap[ds].discount += disc
    dayMap[ds].net   += Number(o.total); dayMap[ds].count++
  })
  const byDay = Object.values(dayMap)
    .sort((a,b)=>a.date.localeCompare(b.date))
    .map(d => ({ ...d, label: new Date(d.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}), discPct: d.gross>0?(d.discount/d.gross)*100:0 }))

  const topDiscounted = [...(data||[])]
    .filter(o => Number(o.discount) > 0)
    .sort((a,b) => Number(b.discount)-Number(a.discount)).slice(0,10)
    .map(o => ({ num: o.order_number||'#'+o.id.slice(0,8).toUpperCase(), customer: o.customers?.name||'Guest', gross: Number(o.total)+Number(o.discount||0), discount: Number(o.discount), net: Number(o.total), date: new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) }))

  return { totalGross, totalDiscount, netRevenue: totalGross-totalDiscount, discountRate: totalGross>0?(totalDiscount/totalGross)*100:0, ordersWithDiscount: (data||[]).filter(o=>Number(o.discount)>0).length, byDay, topDiscounted }
}

async function fetchGrossProfit(range, branchId) {
  let q = supabase.from('orders')
    .select('id, created_at, order_items(quantity, price, items(name, category, cost_price))')
    .neq('status', 'cancelled')
  if (branchId) q = q.eq('branch_id', branchId)
  if (range.start) q = q.gte('created_at', range.start.toISOString())
  if (range.end)   q = q.lte('created_at', range.end.toISOString())
  const { data } = await q

  const itemMap = {}, catMap = {}
  let grossProfit = 0, totalCOGS = 0, totalSP = 0, noCPCount = 0

  ;(data || []).forEach(o => {
    ;(o.order_items || []).forEach(oi => {
      if (!oi.items) return
      const sp   = Number(oi.price), cp = Number(oi.items.cost_price || 0), qty = Number(oi.quantity)
      const noCP = oi.items.cost_price == null || oi.items.cost_price === 0
      if (noCP) noCPCount++
      const itemProfit = (sp - cp) * qty, spTotal = sp * qty, cpTotal = cp * qty
      grossProfit += itemProfit; totalCOGS += cpTotal; totalSP += spTotal
      const name = oi.items.name, cat = oi.items.category || 'Other'
      if (!itemMap[name]) itemMap[name] = { name, category: cat, qtySold:0, totalSP:0, totalCP:0, profit:0, noCP }
      itemMap[name].qtySold += qty; itemMap[name].totalSP += spTotal; itemMap[name].totalCP += cpTotal; itemMap[name].profit += itemProfit
      if (!catMap[cat]) catMap[cat] = { category: cat, revenue:0, cogs:0, profit:0 }
      catMap[cat].revenue += spTotal; catMap[cat].cogs += cpTotal; catMap[cat].profit += itemProfit
    })
  })

  const byItem = Object.values(itemMap)
    .map(i => ({ ...i, margin: i.totalSP>0?(i.profit/i.totalSP)*100:0 }))
    .sort((a,b) => b.profit-a.profit)
  const byCategory = Object.values(catMap)
    .map(c => ({ ...c, margin: c.revenue>0?(c.profit/c.revenue)*100:0 }))
    .sort((a,b) => b.profit-a.profit)

  return { grossProfit, totalCOGS, totalSP, grossMargin: totalSP>0?(grossProfit/totalSP)*100:0, byItem, byCategory, lossItems: byItem.filter(i=>i.profit<0), noCPCount }
}

async function fetchNetProfit(range, branchId) {
  let oq = supabase.from('orders')
    .select('id, total, discount, created_at, order_items(quantity, price, items(cost_price))')
    .neq('status', 'cancelled')
  if (branchId) oq = oq.eq('branch_id', branchId)
  if (range.start) oq = oq.gte('created_at', range.start.toISOString())
  if (range.end)   oq = oq.lte('created_at', range.end.toISOString())

  let eq = supabase.from('expenses').select('amount, expense_date')
  if (branchId) eq = eq.eq('branch_id', branchId)
  if (range.start) eq = eq.gte('expense_date', range.start.toISOString().split('T')[0])
  if (range.end)   eq = eq.lte('expense_date', range.end.toISOString().split('T')[0])

  const months = []
  if (range.start) {
    const d = new Date(range.start.getFullYear(), range.start.getMonth(), 1)
    const ed = new Date(range.end.getFullYear(), range.end.getMonth(), 1)
    while (d <= ed) { months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); d.setMonth(d.getMonth()+1) }
  }
  let sq = supabase.from('salary_records').select('net_payable, workers(branch_id)').eq('status','paid')
  if (months.length) sq = sq.in('month_year', months)

  const [{ data: orders }, { data: expenses }, { data: salary }] = await Promise.all([oq, eq, sq])

  let totalRevenue=0, totalDiscount=0, totalCOGS=0
  const dayMap = {}
  ;(orders||[]).forEach(o => {
    const rev = Number(o.total), disc = Number(o.discount||0)
    totalRevenue += rev; totalDiscount += disc
    let cogs = 0
    ;(o.order_items||[]).forEach(oi => { cogs += Number(oi.items?.cost_price||0)*Number(oi.quantity) })
    totalCOGS += cogs
    const ds = o.created_at.split('T')[0]
    if (!dayMap[ds]) dayMap[ds] = { date: ds, revenue:0, discount:0, cogs:0, expenses:0 }
    dayMap[ds].revenue += rev; dayMap[ds].discount += disc; dayMap[ds].cogs += cogs
  })
  let totalExpenses=0
  ;(expenses||[]).forEach(e => {
    totalExpenses += Number(e.amount)
    const ds = e.expense_date
    if (!dayMap[ds]) dayMap[ds] = { date: ds, revenue:0, discount:0, cogs:0, expenses:0 }
    dayMap[ds].expenses += Number(e.amount)
  })
  let salaryPaid=0
  ;(salary||[]).forEach(s => {
    if (branchId && s.workers?.branch_id !== branchId) return
    salaryPaid += Number(s.net_payable)
  })

  const netRevenue = totalRevenue - totalDiscount
  const grossProfit = netRevenue - totalCOGS
  const netProfit = grossProfit - totalExpenses - salaryPaid

  let running = 0
  const byDay = Object.values(dayMap)
    .sort((a,b) => a.date.localeCompare(b.date))
    .map(d => {
      const nr = d.revenue - d.discount, gp = nr - d.cogs, net = gp - d.expenses
      running += net
      return { ...d, label: new Date(d.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}), netRevenue: nr, grossProfit: gp, netDay: net, running }
    })

  return { totalRevenue, totalDiscount, netRevenue, totalCOGS, grossProfit, grossMargin: netRevenue>0?(grossProfit/netRevenue)*100:0, totalExpenses, salaryPaid, netProfit, netMargin: netRevenue>0?(netProfit/netRevenue)*100:0, byDay }
}

async function fetchOrders(range, branchId) {
  let q = supabase.from('orders')
    .select('id, total, status, created_at, order_items(quantity)')
  if (branchId) q = q.eq('branch_id', branchId)
  if (range.start) q = q.gte('created_at', range.start.toISOString())
  if (range.end)   q = q.lte('created_at', range.end.toISOString())
  const { data } = await q

  const hourMap = Array.from({length:24},(_,h)=>({hour:h, label:`${String(h).padStart(2,'0')}:00`, completed:0, cancelled:0}))
  const dayMap = {}
  let total=0, completed=0, cancelled=0, totalItems=0

  ;(data||[]).forEach(o => {
    const d = new Date(o.created_at), h = d.getHours(), isC = o.status==='cancelled'
    total++; if (isC) { cancelled++; hourMap[h].cancelled++ } else { completed++; hourMap[h].completed++ }
    totalItems += (o.order_items||[]).reduce((s,oi)=>s+Number(oi.quantity),0)
    const ds = o.created_at.split('T')[0]
    if (!dayMap[ds]) dayMap[ds] = { date: ds, completed:0, cancelled:0, total:0, revenue:0 }
    dayMap[ds].total++
    if (!isC) { dayMap[ds].completed++; dayMap[ds].revenue += Number(o.total) }
    else dayMap[ds].cancelled++
  })

  const byDay = Object.values(dayMap).sort((a,b)=>a.date.localeCompare(b.date))
    .map(d => ({ ...d, label: new Date(d.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}), cancelRate: d.total>0?(d.cancelled/d.total)*100:0 }))
  const peakHour = hourMap.reduce((mx,h) => h.completed>(mx?.completed||0)?h:mx, null)

  return { total, completed, cancelled, cancelRate: total>0?(cancelled/total)*100:0, avgItems: completed>0?totalItems/completed:0, byHour: hourMap, byDay, peakHour }
}

async function fetchAvgOrder(range, branchId) {
  let q = supabase.from('orders')
    .select('id, order_number, total, created_at, customers(name)')
    .neq('status','cancelled')
  if (branchId) q = q.eq('branch_id', branchId)
  if (range.start) q = q.gte('created_at', range.start.toISOString())
  if (range.end)   q = q.lte('created_at', range.end.toISOString())
  const { data } = await q
  const orders = data || []
  const tots = orders.map(o => Number(o.total))
  const sum = tots.reduce((s,v)=>s+v,0)
  const sorted = [...tots].sort((a,b)=>a-b)
  const BUCKETS = [
    {label:'< ₹50',min:0,max:50},{label:'₹50–100',min:50,max:100},
    {label:'₹100–200',min:100,max:200},{label:'₹200–500',min:200,max:500},{label:'> ₹500',min:500,max:Infinity}
  ]
  const dayMap = {}
  orders.forEach(o => {
    const ds = o.created_at.split('T')[0]
    if (!dayMap[ds]) dayMap[ds] = { date: ds, total: 0, count: 0 }
    dayMap[ds].total += Number(o.total); dayMap[ds].count++
  })
  return {
    aov: orders.length>0?sum/orders.length:0,
    count: orders.length,
    min: sorted[0]||0, max: sorted[sorted.length-1]||0,
    median: sorted.length>0?sorted[Math.floor(sorted.length/2)]:0,
    buckets: BUCKETS.map(b => ({
      label: b.label,
      count: tots.filter(t=>t>=b.min&&t<b.max).length,
      pct: orders.length>0?(tots.filter(t=>t>=b.min&&t<b.max).length/orders.length)*100:0
    })),
    trend: Object.values(dayMap).sort((a,b)=>a.date.localeCompare(b.date))
      .map(d => ({ label: new Date(d.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}), aov: d.count>0?d.total/d.count:0 })),
    topOrders: [...orders].sort((a,b)=>Number(b.total)-Number(a.total)).slice(0,10)
      .map(o => ({ num: o.order_number||'#'+o.id.slice(0,8).toUpperCase(), customer: o.customers?.name||'Guest', total: Number(o.total), date: new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) }))
  }
}

async function fetchExpenses(range, branchId) {
  let q = supabase.from('expenses').select('*').order('expense_date',{ascending:false})
  if (branchId) q = q.eq('branch_id', branchId)
  if (range.start) q = q.gte('expense_date', range.start.toISOString().split('T')[0])
  if (range.end)   q = q.lte('expense_date', range.end.toISOString().split('T')[0])
  const { data } = await q
  const expenses = data || []
  const total = expenses.reduce((s,e)=>s+Number(e.amount),0)
  const catMap={}, dayMap={}
  expenses.forEach(e => {
    catMap[e.category] = (catMap[e.category]||0)+Number(e.amount)
    dayMap[e.expense_date] = (dayMap[e.expense_date]||0)+Number(e.amount)
  })
  const spanDays = range.start?Math.max(1,Math.ceil((range.end-range.start)/86400000)):1
  return {
    total, count: expenses.length,
    avgPerDay: total/spanDays,
    maxSingle: expenses.reduce((mx,e)=>Number(e.amount)>mx?Number(e.amount):mx,0),
    byCategory: Object.entries(catMap).map(([c,a])=>({category:c,amount:a,pct:total>0?(a/total)*100:0})).sort((a,b)=>b.amount-a.amount),
    byDay: Object.entries(dayMap).sort(([a],[b])=>a.localeCompare(b))
      .map(([date,amount])=>({ date,amount, label: new Date(date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}) })),
    list: expenses.map(e => ({ id:e.id, date:e.expense_date, category:e.category, description:e.description||'—', amount:Number(e.amount), mode:e.payment_mode||'CASH', by:e.recorded_by||'—' }))
  }
}

async function fetchKhata(range, branchId) {
  let allQ = supabase.from('khata_ledger').select('customer_id, type, amount, customers(name, mobile_number)')
  if (branchId) allQ = allQ.eq('branch_id', branchId)

  let periodQ = supabase.from('khata_ledger').select('customer_id, amount').eq('type','CREDIT')
  if (branchId) periodQ = periodQ.eq('branch_id', branchId)
  if (range.start) periodQ = periodQ.gte('created_at', range.start.toISOString())
  if (range.end)   periodQ = periodQ.lte('created_at', range.end.toISOString())

  const [{ data: all }, { data: period }] = await Promise.all([allQ, periodQ])
  const custMap = {}
  ;(all||[]).forEach(k => {
    const cid = k.customer_id
    if (!custMap[cid]) custMap[cid] = { id:cid, name:k.customers?.name||'Unknown', mobile:k.customers?.mobile_number||'', credited:0, recovered:0, newCredit:0 }
    if (k.type==='CREDIT')  custMap[cid].credited  += Number(k.amount)
    if (k.type==='PAYMENT') custMap[cid].recovered += Number(k.amount)
  })
  ;(period||[]).forEach(k => { if (custMap[k.customer_id]) custMap[k.customer_id].newCredit += Number(k.amount) })
  const byCustomer = Object.values(custMap)
    .map(c => ({ ...c, outstanding: c.credited-c.recovered }))
    .sort((a,b) => b.outstanding-a.outstanding)
  return { totalOutstanding: byCustomer.reduce((s,c)=>s+c.outstanding,0), debtors: byCustomer.filter(c=>c.outstanding>0).length, total: byCustomer.length, byCustomer }
}

async function fetchModalData(type, range, branchId) {
  switch(type) {
    case 'revenue':     return fetchRevenue(range, branchId)
    case 'netRevenue':  return fetchNetRevenue(range, branchId)
    case 'grossProfit': return fetchGrossProfit(range, branchId)
    case 'netProfit':   return fetchNetProfit(range, branchId)
    case 'orders':      return fetchOrders(range, branchId)
    case 'avgOrder':    return fetchAvgOrder(range, branchId)
    case 'expenses':    return fetchExpenses(range, branchId)
    case 'khata':       return fetchKhata(range, branchId)
    default:            return null
  }
}

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHead = ({ children }) => (
  <h4 className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-3 mt-5 first:mt-0">{children}</h4>
)

// ─── Views ─────────────────────────────────────────────────────────────────────
function RevenueView({ data }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Revenue', val: fmtRs(data.totalRevenue), color: 'text-ember' },
          { label: 'Total Orders',  val: fmtNum(data.orderCount),  color: 'text-indigo-500' },
          { label: 'Peak Period',   val: data.peak?.label || '—',  color: 'text-emerald-600', sub: data.peak ? fmtRs(data.peak.revenue) : '' },
        ].map(c => (
          <div key={c.label} className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{c.label}</p>
            <p className={`text-xl font-black mt-1 ${c.color}`}>{c.val}</p>
            {c.sub && <p className="text-xs text-ink-400 font-semibold">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Chart */}
      <SectionHead>Revenue by {data.byHour ? 'Hour' : 'Day'}</SectionHead>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.byPeriod} margin={{top:5,right:5,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888" opacity={0.1} />
            <XAxis dataKey="label" tick={{fontSize:10,fill:'#888',fontWeight:'bold'}} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{fontSize:10,fill:'#888'}} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v=>[fmtRs(v),'Revenue']} />
            <Bar dataKey="revenue" fill="#E67E22" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Period Table */}
      <SectionHead>Detailed Breakdown</SectionHead>
      <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
        <table className="w-full text-xs">
          <thead><tr className="bg-ink-50 dark:bg-ink-900 text-ink-400 font-black uppercase tracking-widest">
            {['Period','Orders','Revenue','CASH','UPI','KHATA','ADVANCE'].map(h=><th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {data.byPeriod.map((p,i) => (
              <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-900/30">
                <td className="px-4 py-2.5 font-bold text-ink-700 dark:text-ink-300">{p.label}</td>
                <td className="px-4 py-2.5 text-ink-500">{p.orders}</td>
                <td className="px-4 py-2.5 font-bold text-ink-900 dark:text-white">{fmtRs(p.revenue)}</td>
                <td className="px-4 py-2.5 text-emerald-600">{fmtRs(p.CASH||0)}</td>
                <td className="px-4 py-2.5 text-indigo-500">{fmtRs(p.UPI||0)}</td>
                <td className="px-4 py-2.5 text-amber-600">{fmtRs(p.KHATA||0)}</td>
                <td className="px-4 py-2.5 text-blue-500">{fmtRs(p.ADVANCE||0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NetRevenueView({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {[
          {label:'Gross Revenue', val:fmtRs(data.totalGross), color:'text-ink-900 dark:text-white'},
          {label:'Total Discount',val:fmtRs(data.totalDiscount), color:'text-red-500'},
          {label:'Net Revenue',   val:fmtRs(data.netRevenue),   color:'text-emerald-600'},
          {label:'Avg Discount%', val:fmtPct(data.discountRate), color:'text-amber-600'},
        ].map(c=>(
          <div key={c.label} className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{c.label}</p>
            <p className={`text-xl font-black mt-1 ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>
      <SectionHead>Daily Discount Analysis</SectionHead>
      <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
        <table className="w-full text-xs">
          <thead><tr className="bg-ink-50 dark:bg-ink-900 text-ink-400 font-black uppercase tracking-widest">
            {['Date','Orders','Gross Revenue','Discount','Net Revenue','Disc%'].map(h=><th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {[...data.byDay].reverse().map((d,i)=>(
              <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-900/30">
                <td className="px-4 py-2.5 font-bold text-ink-500">{d.label}</td>
                <td className="px-4 py-2.5">{d.count}</td>
                <td className="px-4 py-2.5 font-bold text-ink-900 dark:text-white">{fmtRs(d.gross)}</td>
                <td className="px-4 py-2.5 text-red-500 font-bold">−{fmtRs(d.discount)}</td>
                <td className="px-4 py-2.5 text-emerald-600 font-bold">{fmtRs(d.net)}</td>
                <td className="px-4 py-2.5"><span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${d.discPct>10?'bg-red-100 text-red-600':'bg-ink-100 text-ink-600'}`}>{fmtPct(d.discPct)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.topDiscounted.length > 0 && (
        <>
          <SectionHead>Top Discounted Orders</SectionHead>
          <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
            <table className="w-full text-xs">
              <thead><tr className="bg-ink-50 dark:bg-ink-900 text-ink-400 font-black uppercase tracking-widest">
                {['Order','Customer','Gross','Discount','Net'].map(h=><th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {data.topDiscounted.map((o,i)=>(
                  <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-900/30">
                    <td className="px-4 py-2.5 font-mono text-ember font-bold">{o.num}</td>
                    <td className="px-4 py-2.5 font-semibold">{o.customer}</td>
                    <td className="px-4 py-2.5">{fmtRs(o.gross)}</td>
                    <td className="px-4 py-2.5 text-red-500 font-bold">−{fmtRs(o.discount)}</td>
                    <td className="px-4 py-2.5 text-emerald-600 font-bold">{fmtRs(o.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function GrossProfitView({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          {label:'Total SP (Sales)',     val:fmtRs(data.totalSP),    color:'text-ink-900 dark:text-white'},
          {label:'Total CP (Cost)',      val:fmtRs(data.totalCOGS),  color:'text-red-500'},
          {label:'Gross Profit',         val:fmtRs(data.grossProfit),color:data.grossProfit>=0?'text-emerald-600':'text-red-600'},
        ].map(c=>(
          <div key={c.label} className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{c.label}</p>
            <p className={`text-xl font-black mt-1 ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>
      {data.noCPCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">{data.noCPCount} item line(s) have no cost price set — profit may be understated. Set cost prices in Inventory.</p>
        </div>
      )}
      {data.lossItems.length > 0 && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-xl p-3">
          <TrendingDown size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{data.lossItems.length} item(s) are being sold below cost price — review pricing.</p>
        </div>
      )}
      <SectionHead>Item Profit Leaderboard</SectionHead>
      <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
        <table className="w-full text-xs">
          <thead><tr className="bg-ink-50 dark:bg-ink-900 text-ink-400 font-black uppercase tracking-widest">
            {['Item','Category','Qty','SP Total','CP Total','Profit','Margin'].map(h=><th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {data.byItem.map((item,i)=>(
              <tr key={i} className={`hover:bg-ink-50 dark:hover:bg-ink-900/30 ${item.profit<0?'bg-red-50/50 dark:bg-red-900/5':''}`}>
                <td className="px-4 py-2.5 font-bold text-ink-800 dark:text-ink-200">{item.name}{item.noCP&&<span className="ml-1 text-[8px] text-amber-500">⚠ no CP</span>}</td>
                <td className="px-4 py-2.5 text-ink-500">{item.category}</td>
                <td className="px-4 py-2.5">{item.qtySold}</td>
                <td className="px-4 py-2.5">{fmtRs(item.totalSP)}</td>
                <td className="px-4 py-2.5 text-red-500">{fmtRs(item.totalCP)}</td>
                <td className={`px-4 py-2.5 font-bold ${item.profit>=0?'text-emerald-600':'text-red-600'}`}>{fmtRs(item.profit)}</td>
                <td className="px-4 py-2.5"><span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${marginBadge(item.margin)}`}>{fmtPct(item.margin)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionHead>Category Roll-Up</SectionHead>
      <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
        <table className="w-full text-xs">
          <thead><tr className="bg-ink-50 dark:bg-ink-900 text-ink-400 font-black uppercase tracking-widest">
            {['Category','Revenue','COGS','Profit','Margin%'].map(h=><th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {data.byCategory.map((c,i)=>(
              <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-900/30">
                <td className="px-4 py-2.5 font-bold">{c.category}</td>
                <td className="px-4 py-2.5">{fmtRs(c.revenue)}</td>
                <td className="px-4 py-2.5 text-red-500">{fmtRs(c.cogs)}</td>
                <td className={`px-4 py-2.5 font-bold ${c.profit>=0?'text-emerald-600':'text-red-600'}`}>{fmtRs(c.profit)}</td>
                <td className="px-4 py-2.5"><span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${marginBadge(c.margin)}`}>{fmtPct(c.margin)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NetProfitView({ data }) {
  const PLRow = ({ label, value, indent=false, bold=false, color='', border=false }) => (
    <div className={`flex justify-between items-center py-2 ${border?'border-t border-ink-200 dark:border-ink-700 mt-1 pt-3':''}`}>
      <span className={`text-sm ${indent?'pl-4 text-ink-500':'font-black text-ink-700 dark:text-ink-300'} ${bold?'font-black':''}`}>{label}</span>
      <span className={`font-black text-sm ${color||'text-ink-900 dark:text-white'}`}>{fmtRs(value)}</span>
    </div>
  )
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* P&L Statement */}
        <div className="bg-ink-50 dark:bg-ink-800 rounded-2xl p-5 space-y-1">
          <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-3">P&L Statement</p>
          <PLRow label="Total Revenue" value={data.totalRevenue} />
          <PLRow label="Less: Discounts" value={-data.totalDiscount} indent color="text-red-500" />
          <PLRow label="Net Revenue" value={data.netRevenue} bold border />
          <PLRow label="Cost of Goods Sold (COGS)" value={data.totalCOGS} indent color="text-red-500" />
          <PLRow label={`Gross Profit (${fmtPct(data.grossMargin)})`} value={data.grossProfit} bold border color={data.grossProfit>=0?'text-emerald-600':'text-red-600'} />
          <PLRow label="Operating Expenses" value={data.totalExpenses} indent color="text-red-500" />
          <PLRow label="Salary Paid" value={data.salaryPaid} indent color="text-red-500" />
          <PLRow label={`NET PROFIT (${fmtPct(data.netMargin)})`} value={data.netProfit} bold border color={data.netProfit>=0?'text-emerald-600 dark:text-emerald-400':'text-red-600'} />
        </div>
        {/* Net Profit trend */}
        <div>
          <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-3">Daily Net Profit Trend</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDay} margin={{top:5,right:5,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888" opacity={0.1}/>
                <XAxis dataKey="label" tick={{fontSize:9,fill:'#888'}} axisLine={false} tickLine={false} dy={8}/>
                <YAxis tick={{fontSize:9,fill:'#888'}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v=>[fmtRs(v)]}/>
                <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3"/>
                <Bar dataKey="netDay" name="Net Profit" radius={[3,3,0,0]}
                  fill="#10b981"
                  // color bars individually based on value sign
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <SectionHead>Day-by-Day P&L with Running Total</SectionHead>
      <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
        <table className="w-full text-xs">
          <thead><tr className="bg-ink-50 dark:bg-ink-900 text-ink-400 font-black uppercase tracking-widest">
            {['Date','Revenue','COGS','Gross Profit','Expenses','Net Profit','Running Total'].map(h=><th key={h} className="px-3 py-2.5 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {[...data.byDay].reverse().map((d,i)=>(
              <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-900/30">
                <td className="px-3 py-2.5 font-bold text-ink-500">{d.label}</td>
                <td className="px-3 py-2.5">{fmtRs(d.revenue)}</td>
                <td className="px-3 py-2.5 text-red-500">{fmtRs(d.cogs)}</td>
                <td className={`px-3 py-2.5 font-bold ${d.grossProfit>=0?'text-emerald-600':'text-red-600'}`}>{fmtRs(d.grossProfit)}</td>
                <td className="px-3 py-2.5 text-red-500">{fmtRs(d.expenses)}</td>
                <td className={`px-3 py-2.5 font-bold ${d.netDay>=0?'text-emerald-600':'text-red-600'}`}>{fmtRs(d.netDay)}</td>
                <td className={`px-3 py-2.5 font-black ${d.running>=0?'text-emerald-600':'text-red-600'}`}>{fmtRs(d.running)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OrdersView({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {[
          {label:'Total Orders',     val:fmtNum(data.total),                      color:'text-ink-900 dark:text-white'},
          {label:'Completed',        val:fmtNum(data.completed),                  color:'text-emerald-600'},
          {label:'Cancelled',        val:fmtNum(data.cancelled),                  color:'text-red-500'},
          {label:'Cancel Rate',      val:fmtPct(data.cancelRate),                 color:data.cancelRate>10?'text-red-500':'text-amber-500'},
        ].map(c=>(
          <div key={c.label} className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{c.label}</p>
            <p className={`text-xl font-black mt-1 ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>
      {data.peakHour && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl p-3">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-xs font-black text-amber-800 dark:text-amber-300">Peak Hour: {data.peakHour.label}</p>
            <p className="text-[10px] text-amber-600">{data.peakHour.completed} orders · Avg items/order: {data.avgItems.toFixed(1)}</p>
          </div>
        </div>
      )}
      <SectionHead>Hourly Order Distribution</SectionHead>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.byHour} margin={{top:5,right:5,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888" opacity={0.1}/>
            <XAxis dataKey="label" tick={{fontSize:9,fill:'#888'}} axisLine={false} tickLine={false} dy={8} interval={2}/>
            <YAxis tick={{fontSize:9,fill:'#888'}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={TOOLTIP_STYLE}/>
            <Bar dataKey="completed" fill="#10b981" radius={[3,3,0,0]} name="Completed"/>
            <Bar dataKey="cancelled" fill="#ef4444" radius={[3,3,0,0]} name="Cancelled"/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SectionHead>Daily Order Summary</SectionHead>
      <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
        <table className="w-full text-xs">
          <thead><tr className="bg-ink-50 dark:bg-ink-900 text-ink-400 font-black uppercase tracking-widest">
            {['Date','Completed','Cancelled','Total','Revenue','Cancel%'].map(h=><th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {[...data.byDay].reverse().map((d,i)=>(
              <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-900/30">
                <td className="px-4 py-2.5 font-bold text-ink-500">{d.label}</td>
                <td className="px-4 py-2.5 text-emerald-600 font-bold">{d.completed}</td>
                <td className="px-4 py-2.5 text-red-500">{d.cancelled}</td>
                <td className="px-4 py-2.5 font-bold">{d.total}</td>
                <td className="px-4 py-2.5">{fmtRs(d.revenue)}</td>
                <td className="px-4 py-2.5"><span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${d.cancelRate>10?'bg-red-100 text-red-600':'bg-ink-100 text-ink-500'}`}>{fmtPct(d.cancelRate)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AvgOrderView({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {[
          {label:'Avg Order Value', val:fmtRs(data.aov),    color:'text-ember'},
          {label:'Min Order',       val:fmtRs(data.min),    color:'text-ink-500'},
          {label:'Max Order',       val:fmtRs(data.max),    color:'text-emerald-600'},
          {label:'Median Order',    val:fmtRs(data.median), color:'text-indigo-500'},
        ].map(c=>(
          <div key={c.label} className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{c.label}</p>
            <p className={`text-xl font-black mt-1 ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>
      <SectionHead>Order Value Distribution</SectionHead>
      {data.buckets.map((b,i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-xs font-bold text-ink-700 dark:text-ink-300">
            <span>{b.label}</span>
            <span>{b.count} orders <span className="text-ink-400 font-semibold">({fmtPct(b.pct)})</span></span>
          </div>
          <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
            <div className="h-full rounded-full bg-ember transition-all duration-700" style={{width:`${b.pct}%`}}/>
          </div>
        </div>
      ))}
      <SectionHead>AOV Trend</SectionHead>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.trend} margin={{top:5,right:5,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888" opacity={0.1}/>
            <XAxis dataKey="label" tick={{fontSize:9,fill:'#888'}} axisLine={false} tickLine={false} dy={8}/>
            <YAxis tick={{fontSize:9,fill:'#888'}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v=>[fmtRs(v),'AOV']}/>
            <Line type="monotone" dataKey="aov" stroke="#E67E22" strokeWidth={2.5} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SectionHead>Top 10 Highest Orders</SectionHead>
      <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
        <table className="w-full text-xs">
          <thead><tr className="bg-ink-50 dark:bg-ink-900 text-ink-400 font-black uppercase tracking-widest">
            {['Order #','Customer','Date','Total'].map(h=><th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {data.topOrders.map((o,i)=>(
              <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-900/30">
                <td className="px-4 py-2.5 font-mono text-ember font-bold">{o.num}</td>
                <td className="px-4 py-2.5 font-semibold">{o.customer}</td>
                <td className="px-4 py-2.5 text-ink-500">{o.date}</td>
                <td className="px-4 py-2.5 font-black text-ink-900 dark:text-white">{fmtRs(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExpensesView({ data }) {
  const [catFilter, setCatFilter] = useState(null)
  const filtered = catFilter ? data.list.filter(e=>e.category===catFilter) : data.list
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {[
          {label:'Total Expenses', val:fmtRs(data.total),        color:'text-red-600'},
          {label:'Expense Count',  val:fmtNum(data.count),        color:'text-ink-900 dark:text-white'},
          {label:'Avg Per Day',    val:fmtRs(data.avgPerDay),     color:'text-amber-600'},
          {label:'Largest Single', val:fmtRs(data.maxSingle),     color:'text-red-500'},
        ].map(c=>(
          <div key={c.label} className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{c.label}</p>
            <p className={`text-xl font-black mt-1 ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>
      <SectionHead>By Category (click to filter)</SectionHead>
      <div className="flex flex-wrap gap-2">
        <button onClick={()=>setCatFilter(null)} className={`px-3 py-1 text-xs font-black rounded-lg border transition-all ${!catFilter?'bg-ember text-white border-ember':'border-ink-200 dark:border-ink-700 text-ink-500'}`}>All</button>
        {data.byCategory.map(c=>(
          <button key={c.category} onClick={()=>setCatFilter(c.category===catFilter?null:c.category)}
            className={`px-3 py-1 text-xs font-black rounded-lg border transition-all ${catFilter===c.category?'bg-ember text-white border-ember':'border-ink-200 dark:border-ink-700 text-ink-500 hover:text-ink-900'}`}>
            {c.category} · {fmtRs(c.amount)}
          </button>
        ))}
      </div>
      <SectionHead>Expense Log {catFilter?`(${catFilter})`:'(All)'}</SectionHead>
      <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800 max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0"><tr className="bg-ink-50 dark:bg-ink-900 text-ink-400 font-black uppercase tracking-widest">
            {['Date','Category','Description','Mode','Amount','By'].map(h=><th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {filtered.map((e,i)=>(
              <tr key={i} className="hover:bg-ink-50 dark:hover:bg-ink-900/30">
                <td className="px-4 py-2.5 text-ink-500 font-bold">{e.date}</td>
                <td className="px-4 py-2.5"><span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400">{e.category}</span></td>
                <td className="px-4 py-2.5 text-ink-500 max-w-[180px] truncate">{e.description}</td>
                <td className="px-4 py-2.5 text-ink-500">{e.mode}</td>
                <td className="px-4 py-2.5 text-red-600 font-bold">{fmtRs(e.amount)}</td>
                <td className="px-4 py-2.5 text-ink-400">{e.by}</td>
              </tr>
            ))}
            {filtered.length===0&&<tr><td colSpan={6} className="px-4 py-8 text-center text-ink-400">No expenses</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KhataView({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          {label:'Total Outstanding',  val:fmtRs(data.totalOutstanding), color:'text-red-600'},
          {label:'Customers with Debt', val:fmtNum(data.debtors),        color:'text-amber-600'},
          {label:'Total Customers',    val:fmtNum(data.total),           color:'text-ink-900 dark:text-white'},
        ].map(c=>(
          <div key={c.label} className="bg-ink-50 dark:bg-ink-800 rounded-xl p-4">
            <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{c.label}</p>
            <p className={`text-xl font-black mt-1 ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl p-3">
        <Info size={13} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Outstanding balances are all-time cumulative. "New Credit (Period)" reflects credits given in the selected period only.</p>
      </div>
      <SectionHead>Customer Khata Balances (All-Time)</SectionHead>
      <div className="overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800 max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0"><tr className="bg-ink-50 dark:bg-ink-900 text-ink-400 font-black uppercase tracking-widest">
            {['Customer','Mobile','Credit Given','Recovered','Outstanding','New Credit (Period)'].map(h=><th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {data.byCustomer.map((c,i)=>(
              <tr key={i} className={`hover:bg-ink-50 dark:hover:bg-ink-900/30 ${c.outstanding>0?'':'opacity-60'}`}>
                <td className="px-4 py-2.5 font-bold text-ink-800 dark:text-ink-200">{c.name}</td>
                <td className="px-4 py-2.5 font-mono text-ink-500 text-[10px]">{c.mobile||'—'}</td>
                <td className="px-4 py-2.5 text-amber-600 font-bold">{fmtRs(c.credited)}</td>
                <td className="px-4 py-2.5 text-emerald-600">{fmtRs(c.recovered)}</td>
                <td className={`px-4 py-2.5 font-black ${c.outstanding>0?'text-red-600':'text-emerald-600'}`}>{fmtRs(c.outstanding)}</td>
                <td className="px-4 py-2.5 text-amber-500">{c.newCredit>0?fmtRs(c.newCredit):'—'}</td>
              </tr>
            ))}
            {data.byCustomer.length===0&&<tr><td colSpan={6} className="px-4 py-8 text-center text-ink-400">No khata records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function renderView(type, data) {
  if (!data) return null
  switch(type) {
    case 'revenue':     return <RevenueView data={data} />
    case 'netRevenue':  return <NetRevenueView data={data} />
    case 'grossProfit': return <GrossProfitView data={data} />
    case 'netProfit':   return <NetProfitView data={data} />
    case 'orders':      return <OrdersView data={data} />
    case 'avgOrder':    return <AvgOrderView data={data} />
    case 'expenses':    return <ExpensesView data={data} />
    case 'khata':       return <KhataView data={data} />
    default:            return null
  }
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function KPIDetailModal({ type, label, dateRange: inheritedRange, branchId, onClose }) {
  const [period, setPeriod] = useState('inherited')
  const [data,   setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  const range = useMemo(() => computeRange(period, inheritedRange), [period, inheritedRange])

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetchModalData(type, range, branchId).then(d => { setData(d); setLoading(false) })
  }, [type, period, branchId])  // eslint-disable-line

  const rangeLabel = range.start
    ? `${range.start.toLocaleDateString('en-IN', {day:'numeric',month:'short'})} → ${range.end.toLocaleDateString('en-IN', {day:'numeric',month:'short'})}`
    : 'All Time'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="bg-white dark:bg-ink-900 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-slide-up overflow-hidden">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50 gap-3 flex-shrink-0">
          <div>
            <h2 className="font-black text-ink-900 dark:text-white text-base">{label} — Drill Down</h2>
            <p className="text-[10px] text-ink-400 font-semibold mt-0.5">{rangeLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-ink-100 dark:bg-ink-800 rounded-xl p-1 gap-0.5">
              {PERIODS.map(p => (
                <button key={p.key} onClick={()=>setPeriod(p.key)}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-wide ${period===p.key?'bg-white dark:bg-ink-900 text-ember shadow-sm':'text-ink-500 hover:text-ink-800 dark:hover:text-white'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {data && (
              <button onClick={()=>exportCSV(type, data)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 text-xs font-black hover:bg-ink-200 dark:hover:bg-ink-700 transition-all">
                <Download size={12} /> CSV
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors text-ink-500">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="h-60 flex items-center justify-center text-ink-400 font-black animate-pulse uppercase tracking-widest text-sm">
              Computing...
            </div>
          ) : renderView(type, data)}
        </div>
      </div>
    </div>
  )
}
