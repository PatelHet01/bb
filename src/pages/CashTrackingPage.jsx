import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { Banknote, Plus, Minus, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const NOTES = [2000, 500, 200, 100, 50, 20, 10]
const COINS = [20, 10, 5, 2, 1]
const ALL_DENOMS = [...NOTES, ...COINS]

function normalizeDenoms(denoms) {
  if (!denoms) return {}
  const res = {}
  Object.keys(denoms).forEach(k => {
    if (k.startsWith('note_') || k.startsWith('coin_')) {
      res[k] = parseInt(denoms[k]) || 0
    } else {
      const val = parseInt(k)
      if (!isNaN(val)) {
        if (val >= 50) {
          res[`note_${val}`] = parseInt(denoms[k]) || 0
        } else if (val <= 5) {
          res[`coin_${val}`] = parseInt(denoms[k]) || 0
        } else {
          res[`note_${val}`] = parseInt(denoms[k]) || 0
        }
      }
    }
  })
  return res
}

export default function CashTrackingPage() {
  const { user, branchId } = useAuthStore()
  const { currentSession } = useSessionStore()

  const [activeTab, setActiveTab] = useState('addition') // 'addition' | 'withdrawal' | 'closing'
  const [denominations, setDenominations] = useState(() => {
    const res = {}
    NOTES.forEach(d => { res[`note_${d}`] = 0 })
    COINS.forEach(d => { res[`coin_${d}`] = 0 })
    return res
  })
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState('General')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [yesterdayClosing, setYesterdayClosing] = useState(null)

  const calculatedTotal = NOTES.reduce((s, d) => s + d * (parseInt(denominations[`note_${d}`] || 0)), 0) +
                          COINS.reduce((s, d) => s + d * (parseInt(denominations[`coin_${d}`] || 0)), 0)

  useEffect(() => {
    fetchHistory()
    fetchYesterdayClosing()
  }, [branchId])

  async function fetchYesterdayClosing() {
    const branch = branchId || 'gurukul'
    const { data } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('branch_id', branch)
      .eq('type', 'CLOSING')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setYesterdayClosing(data)
    }
  }

  async function fetchHistory() {
    setHistoryLoading(true)
    const branch = branchId || 'gurukul'
    const todayStart = new Date()
    todayStart.setHours(0,0,0,0)

    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*, users!recorded_by(username)')
      .eq('branch_id', branch)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })

    if (!error) {
      setHistory(data || [])
    }
    setHistoryLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const branch = branchId || 'gurukul'

    const finalAmount = activeTab === 'closing' ? calculatedTotal : parseFloat(amount)
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error('Please enter a valid amount')
      setLoading(false)
      return
    }

    try {
      const typeLabel = activeTab.toUpperCase()
      const { data, error } = await supabase.from('cash_sessions').insert({
        business_session_id: currentSession?.id || null,
        branch_id: branch,
        type: typeLabel,
        denominations: denominations,
        total_amount: finalAmount,
        reason: reason,
        category: activeTab === 'withdrawal' ? category : null,
        recorded_by: user?.id && !String(user.id).startsWith('hardcoded') ? user.id : null
      }).select().single()

      if (error) throw error

      // If withdrawal, also log in expenses table
      if (activeTab === 'withdrawal') {
        const { error: expErr } = await supabase.from('expenses').insert({
          branch_id: branch,
          amount: finalAmount,
          category: category,
          description: reason || 'Cash Withdrawal',
          payment_mode: 'CASH',
          created_by: user?.id && !String(user.id).startsWith('hardcoded') ? user.id : null,
          session_id: currentSession?.id || null,
        })
        if (expErr) console.error('Failed to log expense:', expErr)
      }

      toast.success(`${activeTab === 'addition' ? 'Cash added' : activeTab === 'withdrawal' ? 'Cash withdrawn' : 'Closing count recorded'} successfully!`)
      
      // Reset form
      setAmount('')
      setReason('')
      setDenominations(() => {
        const res = {}
        NOTES.forEach(d => { res[`note_${d}`] = 0 })
        COINS.forEach(d => { res[`coin_${d}`] = 0 })
        return res
      })
      
      fetchHistory()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleDenomChange(denom, val) {
    const intVal = parseInt(val) || 0
    const newDenoms = { ...denominations, [denom]: intVal }
    setDenominations(newDenoms)
    if (activeTab !== 'closing') {
      const total = NOTES.reduce((s, d) => s + d * (parseInt(newDenoms[`note_${d}`] || 0)), 0) +
                    COINS.reduce((s, d) => s + d * (parseInt(newDenoms[`coin_${d}`] || 0)), 0)
      setAmount(total.toString())
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight flex items-center gap-2">
          <Banknote className="text-ember" /> Cash Tracking
        </h1>
        <p className="text-sm font-semibold text-ink-500 mt-1 uppercase tracking-widest">In-Store Drawer Cash Movements</p>
      </div>

      {yesterdayClosing && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex justify-between items-center text-sm font-bold text-emerald-800 dark:text-emerald-300">
          <span>📊 Yesterday's closing carry-forward: ₹{Number(yesterdayClosing.total_amount).toLocaleString('en-IN')}</span>
          <button 
            onClick={() => {
              setDenominations(normalizeDenoms(yesterdayClosing.denominations))
              setAmount(yesterdayClosing.total_amount.toString())
              toast.success('Carry-forward cash pre-filled!')
            }}
            className="px-3 py-1 bg-white dark:bg-ink-800 border border-emerald-200 dark:border-emerald-700 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
          >
            Use Opening Count
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Input Form Column */}
        <div className="md:col-span-2 bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 space-y-6 shadow-sm">
          <div className="flex bg-ink-50 dark:bg-ink-950 p-1 rounded-xl">
            {[
              { id: 'addition', label: 'Addition', icon: Plus },
              { id: 'withdrawal', label: 'Withdrawal', icon: Minus },
              { id: 'closing', label: 'Closing Count', icon: Banknote }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setDenominations(() => {
                    const res = {}
                    NOTES.forEach(d => { res[`note_${d}`] = 0 })
                    COINS.forEach(d => { res[`coin_${d}`] = 0 })
                    return res
                  })
                  setAmount('')
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-ink-800 shadow text-ink-900 dark:text-white'
                    : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab !== 'closing' && (
              <div>
                <label className="label">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="input w-full font-black text-lg"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}

            {activeTab === 'withdrawal' && (
              <div>
                <label className="label">Expense Category</label>
                <select
                  className="select w-full"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="Salary">Salary / Advance</option>
                  <option value="Vendor">Vendor Payment</option>
                  <option value="Stationery">Stationery & Cleaning</option>
                  <option value="Kitchen Supplies">Kitchen / Fresh Supplies</option>
                  <option value="Refund">Customer Refund</option>
                  <option value="General">Other General Expense</option>
                </select>
              </div>
            )}

            <div>
              <label className="label">Reason / Notes</label>
              <input
                type="text"
                className="input w-full"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason for cash movement..."
              />
            </div>

            {/* Denominations collapse/expand or count area */}
            <div className="border-t border-ink-100 dark:border-ink-800 pt-4">
              <h3 className="text-xs font-black text-ink-400 uppercase tracking-widest mb-3">Denomination Breakdown (Optional for addition/withdrawal)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-ink-400 uppercase">Notes</p>
                  {NOTES.map(d => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="w-12 text-xs font-bold text-ink-500 text-right">₹{d}</span>
                      <input
                        type="number"
                        min="0"
                        className="input py-1 text-center font-bold text-xs w-16"
                        value={denominations[`note_${d}`] || ''}
                        onChange={e => handleDenomChange(`note_${d}`, e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-ink-400 uppercase">Coins</p>
                  {COINS.map(d => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="w-12 text-xs font-bold text-ink-500 text-right">₹{d}</span>
                      <input
                        type="number"
                        min="0"
                        className="input py-1 text-center font-bold text-xs w-16"
                        value={denominations[`coin_${d}`] || ''}
                        onChange={e => handleDenomChange(`coin_${d}`, e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
              {activeTab === 'closing' && (
                <div className="flex justify-between items-center border-t border-ink-200 dark:border-ink-800 mt-4 pt-3">
                  <span className="font-black text-sm text-ink-500 uppercase tracking-widest">Total Counted</span>
                  <span className="font-black text-2xl text-emerald-600 dark:text-emerald-400">₹{calculatedTotal.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-4 flex items-center justify-center gap-2"
            >
              {loading ? 'Processing...' : activeTab === 'addition' ? 'Add Cash to Drawer' : activeTab === 'withdrawal' ? 'Withdraw Cash' : 'Record Closing Balance'}
            </button>
          </form>
        </div>

        {/* Info Column */}
        <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs mb-3">Today's Quick Summary</h3>
            <div className="space-y-3">
              {[
                { label: 'Additions', val: history.filter(h => h.type === 'ADDITION').reduce((s, h) => s + Number(h.total_amount), 0), color: 'text-emerald-600', icon: ArrowUpRight },
                { label: 'Withdrawals', val: history.filter(h => h.type === 'WITHDRAWAL').reduce((s, h) => s + Number(h.total_amount), 0), color: 'text-red-600', icon: ArrowDownRight },
                { label: 'Closing Counts Recorded', val: history.filter(h => h.type === 'CLOSING').length, color: 'text-ink-900 dark:text-white', icon: Banknote },
              ].map(summary => (
                <div key={summary.label} className="bg-ink-50 dark:bg-ink-950 p-3 rounded-xl border border-ink-100 dark:border-ink-800 flex items-center gap-3">
                  <summary.icon className={summary.color} size={20} />
                  <div>
                    <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest leading-none">{summary.label}</p>
                    <p className={`font-black text-lg mt-1 ${summary.color}`}>
                      {typeof summary.val === 'number' && summary.label !== 'Closing Counts Recorded' ? `₹${summary.val.toLocaleString('en-IN')}` : summary.val}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-ink-400 leading-relaxed bg-ink-50 dark:bg-ink-950 p-3 rounded-xl border border-ink-100 dark:border-ink-800 mt-4">
            ⚠️ <strong>Financial Policy:</strong> All drawer cash transactions must be entered immediately. Do not defer additions or withdrawals.
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50 flex justify-between items-center">
          <h2 className="font-black text-ink-900 dark:text-white flex items-center gap-2">
            Today's Cash Ledger
          </h2>
          <button onClick={fetchHistory} className="text-ink-500 hover:text-ink-700 p-1.5 hover:bg-ink-100 dark:hover:bg-ink-800 rounded-lg">
            <RefreshCw size={14} />
          </button>
        </div>
        {historyLoading ? (
          <div className="py-16 text-center text-ink-400 animate-pulse font-bold">Loading Ledger...</div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center text-ink-400 font-bold">No cash transactions logged today yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-ink-50 dark:bg-ink-950 text-ink-500 text-[10px] font-black uppercase tracking-widest border-b border-ink-100 dark:border-ink-800">
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Reason / Details</th>
                  <th className="px-6 py-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {history.map(h => (
                  <tr key={h.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-950/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-ink-500 font-bold">
                      {new Date(h.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        h.type === 'ADDITION' || h.type === 'OPENING'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : h.type === 'WITHDRAWAL'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                      }`}>
                        {h.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-black text-ink-900 dark:text-white">
                      ₹{Number(h.total_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-ink-700 dark:text-ink-300">
                      {h.reason || (h.category ? `Category: ${h.category}` : 'No notes')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-ink-500">
                      {h.users?.username || 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
