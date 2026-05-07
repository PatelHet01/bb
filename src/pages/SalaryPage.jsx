import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Plus, Check, Clock, User, DollarSign, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SalaryPage() {
  const { branchId, role, user } = useAuthStore()
  const [workers, setWorkers] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', role: 'Staff', base_salary: '' })
  const [activeTab, setActiveTab] = useState('salary') // 'salary' or 'attendance'
  const [shifts, setShifts] = useState([])
  const todayStr = new Date().toISOString().split('T')[0]
  const [dayCode, setDayCode] = useState(todayStr.replace(/-/g, '').slice(-4))

  useEffect(() => { fetchData() }, [branchId, activeMonth])

  async function fetchData() {
    setLoading(true)
    let wQ = supabase.from('workers').select('*').order('name')
    if (branchId) wQ = wQ.eq('branch_id', branchId)
    const { data: wData } = await wQ
    setWorkers(wData || [])

    let rQ = supabase.from('salary_records').select('*').eq('month_year', activeMonth)
    const { data: rData } = await rQ
    const workerIds = (wData || []).map(w => w.id)
    setRecords((rData || []).filter(r => workerIds.includes(r.worker_id)))

    // Fetch today's shifts
    const { data: sData } = await supabase.from('shifts').select('*').eq('branch_id', activeBranch).gte('clock_in', `${todayStr}T00:00:00Z`)
    setShifts(sData || [])
    
    setLoading(false)
  }

  async function handleAddWorker(e) {
    e.preventDefault()
    const { error } = await supabase.from('workers').insert({
      name: form.name, role: form.role, base_salary: parseFloat(form.base_salary), branch_id: activeBranch
    })
    if (error) return toast.error(error.message)
    toast.success('Worker added')
    setShowForm(false)
    setForm({ name: '', role: 'Staff', base_salary: '' })
    fetchData()
  }

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

  async function clockIn(workerId) {
    const { error } = await supabase.from('shifts').insert({
      worker_id: workerId, branch_id: activeBranch, day_code: dayCode, clock_in: new Date().toISOString()
    })
    if (error) toast.error(error.message)
    else { toast.success('Clocked In'); fetchData() }
  }

  async function clockOut(shiftId) {
    const { error } = await supabase.from('shifts').update({ clock_out: new Date().toISOString() }).eq('id', shiftId)
    if (error) toast.error(error.message)
    else { toast.success('Clocked Out'); fetchData() }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-dash-text dark:text-dash-textDark">HR & Operations</h1>
          <div className="flex gap-4 mt-2">
            <button onClick={()=>setActiveTab('salary')} className={`text-sm font-bold pb-1 border-b-2 ${activeTab === 'salary' ? 'border-ember text-ember' : 'border-transparent text-dash-muted hover:text-dash-text'}`}>Salary & Staff</button>
            <button onClick={()=>setActiveTab('attendance')} className={`text-sm font-bold pb-1 border-b-2 ${activeTab === 'attendance' ? 'border-ember text-ember' : 'border-transparent text-dash-muted hover:text-dash-text'}`}>Daily Attendance</button>
          </div>
        </div>
        {activeTab === 'salary' && (
          <input type="month" className="input" value={activeMonth} onChange={e => setActiveMonth(e.target.value)} />
        )}
      </div>

      {activeTab === 'salary' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Workers List */}
          <div className="col-span-1 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg text-dash-text dark:text-dash-textDark">Active Staff</h2>
              <button className="btn-primary btn-sm" onClick={() => setShowForm(!showForm)}><Plus size={14}/> Add Worker</button>
            </div>

            {showForm && (
              <form onSubmit={handleAddWorker} className="card p-4 space-y-3 bg-dash-bg dark:bg-zinc-900 border-dash-border dark:border-dash-borderDark">
                <input required type="text" className="input text-sm py-1.5 w-full" placeholder="Full Name" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
                <input required type="text" className="input text-sm py-1.5 w-full" placeholder="Role (e.g. Chef, Server)" value={form.role} onChange={e=>setForm({...form, role: e.target.value})} />
                <input required type="number" className="input text-sm py-1.5 w-full" placeholder="Base Monthly Salary" value={form.base_salary} onChange={e=>setForm({...form, base_salary: e.target.value})} />
                <button type="submit" className="btn-primary w-full text-sm py-1.5">Save Worker</button>
              </form>
            )}

            <div className="card overflow-hidden bg-dash-bg dark:bg-zinc-900 border-dash-border dark:border-dash-borderDark">
              {workers.map(w => (
                <div key={w.id} className="p-3 border-b border-dash-border dark:border-dash-borderDark last:border-0 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-dash-text dark:text-dash-textDark">{w.name}</div>
                    <div className="text-xs text-dash-muted">{w.role} • ₹{w.base_salary}</div>
                  </div>
                  {!w.is_active && <span className="badge-danger">Inactive</span>}
                </div>
              ))}
              {workers.length === 0 && !loading && <div className="p-4 text-center text-zinc-500">No staff found.</div>}
            </div>
          </div>

          {/* Salary Ledger */}
          <div className="col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg text-dash-text dark:text-dash-textDark">Salary Ledger ({activeMonth})</h2>
              <button className="btn-secondary btn-sm" onClick={generateMonthlyRecords}><DollarSign size={14}/> Generate Month</button>
            </div>

            <div className="card overflow-hidden bg-dash-bg dark:bg-zinc-900 border-dash-border dark:border-dash-borderDark">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="tbl-head">Worker</th>
                    <th className="tbl-head text-right">Base (₹)</th>
                    <th className="tbl-head text-center w-32">Advance (₹)</th>
                    <th className="tbl-head text-right font-bold text-emerald-600 dark:text-emerald-400">Net Payable</th>
                    <th className="tbl-head text-center">Status</th>
                    <th className="tbl-head text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => {
                    const w = workers.find(x => x.id === r.worker_id)
                    if (!w) return null
                    return (
                      <tr key={r.id} className="tbl-row border-b border-dash-border dark:border-dash-borderDark">
                        <td className="tbl-cell font-bold">{w.name}</td>
                        <td className="tbl-cell text-right">{r.base_salary}</td>
                        <td className="tbl-cell">
                          <input 
                            type="number" 
                            className="input w-full text-center py-1 text-sm bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 font-bold" 
                            defaultValue={r.advance_taken}
                            onBlur={(e) => updateAdvance(r.id, parseFloat(e.target.value) || 0)}
                            disabled={r.status === 'paid'}
                          />
                        </td>
                        <td className="tbl-cell text-right font-bold text-emerald-600 dark:text-emerald-400">₹{r.net_payable.toLocaleString()}</td>
                        <td className="tbl-cell text-center">
                          <span className={r.status === 'paid' ? 'badge-success' : 'badge-danger'}>{r.status.toUpperCase()}</span>
                        </td>
                        <td className="tbl-cell text-center">
                          {r.status !== 'paid' && (
                            <button onClick={() => {if(confirm(`Mark ₹${r.net_payable} as PAID to ${w.name}?`)) markPaid(r.id)}} className="text-xs font-bold text-emerald-600 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 dark:text-emerald-400 px-2 py-1 rounded transition-colors">
                              Pay Now
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {records.length === 0 && !loading && (
                    <tr><td colSpan="6" className="tbl-cell text-center py-8 text-zinc-500">No salary records generated for this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <div className="card p-6 bg-dash-bg dark:bg-zinc-900 border-dash-border dark:border-dash-borderDark flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-dash-text dark:text-dash-textDark">Today's Day Code</h2>
              <p className="text-dash-muted text-sm mt-1">Staff can clock in at POS using this code.</p>
            </div>
            <div className="text-4xl font-black text-ember tracking-widest bg-ember/10 px-6 py-2 rounded-xl">
              {dayCode}
            </div>
          </div>

          <div className="card overflow-hidden bg-dash-bg dark:bg-zinc-900 border-dash-border dark:border-dash-borderDark">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="tbl-head">Worker</th>
                  <th className="tbl-head">Role</th>
                  <th className="tbl-head">Clock In</th>
                  <th className="tbl-head">Clock Out</th>
                  <th className="tbl-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workers.filter(w=>w.is_active).map(w => {
                  const shift = shifts.find(s => s.worker_id === w.id && !s.clock_out)
                  const completedShift = shifts.find(s => s.worker_id === w.id && s.clock_out)
                  
                  return (
                    <tr key={w.id} className="tbl-row border-b border-dash-border dark:border-dash-borderDark">
                      <td className="tbl-cell font-bold text-dash-text dark:text-dash-textDark">{w.name}</td>
                      <td className="tbl-cell text-dash-muted">{w.role}</td>
                      <td className="tbl-cell">
                        {shift ? new Date(shift.clock_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 
                         completedShift ? new Date(completedShift.clock_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 
                         <span className="text-zinc-500">--:--</span>}
                      </td>
                      <td className="tbl-cell">
                        {completedShift ? new Date(completedShift.clock_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 
                         <span className="text-zinc-500">--:--</span>}
                      </td>
                      <td className="tbl-cell text-right">
                        {!shift && !completedShift && (
                          <button onClick={()=>clockIn(w.id)} className="btn-primary btn-sm bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 text-white">
                            <Clock size={14} className="mr-1"/> Clock In
                          </button>
                        )}
                        {shift && !completedShift && (
                          <button onClick={()=>clockOut(shift.id)} className="btn-primary btn-sm bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white">
                            <Check size={14} className="mr-1"/> Clock Out
                          </button>
                        )}
                        {completedShift && <span className="badge-success">Completed</span>}
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
  )
}
