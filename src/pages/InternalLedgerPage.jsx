import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useSessionStore } from '../store/sessionStore'
import { ArrowLeftRight, Download, Plus, RefreshCw, Send } from 'lucide-react'
import toast from 'react-hot-toast'

export default function InternalLedgerPage() {
  const { user, branchId, role } = useAuthStore()
  const { currentSession } = useSessionStore()

  const [activeForm, setActiveForm] = useState('p2b') // 'p2b' | 'b2b' | 'p2p'
  const [usersList, setUsersList] = useState([])
  const [branchesList, setBranchesList] = useState([])
  
  // Form states
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [referenceNo, setReferenceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [fromUser, setFromUser] = useState('')
  const [toUser, setToUser] = useState('')
  const [fromBranch, setFromBranch] = useState('')
  const [toBranch, setToBranch] = useState('')
  const [saApprovalNote, setSaApprovalNote] = useState('')

  // Ledger state
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(true)

  // Filters
  const [filterType, setFilterType] = useState('all')
  const [filterBranch, setFilterBranch] = useState('all')

  useEffect(() => {
    fetchUsers()
    fetchBranches()
    fetchLedger()
  }, [branchId])

  async function fetchUsers() {
    const { data } = await supabase.from('users').select('id, username, role').eq('is_active', true)
    if (data) setUsersList(data)
  }

  async function fetchBranches() {
    const { data } = await supabase.from('branches').select('id, name')
    if (data) setBranchesList(data)
  }

  async function fetchLedger() {
    setLedgerLoading(true)
    let q = supabase
      .from('internal_ledger')
      .select('*, users!created_by(username)')
      .order('created_at', { ascending: false })

    if (role !== 'super_admin') {
      const b = branchId || 'gurukul'
      q = q.eq('branch_id', b)
    }

    const { data, error } = await q
    if (!error) {
      setLedger(data || [])
    }
    setLedgerLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    const finalAmount = parseFloat(amount)
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error('Please enter a valid amount')
      setLoading(false)
      return
    }

    const targetBranch = branchId || 'gurukul'

    try {
      let payload = {
        amount: finalAmount,
        purpose,
        payment_method: paymentMethod,
        reference_no: referenceNo,
        notes,
        branch_id: targetBranch,
        session_id: currentSession?.id || null,
        created_by: user?.id || null
      }

      if (activeForm === 'p2b') {
        const uRec = usersList.find(u => u.id === fromUser)
        const bRec = branchesList.find(b => b.id === toBranch)
        if (!fromUser || !toBranch) {
          toast.error('Please fill required fields')
          setLoading(false)
          return
        }
        payload = {
          ...payload,
          transaction_type: 'PERSONAL_TO_BUSINESS',
          from_entity_type: 'USER',
          from_entity_id: fromUser,
          from_entity_name: uRec?.username || 'User',
          to_entity_type: 'BRANCH',
          to_entity_id: toBranch,
          to_entity_name: bRec?.name || 'Branch',
          status: 'confirmed'
        }
      } else if (activeForm === 'b2b') {
        const bFromRec = branchesList.find(b => b.id === fromBranch)
        const bToRec = branchesList.find(b => b.id === toBranch)
        if (!fromBranch || !toBranch) {
          toast.error('Please fill required fields')
          setLoading(false)
          return
        }
        payload = {
          ...payload,
          transaction_type: 'BUSINESS_TO_BUSINESS',
          from_entity_type: 'BRANCH',
          from_entity_id: fromBranch,
          from_entity_name: bFromRec?.name || 'Branch From',
          to_entity_type: 'BRANCH',
          to_entity_id: toBranch,
          to_entity_name: bToRec?.name || 'Branch To',
          notes: saApprovalNote ? `SA Approved: ${saApprovalNote}. ${notes}` : notes,
          status: role === 'super_admin' ? 'confirmed' : 'pending_approval'
        }
      } else if (activeForm === 'p2p') {
        const uFromRec = usersList.find(u => u.id === fromUser)
        const uToRec = usersList.find(u => u.id === toUser)
        if (!fromUser || !toUser) {
          toast.error('Please fill required fields')
          setLoading(false)
          return
        }
        payload = {
          ...payload,
          transaction_type: 'PERSONAL_TO_PERSONAL',
          from_entity_type: 'USER',
          from_entity_id: fromUser,
          from_entity_name: uFromRec?.username || 'User From',
          to_entity_type: 'USER',
          to_entity_id: toUser,
          to_entity_name: uToRec?.username || 'User To',
          status: 'confirmed'
        }
      }

      const { error } = await supabase.from('internal_ledger').insert(payload)
      if (error) throw error

      toast.success('Internal ledger transaction recorded successfully!')
      
      // Reset forms
      setAmount('')
      setPurpose('')
      setPaymentMethod('CASH')
      setReferenceNo('')
      setNotes('')
      setFromUser('')
      setToUser('')
      setFromBranch('')
      setToBranch('')
      setSaApprovalNote('')

      fetchLedger()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id) {
    try {
      const { error } = await supabase
        .from('internal_ledger')
        .update({ status: 'confirmed', approved_by: user?.id })
        .eq('id', id)
      if (error) throw error
      toast.success('Transaction approved!')
      fetchLedger()
    } catch (e) {
      toast.error(e.message)
    }
  }

  function exportToCSV() {
    const headers = ['Date,Type,From,To,Amount,Purpose,Method,Status,Recorded By\n']
    const rows = ledger.map(l => {
      const date = new Date(l.created_at).toLocaleDateString('en-IN')
      return `"${date}","${l.transaction_type}","${l.from_entity_name}","${l.to_entity_name}",${l.amount},"${l.purpose || ''}","${l.payment_method}","${l.status}","${l.users?.username || 'System'}"`
    })
    const blob = new Blob([headers.concat(rows.join('\n'))], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', `BB_Internal_Ledger_${new Date().toISOString().split('T')[0]}.csv`)
    a.click()
  }

  const filteredLedger = ledger.filter(l => {
    if (filterType !== 'all' && l.transaction_type !== filterType) return false
    if (filterBranch !== 'all' && l.branch_id !== filterBranch) return false
    return true
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="text-ember" /> Internal Ledger
          </h1>
          <p className="text-sm font-semibold text-ink-500 mt-1 uppercase tracking-widest">Inter-Branch & Staff Financial Ledger</p>
        </div>
        <button
          onClick={exportToCSV}
          className="btn-secondary flex items-center gap-2 py-2.5 px-4 font-bold text-xs"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side Form */}
        <div className="md:col-span-2 bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 space-y-6 shadow-sm">
          <div className="flex bg-ink-50 dark:bg-ink-950 p-1 rounded-xl">
            {[
              { id: 'p2b', label: 'Personal → Business' },
              { id: 'b2b', label: 'Business → Business' },
              { id: 'p2p', label: 'Personal → Personal' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveForm(tab.id)
                  // Reset fields
                  setAmount('')
                  setPurpose('')
                }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all text-center ${
                  activeForm === tab.id
                    ? 'bg-white dark:bg-ink-800 shadow text-ink-900 dark:text-white'
                    : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeForm === 'p2b' && (
                <>
                  <div>
                    <label className="label">From User (Staff/Partner)</label>
                    <select
                      required
                      className="select w-full"
                      value={fromUser}
                      onChange={e => setFromUser(e.target.value)}
                    >
                      <option value="">Select User</option>
                      {usersList.map(u => (
                        <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">To Branch</label>
                    <select
                      required
                      className="select w-full"
                      value={toBranch}
                      onChange={e => setToBranch(e.target.value)}
                    >
                      <option value="">Select Branch</option>
                      {branchesList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeForm === 'b2b' && (
                <>
                  <div>
                    <label className="label">From Branch</label>
                    <select
                      required
                      className="select w-full"
                      value={fromBranch}
                      onChange={e => setFromBranch(e.target.value)}
                    >
                      <option value="">Select Branch</option>
                      {branchesList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">To Branch</label>
                    <select
                      required
                      className="select w-full"
                      value={toBranch}
                      onChange={e => setToBranch(e.target.value)}
                    >
                      <option value="">Select Branch</option>
                      {branchesList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeForm === 'p2p' && (
                <>
                  <div>
                    <label className="label">From User</label>
                    <select
                      required
                      className="select w-full"
                      value={fromUser}
                      onChange={e => setFromUser(e.target.value)}
                    >
                      <option value="">Select User</option>
                      {usersList.map(u => (
                        <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">To User</label>
                    <select
                      required
                      className="select w-full"
                      value={toUser}
                      onChange={e => setToUser(e.target.value)}
                    >
                      <option value="">Select User</option>
                      {usersList.map(u => (
                        <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div>
                <label className="label">Payment Mode</label>
                <select
                  className="select w-full"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Purpose / Description</label>
                <input
                  type="text"
                  required
                  className="input w-full"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="Why this transfer?"
                />
              </div>
              <div>
                <label className="label">Reference No. (optional)</label>
                <input
                  type="text"
                  className="input w-full"
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  placeholder="UPI Ref / Bank Txn ID"
                />
              </div>
            </div>

            {activeForm === 'b2b' && role !== 'super_admin' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400">
                ⚠️ B2B Transfers require Super Admin approval.
              </div>
            )}

            {activeForm === 'b2b' && role === 'super_admin' && (
              <div>
                <label className="label">SA Approval Note / Reference</label>
                <input
                  type="text"
                  className="input w-full"
                  value={saApprovalNote}
                  onChange={e => setSaApprovalNote(e.target.value)}
                  placeholder="Approval code or authorization note..."
                />
              </div>
            )}

            <div>
              <label className="label">General Notes (optional)</label>
              <textarea
                rows="2"
                className="input w-full"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional audit details..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-black text-sm"
            >
              <Plus size={16} /> Record Transaction
            </button>
          </form>
        </div>

        {/* Right Info Column */}
        <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 p-6 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-black text-ink-900 dark:text-white uppercase tracking-wider text-xs mb-3">Audit Details</h3>
            <div className="text-xs text-ink-500 space-y-2 leading-relaxed">
              <p>
                <strong>Personal → Business:</strong> Tracks cash or UPI deposits from staff or partners into the business bank/cash drawer (e.g. initial funding, settlement of cash).
              </p>
              <p>
                <strong>Business → Business:</strong> Inter-branch stock settlements, cash transfers, or petty cash redistribution. Requires approval.
              </p>
              <p>
                <strong>Personal → Personal:</strong> Mutual staff settlements recorded purely for system balance transparency.
              </p>
            </div>
          </div>
          <div className="p-3 bg-ink-50 dark:bg-ink-950 rounded-2xl border border-ink-100 dark:border-ink-800 text-xs font-bold text-ink-400">
            🔒 Double-entry ledger audit details cannot be modified or deleted. Always confirm before recording.
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-ink-900 rounded-3xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="font-black text-ink-900 dark:text-white flex items-center gap-2">
            Ledger Entries
          </h2>
          <div className="flex gap-2">
            <select
              className="select text-xs py-1 px-2.5"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="PERSONAL_TO_BUSINESS">Personal → Business</option>
              <option value="BUSINESS_TO_BUSINESS">Business → Business</option>
              <option value="PERSONAL_TO_PERSONAL">Personal → Personal</option>
            </select>
            {role === 'super_admin' && (
              <select
                className="select text-xs py-1 px-2.5"
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
              >
                <option value="all">All Branches</option>
                {branchesList.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <button onClick={fetchLedger} className="text-ink-500 hover:text-ink-700 p-1.5 hover:bg-ink-100 dark:hover:bg-ink-800 rounded-lg">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {ledgerLoading ? (
          <div className="py-16 text-center text-ink-400 animate-pulse font-bold">Loading ledger...</div>
        ) : filteredLedger.length === 0 ? (
          <div className="py-16 text-center text-ink-400 font-bold">No matching ledger entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-ink-50 dark:bg-ink-950 text-ink-500 text-[10px] font-black uppercase tracking-widest border-b border-ink-100 dark:border-ink-800">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">From</th>
                  <th className="px-6 py-3">To</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Purpose</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {filteredLedger.map(l => (
                  <tr key={l.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-950/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-ink-500 font-bold">
                      {new Date(l.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-ink-700 dark:text-ink-300">
                      {l.transaction_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-ink-900 dark:text-white">
                      {l.from_entity_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-ink-900 dark:text-white">
                      {l.to_entity_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-black text-emerald-600 dark:text-emerald-400">
                      ₹{Number(l.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-xs text-ink-500 font-semibold max-w-xs truncate" title={l.purpose}>
                      {l.purpose} {l.reference_no && `[Ref: ${l.reference_no}]`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        l.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      {l.status === 'pending_approval' && role === 'super_admin' ? (
                        <button
                          onClick={() => handleApprove(l.id)}
                          className="px-2.5 py-1 bg-emerald-500 text-white font-black rounded-lg hover:bg-emerald-600 active:scale-95 shadow-sm"
                        >
                          Approve
                        </button>
                      ) : (
                        <span className="text-ink-400 font-medium">None</span>
                      )}
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
