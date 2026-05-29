import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { Clock, Play, Square, ChevronDown, CheckCircle2, AlertTriangle, TrendingUp, ShoppingBag, Banknote, CreditCard, Smartphone, BookOpen, ReceiptText } from 'lucide-react'
import toast from 'react-hot-toast'

const NOTES = [2000, 500, 200, 100, 50, 20, 10]
const COINS = [20, 10, 5, 2, 1]
const ALL_DENOMS = [...NOTES, ...COINS]

function DenomForm({ value, onChange }) {
  const totalNotes = NOTES.reduce((s, d) => s + d * (parseInt(value[`note_${d}`] || 0)), 0)
  const totalCoins = COINS.reduce((s, d) => s + d * (parseInt(value[`coin_${d}`] || 0)), 0)
  const total = totalNotes + totalCoins

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-2">Notes</p>
          {NOTES.map(d => (
            <div key={d} className="flex items-center gap-2 mb-1.5">
              <span className="w-16 text-sm font-bold text-ink-700 dark:text-ink-300 text-right">₹{d}</span>
              <span className="text-ink-400">×</span>
              <input
                type="number" min="0"
                className="input w-20 text-center font-bold py-1.5"
                value={value[`note_${d}`] || ''}
                onChange={e => onChange({ ...value, [`note_${d}`]: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <span className="text-xs text-ink-500 w-16 text-right">
                = ₹{(d * (parseInt(value[`note_${d}`] || 0))).toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mb-2">Coins</p>
          {COINS.map(d => (
            <div key={d} className="flex items-center gap-2 mb-1.5">
              <span className="w-10 text-sm font-bold text-ink-700 dark:text-ink-300 text-right">₹{d}</span>
              <span className="text-ink-400">×</span>
              <input
                type="number" min="0"
                className="input w-20 text-center font-bold py-1.5"
                value={value[`coin_${d}`] || ''}
                onChange={e => onChange({ ...value, [`coin_${d}`]: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <span className="text-xs text-ink-500 w-16 text-right">
                = ₹{(d * (parseInt(value[`coin_${d}`] || 0))).toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center border-t border-ink-200 dark:border-ink-800 pt-3">
        <span className="font-black text-sm text-ink-500 uppercase tracking-widest">Grand Total</span>
        <span className="font-black text-2xl text-ink-900 dark:text-white">₹{total.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}

export default function SessionPage() {
  const { user, branchId, role } = useAuthStore()
  const { currentSession, setSession, clearSession } = useSessionStore()

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)

  // Open session form state
  const [openingBalance, setOpeningBalance] = useState('')
  const [openingNotes, setOpeningNotes] = useState('')
  const [lastClosingInfo, setLastClosingInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Close session state
  const [closingBalance, setClosingBalance] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [sessionSummary, setSessionSummary] = useState(null)

  // Denominations cash counting state
  const [openingDenoms, setOpeningDenoms] = useState({})
  const [closingDenoms, setClosingDenoms] = useState({})

  const openingTotal = Number(openingBalance) || 0
  const closingTotal = Number(closingBalance) || 0

  // Sync denomination totals to numeric inputs
  useEffect(() => {
    const totalNotes = NOTES.reduce((s, d) => s + d * (parseInt(openingDenoms[`note_${d}`] || 0)), 0)
    const totalCoins = COINS.reduce((s, d) => s + d * (parseInt(openingDenoms[`coin_${d}`] || 0)), 0)
    const total = totalNotes + totalCoins
    if (total > 0) setOpeningBalance(String(total))
  }, [openingDenoms])

  useEffect(() => {
    const totalNotes = NOTES.reduce((s, d) => s + d * (parseInt(closingDenoms[`note_${d}`] || 0)), 0)
    const totalCoins = COINS.reduce((s, d) => s + d * (parseInt(closingDenoms[`coin_${d}`] || 0)), 0)
    const total = totalNotes + totalCoins
    if (total > 0) setClosingBalance(String(total))
  }, [closingDenoms])

  useEffect(() => { fetchSessions() }, [branchId])

  async function fetchSessions() {
    setLoading(true)
    const branch = branchId || 'gurukul'
    const { data } = await supabase
      .from('business_sessions')
      .select('*')
      .eq('branch_id', branch)
      .order('start_time', { ascending: false })
      .limit(30)
    setSessions(data || [])

    // Sync session store with actual DB state
    const open = (data || []).find(s => s.status === 'open')
    if (open) setSession(open)
    else clearSession()

    setLoading(false)
  }

  async function prepareOpenModal() {
    // Fetch last closing cash_session for this branch
    const branch = branchId || 'gurukul'
    const { data: lastClose } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('branch_id', branch)
      .eq('type', 'CLOSING')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastClose) {
      setOpeningBalance(String(lastClose.total_amount || 0))
      setLastClosingInfo({ amount: lastClose.total_amount, date: lastClose.created_at })
    } else {
      setOpeningBalance('')
      setLastClosingInfo(null)
    }
    setOpeningNotes('')
    setOpenModal(true)
  }

  async function handleOpenSession() {
    if (!openingBalance) return toast.error('Opening balance is required')
    setSubmitting(true)
    const branch = branchId || 'gurukul'
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: newSession, error: sErr } = await supabase
        .from('business_sessions')
        .insert({
          branch_id: branch,
          opened_by: user?.id && !String(user.id).startsWith('hardcoded') ? user.id : null,
          session_date: today,
          opening_balance: openingTotal,
          opening_cash_breakdown: openingDenoms,
          notes: openingNotes,
          status: 'open'
        })
        .select()
        .single()
      if (sErr) throw sErr

      const { error: cErr } = await supabase.from('cash_sessions').insert({
        business_session_id: newSession.id,
        branch_id: branch,
        type: 'OPENING',
        denominations: openingDenoms,
        total_amount: openingTotal,
        reason: 'Session opened',
        recorded_by: user?.id && !String(user.id).startsWith('hardcoded') ? user.id : null
      })
      if (cErr) throw cErr

      setSession(newSession)
      toast.success('Session opened! Shop is live.')
      setOpenModal(false)
      fetchSessions()
    } catch (e) {
      toast.error('Failed: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function prepareCloseModal() {
    // Load session summary
    const { data: orders } = await supabase
      .from('orders')
      .select('total, order_payments(mode, amount)')
      .eq('session_id', currentSession.id)
      .neq('status', 'cancelled')
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, payment_mode')
      .eq('session_id', currentSession.id)

    const revenue = (orders || []).reduce((s, o) => s + Number(o.total), 0)
    const byMode = {}
    ;(orders || []).forEach(o =>
      (o.order_payments || []).forEach(p => {
        byMode[p.mode] = (byMode[p.mode] || 0) + Number(p.amount)
      })
    )
    const totalExp = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
    const cashExpenses = (expenses || []).filter(e => e.payment_mode !== 'ONLINE').reduce((s, e) => s + Number(e.amount), 0)

    setSessionSummary({ revenue, orders: orders?.length || 0, byMode, expenses: totalExp, cashExpenses })
    setClosingBalance('')
    setClosingNotes('')
    setCloseModal(true)
  }

  async function handleCloseSession() {
    if (!closingBalance) return toast.error('Closing balance is required')
    setSubmitting(true)
    const branch = branchId || 'gurukul'
    try {
      const { error: sErr } = await supabase
        .from('business_sessions')
        .update({
          status: 'closed',
          closing_balance: closingTotal,
          closing_cash_breakdown: closingDenoms,
          closed_by: user?.id && !String(user.id).startsWith('hardcoded') ? user.id : null,
          end_time: new Date().toISOString(),
          notes: closingNotes,
          total_revenue: sessionSummary?.revenue || 0,
          total_orders: sessionSummary?.orders || 0,
          total_cash: sessionSummary?.byMode?.CASH || 0,
          total_upi: sessionSummary?.byMode?.UPI || 0,
          total_card: (sessionSummary?.byMode?.CREDIT_CARD || 0) + (sessionSummary?.byMode?.DEBIT_CARD || 0),
          total_khata: sessionSummary?.byMode?.KHATA || 0,
          total_advance: sessionSummary?.byMode?.ADVANCE || 0,
          total_expenses: sessionSummary?.expenses || 0,
          total_cash_expenses: sessionSummary?.cashExpenses || 0,
        })
        .eq('id', currentSession.id)
      if (sErr) throw sErr

      await supabase.from('cash_sessions').insert({
        business_session_id: currentSession.id,
        branch_id: branch,
        type: 'CLOSING',
        denominations: closingDenoms,
        total_amount: closingTotal,
        reason: closingNotes || 'End of day count',
        recorded_by: user?.id && !String(user.id).startsWith('hardcoded') ? user.id : null
      })

      clearSession()
      toast.success('Session closed. Good night! 🌙')
      setCloseModal(false)
      fetchSessions()
    } catch (e) {
      toast.error('Failed: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  function formatDuration(start, end) {
    const ms = new Date(end || Date.now()) - new Date(start)
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight flex items-center gap-2">
            <Clock className="text-ember" /> Sessions
          </h1>
          <p className="text-sm font-semibold text-ink-500 mt-1 uppercase tracking-widest">Business Day Management</p>
        </div>
        {currentSession ? (
          <button
            onClick={prepareCloseModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl shadow-lg shadow-red-500/20 transition-all"
          >
            <Square size={16} /> Close Shop
          </button>
        ) : (
          <button
            onClick={prepareOpenModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Play size={16} /> Open Shop
          </button>
        )}
      </div>

      {/* Active session banner */}
      {currentSession && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <p className="font-black text-emerald-800 dark:text-emerald-300">Session Active</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Opened {formatTime(currentSession.start_time)} · Running {formatDuration(currentSession.start_time, null)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">Opening Balance</p>
            <p className="font-black text-xl text-emerald-800 dark:text-emerald-300">₹{Number(currentSession.opening_balance).toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      {/* Sessions list */}
      <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50">
          <h2 className="font-black text-ink-900 dark:text-white">Session History</h2>
        </div>
        {loading ? (
          <div className="py-16 text-center text-ink-400 animate-pulse font-bold">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center text-ink-400">
            <Clock size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">No sessions yet. Open shop to start.</p>
          </div>
        ) : (
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {sessions.map(s => (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${s.status === 'open' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'}`}>
                      {s.status === 'open' ? '● Live' : 'Closed'}
                    </span>
                    <span className="font-bold text-sm text-ink-900 dark:text-white">
                      {new Date(s.session_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500">
                    {formatTime(s.start_time)}
                    {s.end_time && ` → ${formatTime(s.end_time)} · ${formatDuration(s.start_time, s.end_time)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-lg text-ink-900 dark:text-white">₹{Number(s.total_revenue || 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-ink-400">{s.total_orders || 0} orders</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open Session Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-ink-900 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-950 flex justify-between items-center">
              <h2 className="font-black text-lg flex items-center gap-2"><Play size={18} className="text-emerald-500" /> Open Shop</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {lastClosingInfo && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300 font-bold">
                  📊 Yesterday's closing: ₹{Number(lastClosingInfo.amount).toLocaleString('en-IN')} — pre-filled below
                </div>
              )}
              <div>
                <p className="font-black text-sm text-ink-900 dark:text-white mb-3">Count Opening Cash</p>
                <DenomForm value={openingDenoms} onChange={setOpeningDenoms} />
              </div>
              <div>
                <label className="label text-sm">Notes (optional)</label>
                <input className="input w-full" value={openingNotes} onChange={e => setOpeningNotes(e.target.value)} placeholder="Any opening notes..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-ink-200 dark:border-ink-800 flex gap-3">
              <button onClick={() => setOpenModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleOpenSession} disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'Opening...' : `Open with ₹${openingTotal.toLocaleString('en-IN')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Session Modal */}
      {closeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-ink-900 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-950 flex justify-between items-center">
              <h2 className="font-black text-lg flex items-center gap-2"><Square size={18} className="text-red-500" /> Close Shop</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Session summary */}
              {sessionSummary && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Revenue', value: `₹${sessionSummary.revenue.toLocaleString('en-IN')}`, color: 'text-emerald-600' },
                    { label: 'Orders', value: sessionSummary.orders, color: 'text-blue-600' },
                    { label: 'Cash', value: `₹${(sessionSummary.byMode?.CASH || 0).toLocaleString('en-IN')}`, color: 'text-ink-900 dark:text-white' },
                    { label: 'UPI', value: `₹${(sessionSummary.byMode?.UPI || 0).toLocaleString('en-IN')}`, color: 'text-ink-900 dark:text-white' },
                    { label: 'Khata', value: `₹${(sessionSummary.byMode?.KHATA || 0).toLocaleString('en-IN')}`, color: 'text-orange-600' },
                    { label: 'Expenses', value: `₹${sessionSummary.expenses.toLocaleString('en-IN')}`, color: 'text-red-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-ink-50 dark:bg-ink-950 rounded-xl p-3 border border-ink-100 dark:border-ink-800">
                      <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">{label}</p>
                      <p className={`font-black text-xl ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <p className="font-black text-sm text-ink-900 dark:text-white mb-3">Count Closing Cash</p>
                <DenomForm value={closingDenoms} onChange={setClosingDenoms} />
              </div>
              {sessionSummary && (
                <div className="p-3 bg-ink-50 dark:bg-ink-900/50 rounded-xl border border-ink-200 dark:border-ink-800 text-sm">
                  <div className="flex justify-between font-bold">
                    <span className="text-ink-500">Expected cash (opening + cash sales - cash expenses):</span>
                    <span className="text-ink-900 dark:text-white">₹{(Number(currentSession.opening_balance) + (sessionSummary.byMode?.CASH || 0) - sessionSummary.cashExpenses).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-bold mt-1">
                    <span className="text-ink-500">Actual count:</span>
                    <span className={closingTotal > 0 ? 'text-emerald-600' : 'text-ink-500'}>₹{closingTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
              <div>
                <label className="label text-sm">Closing Notes (optional)</label>
                <input className="input w-full" value={closingNotes} onChange={e => setClosingNotes(e.target.value)} placeholder="Any notes for the day..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-ink-200 dark:border-ink-800 flex gap-3">
              <button onClick={() => setCloseModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCloseSession} disabled={submitting} className="bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-xl flex-1 transition-all">
                {submitting ? 'Closing...' : 'Close Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
