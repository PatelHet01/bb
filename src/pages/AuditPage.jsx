import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { ShieldCheck, Download, RefreshCw, Filter } from 'lucide-react'

const ENTITY_COLORS = {
  order:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  expense:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  inventory: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  salary:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  session:   'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  ledger:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cash:      'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300',
}

const ACTION_ICONS = {
  ORDER_CREATED:          '🧾',
  ORDER_CANCELLED:        '❌',
  ORDER_DISCOUNT_APPLIED: '🏷️',
  EXPENSE_ADDED:          '💸',
  EXPENSE_DELETED:        '🗑️',
  ITEM_ADDED:             '📦',
  ITEM_EDITED:            '✏️',
  ITEM_DELETED:           '🗑️',
  SALARY_MARKED_PAID:     '💰',
  SESSION_OPENED:         '🟢',
  SESSION_CLOSED:         '🔴',
  LEDGER_TRANSACTION:     '↔️',
  CASH_COUNT_RECORDED:    '🏦',
}

const ACTION_COLORS = {
  ORDER_CREATED:          'text-emerald-600 dark:text-emerald-400',
  ORDER_CANCELLED:        'text-red-500',
  ORDER_DISCOUNT_APPLIED: 'text-amber-600',
  EXPENSE_ADDED:          'text-orange-600',
  EXPENSE_DELETED:        'text-red-500',
  ITEM_ADDED:             'text-purple-600',
  ITEM_EDITED:            'text-indigo-500',
  ITEM_DELETED:           'text-red-500',
  SALARY_MARKED_PAID:     'text-blue-600',
  SESSION_OPENED:         'text-teal-600',
  SESSION_CLOSED:         'text-rose-600',
  LEDGER_TRANSACTION:     'text-amber-600',
  CASH_COUNT_RECORDED:    'text-emerald-700',
}

const ROLE_BADGE = {
  super_admin: 'bg-red-100 text-red-700 dark:bg-red-900/30',
  admin:       'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
  manager:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  staff:       'bg-ink-100 text-ink-600 dark:bg-ink-800',
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

const ENTITY_TYPES = ['order','expense','inventory','salary','session','ledger','cash']
const ACTIONS_LIST = [
  'ORDER_CREATED','ORDER_CANCELLED','ORDER_DISCOUNT_APPLIED',
  'EXPENSE_ADDED','EXPENSE_DELETED',
  'ITEM_ADDED','ITEM_EDITED','ITEM_DELETED',
  'SALARY_MARKED_PAID','SESSION_OPENED','SESSION_CLOSED',
  'LEDGER_TRANSACTION','CASH_COUNT_RECORDED',
]

export default function AuditPage() {
  const { role, branchId } = useAuthStore()

  const [logs,       setLogs]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [branches,   setBranches]   = useState([])

  // Filters
  const [fBranch,    setFBranch]    = useState('all')
  const [fEntity,    setFEntity]    = useState('all')
  const [fAction,    setFAction]    = useState('all')
  const [fActor,     setFActor]     = useState('')
  const [fDateFrom,  setFDateFrom]  = useState('')
  const [fDateTo,    setFDateTo]    = useState('')

  useEffect(() => {
    supabase.from('branches').select('id, name').then(({ data }) => setBranches(data || []))
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    // Branch filter: non-super_admin sees only their branch
    if (role !== 'super_admin') {
      q = q.eq('branch_id', branchId || 'gurukul')
    } else if (fBranch !== 'all') {
      q = q.eq('branch_id', fBranch)
    }

    if (fEntity !== 'all') q = q.eq('entity_type', fEntity)
    if (fAction !== 'all') q = q.eq('action', fAction)
    if (fActor)            q = q.ilike('actor_name', `%${fActor}%`)
    if (fDateFrom)         q = q.gte('created_at', new Date(fDateFrom).toISOString())
    if (fDateTo) {
      const end = new Date(fDateTo); end.setHours(23,59,59,999)
      q = q.lte('created_at', end.toISOString())
    }

    const { data } = await q
    setLogs(data || [])
    setLoading(false)
  }, [role, branchId, fBranch, fEntity, fAction, fActor, fDateFrom, fDateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function exportCSV() {
    const headers = ['Time','Branch','Actor','Role','Action','Entity','Label']
    const rows = logs.map(l => [
      `"${fmtTime(l.created_at)}"`,
      `"${l.branch_id||''}"`,
      `"${l.actor_name||''}"`,
      `"${l.actor_role||''}"`,
      `"${l.action||''}"`,
      `"${l.entity_type||''}"`,
      `"${l.entity_label||''}"`,
    ].join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `BB_Audit_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-ember" size={24} /> Audit Trail
          </h1>
          <p className="text-sm font-semibold text-ink-500 mt-1 uppercase tracking-widest">
            System-wide activity log · Admin only
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchLogs} className="p-2 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs font-bold">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className="text-ink-400" />
          <span className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {role === 'super_admin' && (
            <select className="select text-xs py-1.5 px-2" value={fBranch} onChange={e => setFBranch(e.target.value)}>
              <option value="all">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select className="select text-xs py-1.5 px-2" value={fEntity} onChange={e => setFEntity(e.target.value)}>
            <option value="all">All Types</option>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
          <select className="select text-xs py-1.5 px-2" value={fAction} onChange={e => setFAction(e.target.value)}>
            <option value="all">All Actions</option>
            {ACTIONS_LIST.map(a => <option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
          </select>
          <input
            type="text"
            placeholder="Search actor name..."
            className="input text-xs py-1.5 px-2"
            value={fActor}
            onChange={e => setFActor(e.target.value)}
          />
          <input
            type="date"
            className="input text-xs py-1.5 px-2"
            value={fDateFrom}
            onChange={e => setFDateFrom(e.target.value)}
            title="From date"
          />
          <input
            type="date"
            className="input text-xs py-1.5 px-2"
            value={fDateTo}
            onChange={e => setFDateTo(e.target.value)}
            title="To date"
          />
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-ink-400 uppercase tracking-widest">
          {loading ? 'Loading...' : `${logs.length} entries`}
        </span>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="h-60 flex items-center justify-center text-ink-400 font-black animate-pulse uppercase tracking-widest text-sm">
          Loading Audit Logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="h-60 flex flex-col items-center justify-center gap-3 text-ink-400">
          <ShieldCheck size={32} className="opacity-30" />
          <p className="font-black uppercase tracking-widest text-sm">No audit records found</p>
          <p className="text-xs text-ink-300">Actions will appear here as staff use the system</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-ink-50 dark:bg-ink-950 text-ink-400 text-[10px] font-black uppercase tracking-widest border-b border-ink-100 dark:border-ink-800">
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50 dark:divide-ink-800/50">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-950/30 transition-colors">
                    {/* Time */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <p className="text-xs font-bold text-ink-700 dark:text-ink-300">{fmtTime(l.created_at)}</p>
                    </td>

                    {/* Actor */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <p className="text-xs font-black text-ink-900 dark:text-white">{l.actor_name || '—'}</p>
                      {l.actor_role && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide ${ROLE_BADGE[l.actor_role] || ROLE_BADGE.staff}`}>
                          {l.actor_role.replace('_',' ')}
                        </span>
                      )}
                    </td>

                    {/* Branch */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="text-xs font-bold text-ink-500 capitalize">{l.branch_id || '—'}</span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none">{ACTION_ICONS[l.action] || '📌'}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wide ${ACTION_COLORS[l.action] || 'text-ink-600'}`}>
                          {l.action?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>

                    {/* Entity Type */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      {l.entity_type && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${ENTITY_COLORS[l.entity_type] || 'bg-ink-100 text-ink-600'}`}>
                          {l.entity_type}
                        </span>
                      )}
                    </td>

                    {/* Label / Details */}
                    <td className="px-5 py-3 max-w-xs">
                      <p className="text-xs font-semibold text-ink-600 dark:text-ink-400 truncate" title={l.entity_label}>
                        {l.entity_label || '—'}
                      </p>
                      {l.metadata?.note && (
                        <p className="text-[10px] text-ink-400 truncate">{l.metadata.note}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
