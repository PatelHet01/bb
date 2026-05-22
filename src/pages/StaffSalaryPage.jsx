import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Plus, Check, Clock, User, DollarSign, Shield, ShieldAlert, X, Edit2, Trash2, Key, History, Filter, Search, Download, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function StaffSalaryPage() {
  const { branchId, role, user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'salary'

  const [workers, setWorkers] = useState([])
  const [records, setRecords] = useState([])
  const [transactions, setTransactions] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const setActiveTab = (tab) => setSearchParams({ tab })
  const [showWorkerForm, setShowWorkerForm] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)
  const [workerForm, setWorkerForm] = useState({ name: '', role: 'Staff', base_salary: '', branch_id: branchId || 'gurukul', is_active: true, required_hours_per_day: 8 })

  const [attendanceLogs, setAttendanceLogs] = useState([])
  const [monthlyShifts, setMonthlyShifts] = useState([])
  const [khataBalances, setKhataBalances] = useState({})
  const [selectedWorkerDrilldown, setSelectedWorkerDrilldown] = useState(null)

  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'manager', branch_id: branchId || 'gurukul' })

  const [showTxForm, setShowTxForm] = useState(false)
  const [txForm, setTxForm] = useState({ worker_id: '', type: 'ADVANCE', amount: '', payment_mode: 'CASH', notes: '', date: new Date().toISOString().split('T')[0] })

  const [txFilters, setTxFilters] = useState({ worker_id: '', type: 'All', dateFrom: '', dateTo: '', search: '' })
  const [saving, setSaving] = useState(false)

  const [shifts, setShifts] = useState([])
  const todayStr = new Date().toISOString().split('T')[0]
  const [dayCode, setDayCode] = useState(todayStr.replace(/-/g, '').slice(-4))
  const [activeMonth, setActiveMonth] = useState(todayStr.slice(0, 7))

  const isSuperAdmin = role === 'super_admin'
  const isAdmin = role === 'admin' || isSuperAdmin

  useEffect(() => { fetchData() }, [branchId, activeMonth, activeTab])

  async function fetchData() {
    setLoading(true)
    try {
      if (activeTab === 'salary' || activeTab === 'attendance') {
        let wQ = supabase.from('workers').select('*').order('name')
        if (branchId) wQ = wQ.eq('branch_id', branchId)
        const { data: wData } = await wQ
        setWorkers(wData || [])

        // Fetch Khata balances
        const { data: khataData } = await supabase.from('staff_khata_ledger').select('worker_id, type, amount')
        const balances = (khataData || []).reduce((acc, curr) => {
          const amt = Number(curr.amount || 0)
          const wId = curr.worker_id
          if (!acc[wId]) acc[wId] = 0
          if (curr.type === 'CREDIT') {
            acc[wId] += amt
          } else if (curr.type === 'PAYMENT') {
            acc[wId] -= amt
          }
          return acc
        }, {})
        setKhataBalances(balances)

        // Fetch monthly attendance logs
        const { data: attLogs } = await supabase
          .from('attendance_log')
          .select('*')
          .like('date', `${activeMonth}%`)
        setAttendanceLogs(attLogs || [])

        // Fetch shifts for the active month (used in ledger drilldown)
        const { data: shiftLogs } = await supabase
          .from('shifts')
          .select('*')
          .like('clock_in', `${activeMonth}%`)
        setMonthlyShifts(shiftLogs || [])

        if (activeTab === 'salary') {
          let rQ = supabase.from('salary_records').select('*').eq('month_year', activeMonth)
          const { data: rData } = await rQ
          const workerIds = (wData || []).map(w => w.id)
          setRecords((rData || []).filter(r => workerIds.includes(r.worker_id)))

          let tQ = supabase.from('staff_transactions').select(`*, workers(name, role)`).order('created_at', { ascending: false })
          if (branchId) tQ = tQ.eq('branch_id', branchId)
          const { data: tData } = await tQ
          setTransactions(tData || [])
        }

        if (activeTab === 'attendance') {
          const { data: sData } = await supabase.from('shifts').select('*').gte('clock_in', `${todayStr}T00:00:00Z`)
          setShifts(sData || [])
        }
      }

      if (activeTab === 'access') {
        let uQ = supabase.from('users').select('*').order('created_at', { ascending: false })
        if (!isSuperAdmin && branchId) uQ = uQ.eq('branch_id', branchId)
        const { data: uData } = await uQ
        setUsers(uData || [])
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Worker Handlers
  async function handleSaveWorker(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: workerForm.name,
        role: workerForm.role,
        base_salary: parseFloat(workerForm.base_salary),
        branch_id: workerForm.branch_id,
        is_active: workerForm.is_active,
        required_hours_per_day: parseFloat(workerForm.required_hours_per_day || 8)
      }

      if (editingWorker) {
        const { error } = await supabase.from('workers').update(payload).eq('id', editingWorker.id)
        if (error) throw error
        toast.success('Worker updated')
      } else {
        const { count, error: countErr } = await supabase.from('workers').select('*', { count: 'exact', head: true })
        if (countErr) throw countErr
        payload.staff_code = `STF-${String((count || 0) + 1).padStart(4, '0')}`

        const { error } = await supabase.from('workers').insert(payload)
        if (error) throw error
        toast.success('Worker added')
      }

      setShowWorkerForm(false)
      setEditingWorker(null)
      setWorkerForm({ name: '', role: 'Staff', base_salary: '', branch_id: branchId || 'gurukul', is_active: true, required_hours_per_day: 8 })
      fetchData()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteWorker(id) {
    if (!confirm('Are you sure? This will remove the worker record.')) return
    const { error } = await supabase.from('workers').delete().eq('id', id)
    if (error) toast.error('Could not delete: ' + error.message)
    else { toast.success('Worker deleted'); fetchData() }
  }

  // User Handlers
  async function handleSaveUser(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const usernameClean = userForm.username.toLowerCase()
      const payload = {
        username: usernameClean,
        role: userForm.role,
        branch_id: userForm.branch_id
      }
      if (userForm.password) payload.password_hash = userForm.password

      if (editingUser) {
        const { error } = await supabase.from('users').update(payload).eq('id', editingUser.id)
        if (error) throw error
        toast.success('User updated')
      } else {
        payload.email = `${usernameClean}-${Date.now()}@bb.local`
        const { error } = await supabase.from('users').insert(payload)
        if (error) throw error
        toast.success('User created')
      }

      setShowUserForm(false)
      setEditingUser(null)
      setUserForm({ username: '', password: '', role: 'manager', branch_id: branchId || 'gurukul' })
      fetchData()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser(id) {
    if (!confirm('Delete this user account? Access will be revoked immediately.')) return
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('User deleted'); fetchData() }
  }

  // Recalculation Flow & Attendance Helpers
  async function recalculateSalary(workerId, monthYear, workerBaseSalary) {
    try {
      // 1. Sum up transactions for this month
      const { data: txs, error: txErr } = await supabase
        .from('staff_transactions')
        .select('type, amount')
        .eq('worker_id', workerId)
        .like('created_at', `${monthYear}%`)
      
      if (txErr) throw txErr

      let advance_taken = 0
      let bonus = 0
      let manual_deduction = 0

      for (const t of (txs || [])) {
        if (t.type === 'ADVANCE') advance_taken += Number(t.amount || 0)
        else if (t.type === 'BONUS') bonus += Number(t.amount || 0)
        else if (t.type === 'DEDUCTION') manual_deduction += Number(t.amount || 0)
      }

      // 2. Sum up attendance logs for this month
      const { data: atts, error: attErr } = await supabase
        .from('attendance_log')
        .select('status')
        .eq('worker_id', workerId)
        .like('date', `${monthYear}%`)

      if (attErr) throw attErr

      let leaves_taken = 0
      for (const a of (atts || [])) {
        if (a.status === 'absent') leaves_taken += 1.0
        else if (a.status === 'half_day') leaves_taken += 0.5
      }

      // 3. Compute attendance deduction
      const parts = monthYear.split('-')
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10)
      const daysInMonth = new Date(year, month, 0).getDate()

      const salaryPerDay = workerBaseSalary / daysInMonth
      const excessLeaves = Math.max(0, leaves_taken - 1)
      const attendance_deduction = excessLeaves * salaryPerDay

      // 4. Calculate Net Payable
      const net_payable = workerBaseSalary + bonus - advance_taken - manual_deduction - attendance_deduction

      // 5. Check if salary record already exists
      const { data: existingRecord } = await supabase
        .from('salary_records')
        .select('id, status, payment_note')
        .eq('worker_id', workerId)
        .eq('month_year', monthYear)
        .maybeSingle()

      const recordPayload = {
        worker_id: workerId,
        month_year: monthYear,
        base_salary: workerBaseSalary,
        bonus: bonus,
        advance_taken: advance_taken,
        manual_deduction: manual_deduction,
        attendance_deduction: attendance_deduction,
        leaves_taken: Math.ceil(leaves_taken),
        paid_leaves_allowed: 1,
        net_payable: net_payable,
        status: existingRecord?.status || 'unpaid',
        payment_note: existingRecord?.payment_note || null,
        updated_at: new Date().toISOString()
      }

      if (existingRecord) {
        const { error: updErr } = await supabase.from('salary_records').update(recordPayload).eq('id', existingRecord.id)
        if (updErr) throw updErr
      } else {
        const { error: insErr } = await supabase.from('salary_records').insert(recordPayload)
        if (insErr) throw insErr
      }
    } catch (err) {
      console.error("Error in recalculateSalary:", err)
      toast.error("Recalculation error: " + err.message)
    }
  }

  async function handleToggleAttendance(workerId, dateStr, newStatus) {
    try {
      const existing = attendanceLogs.find(l => l.worker_id === workerId && l.date === dateStr)
      
      const payload = {
        worker_id: workerId,
        date: dateStr,
        status: newStatus,
        branch_id: branchId || workers.find(w => w.id === workerId)?.branch_id || 'gurukul',
        recorded_by: user.username
      }

      if (existing) {
        const { error } = await supabase.from('attendance_log').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('attendance_log').insert(payload)
        if (error) throw error
      }

      // Re-fetch data and recalculate salary record
      const selectedWorker = workers.find(w => w.id === workerId)
      if (selectedWorker) {
        await recalculateSalary(workerId, activeMonth, selectedWorker.base_salary)
      }
      
      toast.success('Attendance updated')
      fetchData()
    } catch (e) {
      toast.error('Failed to update attendance: ' + e.message)
    }
  }

  const getDaysInMonthList = (monthYear) => {
    if (!monthYear) return []
    const [year, month] = monthYear.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    const days = []
    while (date.getMonth() === month - 1) {
      days.push(new Date(date))
      date.setDate(date.getDate() + 1)
    }
    return days
  }

  // Salary Handlers
  async function generateMonthlyRecords() {
    const existingIds = records.map(r => r.worker_id)
    const newWorkers = workers.filter(w => w.is_active && !existingIds.includes(w.id))
    if (newWorkers.length === 0) return toast('All records up to date for ' + activeMonth)
    const inserts = newWorkers.map(w => ({
      worker_id: w.id, month_year: activeMonth, base_salary: w.base_salary, net_payable: w.base_salary, status: 'unpaid'
    }))
    const { error } = await supabase.from('salary_records').insert(inserts)
    if (error) toast.error(error.message)
    else { toast.success(`Generated ${inserts.length} salary records`); fetchData() }
  }

  async function updateAdvance(recordId, newAdvance) {
    const record = records.find(r => r.id === recordId)
    if (!record) return
    const net = record.base_salary - newAdvance
    const { error } = await supabase.from('salary_records').update({ advance_taken: newAdvance, net_payable: net }).eq('id', recordId)
    if (error) toast.error(error.message)
    else fetchData()
  }

  async function markPaid(recordId) {
    const { error } = await supabase.from('salary_records').update({ status: 'paid' }).eq('id', recordId)
    if (error) toast.error(error.message)
    else fetchData()
  }

  async function deleteSalaryRecord(id) {
    if (!confirm('Delete this salary record?')) return
    const { error } = await supabase.from('salary_records').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Record deleted'); fetchData() }
  }

  // Attendance Handlers
  async function clockIn(workerId) {
    const { error } = await supabase.from('shifts').insert({
      worker_id: workerId, branch_id: branchId || 'gurukul', day_code: dayCode, clock_in: new Date().toISOString()
    })
    if (error) toast.error(error.message)
    else { toast.success('Clocked In'); fetchData() }
  }

  async function clockOut(shiftId) {
    const { error } = await supabase.from('shifts').update({ clock_out: new Date().toISOString() }).eq('id', shiftId)
    if (error) toast.error(error.message)
    else { toast.success('Clocked Out'); fetchData() }
  }

  async function toggleUserStatus(id, currentStatus) {
    await supabase.from('users').update({ is_active: !currentStatus }).eq('id', id)
    fetchData()
  }

  async function handleSaveTransaction(e) {
    e.preventDefault()
    if (!txForm.worker_id || !txForm.amount) return toast.error('Please fill all required fields')
    setSaving(true)
    try {
      const payload = {
        worker_id: txForm.worker_id,
        branch_id: branchId || workers.find(w => w.id === txForm.worker_id)?.branch_id || 'gurukul',
        type: txForm.type,
        amount: parseFloat(txForm.amount),
        payment_mode: txForm.payment_mode,
        notes: txForm.notes,
        created_by: String(user.id).startsWith('hardcoded') ? null : user.id,
        recorded_by: user.username,
        created_at: txForm.date ? `${txForm.date}T${new Date().toISOString().split('T')[1]}` : new Date().toISOString()
      }

      const { error } = await supabase.from('staff_transactions').insert(payload)
      if (error) throw error

      // If it's an advance, we might want to update the salary record for the current month too
      if (txForm.type === 'ADVANCE') {
        const monthYear = txForm.date.slice(0, 7)
        const { data: record } = await supabase.from('salary_records').select('*').eq('worker_id', txForm.worker_id).eq('month_year', monthYear).maybeSingle()
        if (record) {
          const newAdvance = (record.advance_taken || 0) + parseFloat(txForm.amount)
          await supabase.from('salary_records').update({ advance_taken: newAdvance, net_payable: record.base_salary - newAdvance }).eq('id', record.id)
        }
      }

      toast.success('Transaction logged')
      setShowTxForm(false)
      setTxForm({ worker_id: '', type: 'ADVANCE', amount: '', payment_mode: 'CASH', notes: '', date: new Date().toISOString().split('T')[0] })
      fetchData()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTransaction(id) {
    if (!confirm('Delete this transaction record?')) return
    const { error } = await supabase.from('staff_transactions').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Transaction deleted'); fetchData() }
  }

  const filteredTransactions = transactions.filter(tx => {
    const matchesWorker = !txFilters.worker_id || tx.worker_id === txFilters.worker_id
    const matchesType = txFilters.type === 'All' || tx.type === txFilters.type
    const matchesDateFrom = !txFilters.dateFrom || tx.created_at >= txFilters.dateFrom
    const matchesDateTo = !txFilters.dateTo || tx.created_at <= `${txFilters.dateTo}T23:59:59`
    const matchesSearch = !txFilters.search ||
      tx.workers?.name?.toLowerCase().includes(txFilters.search.toLowerCase()) ||
      tx.notes?.toLowerCase().includes(txFilters.search.toLowerCase())
    return matchesWorker && matchesType && matchesDateFrom && matchesDateTo && matchesSearch
  })

  const txTotals = filteredTransactions.reduce((acc, tx) => {
    if (tx.type === 'ADVANCE') acc.advance += Number(tx.amount)
    else if (tx.type === 'SALARY') acc.salary += Number(tx.amount)
    else if (tx.type === 'BONUS') acc.bonus += Number(tx.amount)
    else if (tx.type === 'DEDUCTION') acc.deduction += Number(tx.amount)
    acc.total += Number(tx.amount)
    return acc
  }, { advance: 0, salary: 0, bonus: 0, deduction: 0, total: 0 })

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink-900 dark:text-white tracking-tight">Staff & Salary Management</h1>
          <div className="flex gap-4 mt-3">
            {[
              { id: 'salary', label: 'Salary & Ledger', icon: DollarSign },
              { id: 'attendance', label: 'Daily Attendance', icon: Clock },
              { id: 'access', label: 'System Access', icon: Shield }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 text-sm font-bold pb-2 border-b-2 transition-all ${activeTab === tab.id ? 'border-ember text-ember' : 'border-transparent text-ink-400 hover:text-ink-600'}`}
              >
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {activeTab === 'salary' && (
            <div className="flex gap-2">
              <input type="month" className="input py-2" value={activeMonth} onChange={e => setActiveMonth(e.target.value)} />
              <button className="btn-secondary py-2" onClick={generateMonthlyRecords}>Generate Records</button>
            </div>
          )}
          {activeTab === 'access' && isAdmin && (
            <button className="btn-primary py-2 px-4" onClick={() => { setEditingUser(null); setUserForm({ username: '', password: '', role: 'manager', branch_id: branchId || 'gurukul' }); setShowUserForm(true); }}><Plus size={16} className="mr-1" /> Add User</button>
          )}
          {activeTab === 'salary' && (
            <button className="btn-primary py-2 px-4" onClick={() => setShowTxForm(true)}><Plus size={16} className="mr-1" /> Log Transaction</button>
          )}
          {(activeTab === 'salary' || activeTab === 'attendance') && (
            <button className="btn-primary py-2 px-4" onClick={() => { setEditingWorker(null); setWorkerForm({ name: '', role: 'Staff', base_salary: '', branch_id: branchId || 'gurukul', is_active: true }); setShowWorkerForm(true); }}><Plus size={16} className="mr-1" /> Add Worker</button>
          )}
        </div>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === 'salary' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-xs font-black text-ink-400 uppercase tracking-widest">Active Staff</h3>
              <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden divide-y divide-ink-100 dark:divide-ink-800">
                {workers.map(w => (
                  <div key={w.id} className="p-3 flex justify-between items-center group hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors">
                    <div>
                      <p className="font-bold text-sm text-ink-900 dark:text-white">{w.name}</p>
                      <p className="text-[10px] font-bold text-ink-500 uppercase">{w.role} · ₹{w.base_salary}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!w.is_active && <span className="badge bg-red-100 text-red-600 text-[9px] mr-2">Inactive</span>}
                      <button onClick={() => { setEditingWorker(w); setWorkerForm({ ...w }); setShowWorkerForm(true); }} className="p-1.5 text-ink-400 hover:text-ember opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={12} /></button>
                      <button onClick={() => deleteWorker(w.id)} className="p-1.5 text-ink-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-ink-50 dark:bg-ink-950/50">
                      <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Worker</th>
                      <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-right">Base Salary</th>
                      <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-center w-32">Advance Taken</th>
                      <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-right">Net Payable</th>
                      <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-center">Status</th>
                      <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {records.map(r => {
                      const w = workers.find(x => x.id === r.worker_id)
                      if (!w) return null
                      return (
                        <tr key={r.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors group">
                          <td className="px-4 py-4">
                            <p className="font-bold text-sm text-ink-900 dark:text-white">{w.name}</p>
                            <p className="text-[10px] text-ink-500">{w.role}</p>
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-sm">₹{r.base_salary}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="w-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold text-center py-1 rounded-lg border border-red-100 dark:border-red-900/50 text-sm">{r.advance_taken || 0}</span>
                              <button onClick={() => { setTxForm({ ...txForm, worker_id: w.id }); setShowTxForm(true); }} className="p-1.5 text-blue-500 hover:text-blue-700 bg-blue-50 rounded-lg shrink-0" title="Log Transaction"><Plus size={14} /></button>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-black text-emerald-600 dark:text-emerald-400">₹{r.net_payable.toLocaleString()}</td>
                          <td className="px-4 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${r.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {r.status !== 'paid' && (
                                <button onClick={() => { if (confirm(`Mark ₹${r.net_payable} as PAID to ${w.name}?`)) markPaid(r.id) }} className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95">Pay Now</button>
                              )}
                              <button onClick={() => deleteSalaryRecord(r.id)} className="p-1.5 text-ink-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {records.length === 0 && (
                      <tr><td colSpan="6" className="py-12 text-center text-ink-400 italic text-sm">No records for {activeMonth}. Click 'Generate Records' to start.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <h2 className="text-xl font-black text-ink-900 dark:text-white mb-4">Transaction Ledger</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="card p-4 border-l-4 border-l-blue-500">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Total Advance</p>
              <p className="text-xl font-black text-blue-600">₹{txTotals.advance.toLocaleString()}</p>
            </div>
            <div className="card p-4 border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Total Salary Paid</p>
              <p className="text-xl font-black text-emerald-600">₹{txTotals.salary.toLocaleString()}</p>
            </div>
            <div className="card p-4 border-l-4 border-l-amber-500">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Total Bonus</p>
              <p className="text-xl font-black text-amber-600">₹{txTotals.bonus.toLocaleString()}</p>
            </div>
            <div className="card p-4 border-l-4 border-l-red-500">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Total Deductions</p>
              <p className="text-xl font-black text-red-600">₹{txTotals.deduction.toLocaleString()}</p>
            </div>
            <div className="card p-4 border-l-4 border-l-ember bg-ember/5">
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest">Total Amount</p>
              <p className="text-xl font-black text-ember">₹{txTotals.total.toLocaleString()}</p>
            </div>
            </div>

              <div className="flex flex-col lg:flex-row gap-4 items-end bg-white dark:bg-ink-900 p-4 rounded-2xl border border-ink-200 dark:border-ink-800 shadow-sm">
            <div className="flex-1 w-full">
              <label className="label text-[10px]">Filter by Staff</label>
              <select className="input text-sm" value={txFilters.worker_id} onChange={e => setTxFilters({ ...txFilters, worker_id: e.target.value })}>
                <option value="">All Staff</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="label text-[10px]">Type</label>
              <select className="input text-sm" value={txFilters.type} onChange={e => setTxFilters({ ...txFilters, type: e.target.value })}>
                <option value="All">All Types</option>
                <option value="SALARY">Salary</option>
                <option value="ADVANCE">Advance</option>
                <option value="BONUS">Bonus</option>
                <option value="DEDUCTION">Deduction</option>
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="label text-[10px]">From</label>
              <input type="date" className="input text-sm" value={txFilters.dateFrom} onChange={e => setTxFilters({ ...txFilters, dateFrom: e.target.value })} />
            </div>
            <div className="flex-1 w-full">
              <label className="label text-[10px]">To</label>
              <input type="date" className="input text-sm" value={txFilters.dateTo} onChange={e => setTxFilters({ ...txFilters, dateTo: e.target.value })} />
            </div>
            <div className="flex-1 w-full relative">
              <Search size={14} className="absolute left-3 top-10 text-ink-400" />
              <input type="text" className="input text-sm pl-9" placeholder="Search notes..." value={txFilters.search} onChange={e => setTxFilters({ ...txFilters, search: e.target.value })} />
            </div>
              </div>

              <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-ink-50 dark:bg-ink-950/50">
                  <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Date / Time</th>
                  <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Staff Member</th>
                  <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Mode</th>
                  <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-right">Amount</th>
                  <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {filteredTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors group">
                    <td className="px-4 py-4">
                      <p className="text-xs font-bold text-ink-900 dark:text-white">{new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      <p className="text-[10px] text-ink-400 uppercase font-black">{new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-sm text-ink-900 dark:text-white">{t.workers?.name}</p>
                      <p className="text-[10px] text-ink-500 font-bold uppercase">{t.workers?.role}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${t.type === 'SALARY' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        t.type === 'ADVANCE' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          t.type === 'BONUS' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-red-50 text-red-600 border-red-100'
                        }`}>{t.type}</span>
                    </td>
                    <td className="px-4 py-4 text-xs font-black text-ink-400 uppercase tracking-tighter">{t.payment_mode}</td>
                    <td className="px-4 py-4 text-right">
                      <p className={`font-black text-base ${t.type === 'DEDUCTION' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {t.type === 'DEDUCTION' ? '-' : '+'}₹{t.amount.toLocaleString()}
                      </p>
                      {t.notes && <p className="text-[10px] text-ink-400 truncate max-w-[120px] ml-auto">{t.notes}</p>}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button onClick={() => deleteTransaction(t.id)} className="p-1.5 text-ink-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr><td colSpan="6" className="py-12 text-center text-ink-400 italic text-sm">No transactions found</td></tr>
                )}
              </tbody>
            </table>
              </div>
            </div>
          </div>
        </>
        )}

        {activeTab === 'attendance' && (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-ink-900 to-ink-800 p-6 rounded-2xl border border-ink-700 shadow-xl flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-black tracking-tight">Daily Attendance Tracking</h2>
            <p className="text-ink-400 text-xs mt-1 font-semibold uppercase tracking-widest">Date: {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-ember uppercase tracking-widest mb-1">Today's Clock-in Code</p>
            <div className="text-4xl font-black text-white bg-white/10 px-6 py-2 rounded-xl border border-white/20 letter-spacing-widest">
              {dayCode}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink-50 dark:bg-ink-950/50">
                <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Worker</th>
                <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Role</th>
                <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-center">Clock In</th>
                <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-center">Clock Out</th>
                <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-right">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {workers.filter(w => w.is_active).map(w => {
                const shift = shifts.find(s => s.worker_id === w.id && !s.clock_out)
                const completedShift = shifts.find(s => s.worker_id === w.id && s.clock_out)
                return (
                  <tr key={w.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
                    <td className="px-4 py-4 font-bold text-sm text-ink-900 dark:text-white">{w.name}</td>
                    <td className="px-4 py-4 text-xs font-semibold text-ink-500 uppercase">{w.role}</td>
                    <td className="px-4 py-4 text-center font-mono text-sm">
                      {shift ? new Date(shift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                        completedShift ? new Date(completedShift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </td>
                    <td className="px-4 py-4 text-center font-mono text-sm">
                      {completedShift ? new Date(completedShift.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {!shift && !completedShift && (
                        <button onClick={() => clockIn(w.id)} className="text-xs font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-100 tracking-wider uppercase">Clock In</button>
                      )}
                      {shift && !completedShift && (
                        <button onClick={() => clockOut(shift.id)} className="text-xs font-black text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-100 tracking-wider uppercase">Clock Out</button>
                      )}
                      {completedShift && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Shift Completed</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  {
    activeTab === 'access' && (
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-200 dark:border-ink-800 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-ink-50 dark:bg-ink-950/50">
              <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Username</th>
              <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Role</th>
              <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase">Branch Scope</th>
              <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-center">Status</th>
              <th className="px-4 py-3 text-[10px] font-black text-ink-400 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors group">
                <td className="px-4 py-4 font-bold text-sm text-ink-900 dark:text-white">@{u.username}</td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${u.role === 'super_admin' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>{u.role}</span>
                </td>
                <td className="px-4 py-4 text-xs font-bold text-ink-500 uppercase">{u.branch_id || 'Global / All'}</td>
                <td className="px-4 py-4 text-center">
                  {u.is_active ? <span className="text-emerald-500 font-bold text-[10px] uppercase">Active</span> : <span className="text-red-500 font-bold text-[10px] uppercase">Disabled</span>}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end items-center gap-2">
                    {isAdmin && u.role !== 'super_admin' && (
                      <button
                        onClick={() => toggleUserStatus(u.id, u.is_active)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${u.is_active ? 'text-amber-500 border-amber-200 bg-amber-50 hover:bg-amber-100' : 'text-emerald-500 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'}`}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                    {isAdmin && u.role !== 'super_admin' && (
                      <button onClick={() => { setEditingUser(u); setUserForm({ ...u, password: '' }); setShowUserForm(true); }} className="p-1.5 text-ink-400 hover:text-ember opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={14} /></button>
                    )}
                    {isAdmin && u.role !== 'super_admin' && (
                      <button onClick={() => deleteUser(u.id)} className="p-1.5 text-ink-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
      </div >

    {/* Forms Overlay / Modals */ }
  {
    showWorkerForm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <form onSubmit={handleSaveWorker} className="bg-white dark:bg-ink-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
          <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex justify-between items-center bg-ink-50 dark:bg-ink-950/50">
            <h3 className="font-bold text-ink-900 dark:text-white">{editingWorker ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
            <button type="button" onClick={() => setShowWorkerForm(false)} className="text-ink-400 hover:text-ink-900"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div><label className="label">Full Name</label><input required type="text" className="input" placeholder="e.g. Ramesh Kumar" value={workerForm.name} onChange={e => setWorkerForm({ ...workerForm, name: e.target.value })} /></div>
            <div><label className="label">Role</label><input required type="text" className="input" placeholder="e.g. Head Chef" value={workerForm.role} onChange={e => setWorkerForm({ ...workerForm, role: e.target.value })} /></div>
            <div><label className="label">Base Salary (per month)</label><input required type="number" className="input" placeholder="₹" value={workerForm.base_salary} onChange={e => setWorkerForm({ ...workerForm, base_salary: e.target.value })} /></div>
            {isSuperAdmin && (
              <div><label className="label">Assign to Branch</label>
                <select className="input" value={workerForm.branch_id} onChange={e => setWorkerForm({ ...workerForm, branch_id: e.target.value })}>
                  <option value="gurukul">Gurukul</option><option value="bhat">Bhat</option><option value="visat">Visat</option>
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="worker_active" checked={workerForm.is_active} onChange={e => setWorkerForm({ ...workerForm, is_active: e.target.checked })} />
              <label htmlFor="worker_active" className="text-sm font-bold text-ink-700 dark:text-ink-300">Staff is currently active</label>
            </div>
          </div>
          <div className="p-6 bg-ink-50 dark:bg-ink-950/50 flex gap-3">
            <button type="button" onClick={() => setShowWorkerForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1 py-3" disabled={saving}>{saving ? 'Saving...' : editingWorker ? 'Update' : 'Add Worker'}</button>
          </div>
        </form>
      </div>
    )
  }

  {
    showUserForm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <form onSubmit={handleSaveUser} className="bg-white dark:bg-ink-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
          <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex justify-between items-center bg-ink-50 dark:bg-ink-950/50">
            <h3 className="font-bold text-ink-900 dark:text-white">{editingUser ? 'Edit User Access' : 'Create System Login'}</h3>
            <button type="button" onClick={() => setShowUserForm(false)} className="text-ink-400 hover:text-ink-900"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div><label className="label">Username</label><input required type="text" className="input lowercase" placeholder="e.g. bhat_manager" value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value.replace(/\s+/g, '_') })} /></div>
            <div>
              <label className="label">{editingUser ? 'New Password (leave blank to keep current)' : 'Temporary Password'}</label>
              <div className="relative">
                <input required={!editingUser} type="text" className="input pr-10" placeholder="Set password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
                <Key size={16} className="absolute right-3 top-3.5 text-ink-300" />
              </div>
            </div>
            <div><label className="label">System Role</label>
              <select className="input" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} disabled={!isSuperAdmin && editingUser?.role === 'super_admin'}>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
              </select>
            </div>
            {isSuperAdmin && (
              <div><label className="label">Login Branch Access</label>
                <select className="input" value={userForm.branch_id} onChange={e => setUserForm({ ...userForm, branch_id: e.target.value })}>
                  <option value="">Global / All</option>
                  <option value="gurukul">Gurukul</option><option value="bhat">Bhat</option><option value="visat">Visat</option>
                </select>
              </div>
            )}
          </div>
          <div className="p-6 bg-ink-50 dark:bg-ink-950/50 flex gap-3">
            <button type="button" onClick={() => setShowUserForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1 py-3" disabled={saving}>{saving ? 'Saving...' : editingUser ? 'Update Login' : 'Create Login'}</button>
          </div>
        </form>
      </div>
    )
  }
  {
    showTxForm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <form onSubmit={handleSaveTransaction} className="bg-white dark:bg-ink-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
          <div className="px-6 py-4 border-b border-ink-100 dark:border-ink-800 flex justify-between items-center bg-ink-50 dark:bg-ink-950/50">
            <div>
              <h3 className="font-bold text-ink-900 dark:text-white">Log Staff Transaction</h3>
              <p className="text-[10px] font-black text-ink-400 uppercase tracking-widest mt-0.5">Advance, Salary, Bonus, etc.</p>
            </div>
            <button type="button" onClick={() => { setShowTxForm(false); setEditingUser(null); }} className="text-ink-400 hover:text-ink-900"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date</label>
                <input required type="date" className="input" value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} />
              </div>
              <div>
                <label className="label">Transaction Type</label>
                <select className="input" value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })}>
                  <option value="ADVANCE">Advance Given</option>
                  <option value="SALARY">Salary Payment</option>
                  <option value="BONUS">Bonus / Reward</option>
                  <option value="DEDUCTION">Deduction</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Staff Member</label>
              <select required className="input" value={txForm.worker_id} onChange={e => setTxForm({ ...txForm, worker_id: e.target.value })}>
                <option value="">Select staff…</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.role})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Amount (₹)</label>
                <input required type="number" className="input font-bold" placeholder="0.00" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="label">Payment Mode</label>
                <select className="input" value={txForm.payment_mode} onChange={e => setTxForm({ ...txForm, payment_mode: e.target.value })}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI / Online</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Notes / Remarks</label>
              <textarea className="input min-h-[80px]" placeholder="Optional notes about this payment..." value={txForm.notes} onChange={e => setTxForm({ ...txForm, notes: e.target.value })} />
            </div>
          </div>
          <div className="p-6 bg-ink-50 dark:bg-ink-950/50 flex gap-3">
            <button type="button" onClick={() => { setShowTxForm(false); setEditingUser(null); }} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1 py-3" disabled={saving}>{saving ? 'Saving...' : 'Log Transaction'}</button>
          </div>
        </form>
      </div>
    )
  }
    </div >
  )
}
