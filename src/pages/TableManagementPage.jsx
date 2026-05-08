import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Plus, QrCode, Trash2, RefreshCw, Users, Edit2, Check, X } from 'lucide-react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  available:  { label: 'Available',  color: 'bg-emerald-500',  text: 'text-emerald-400',  border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  occupied:   { label: 'Occupied',   color: 'bg-amber-500',    text: 'text-amber-400',    border: 'border-amber-500/30',   bg: 'bg-amber-500/10'   },
  reserved:   { label: 'Reserved',   color: 'bg-blue-500',     text: 'text-blue-400',     border: 'border-blue-500/30',    bg: 'bg-blue-500/10'    },
  cleaning:   { label: 'Cleaning',   color: 'bg-purple-500',   text: 'text-purple-400',   border: 'border-purple-500/30',  bg: 'bg-purple-500/10'  },
}

const BASE_URL = window.location.origin

export default function TableManagementPage() {
  const { branchId, role } = useAuthStore()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({ table_number: '', label: '', capacity: 4 })
  const [saving, setSaving] = useState(false)
  const isAdmin = role === 'admin' || role === 'super_admin'
  const activeBranch = branchId || 'bhat'

  useEffect(() => {
    fetchTables()
    const chan = supabase.channel('cafe_tables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables' }, fetchTables)
      .subscribe()
    return () => supabase.removeChannel(chan)
  }, [branchId])

  async function fetchTables() {
    let q = supabase.from('cafe_tables').select('*').order('table_number')
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    setTables(data || [])
    setLoading(false)
  }

  async function handleAddTable(e) {
    e.preventDefault()
    if (!form.table_number) return toast.error('Table number required')
    setSaving(true)
    const { error } = await supabase.from('cafe_tables').insert({
      branch_id: activeBranch,
      table_number: parseInt(form.table_number),
      label: form.label || `Table ${form.table_number}`,
      capacity: parseInt(form.capacity) || 4,
    })
    setSaving(false)
    if (error) return toast.error(error.code === '23505' ? 'Table number already exists' : error.message)
    toast.success('Table added')
    setShowAddModal(false)
    setForm({ table_number: '', label: '', capacity: 4 })
  }

  async function updateStatus(tableId, newStatus) {
    const { error } = await supabase.from('cafe_tables').update({ status: newStatus }).eq('id', tableId)
    if (error) toast.error(error.message)
  }

  async function deleteTable(tableId) {
    if (!confirm('Delete this table? Its QR code will stop working.')) return
    const { error } = await supabase.from('cafe_tables').delete().eq('id', tableId)
    if (error) toast.error(error.message)
    else toast.success('Table deleted')
  }

  async function downloadQR(table) {
    const url = `${BASE_URL}/cafe/order?table=${table.qr_token}`
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, url, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
    
    // Add label below QR
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = 400
    finalCanvas.height = 460
    const ctx = finalCanvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 400, 460)
    ctx.drawImage(canvas, 0, 0)
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 28px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(table.label || `Table ${table.table_number}`, 200, 435)
    ctx.font = '16px Inter, sans-serif'
    ctx.fillStyle = '#666666'
    ctx.fillText('Scan to order from BB Cafe', 200, 455)

    const link = document.createElement('a')
    link.download = `BB-Table-${table.table_number}-QR.png`
    link.href = finalCanvas.toDataURL()
    link.click()
    toast.success(`QR downloaded for ${table.label || `Table ${table.table_number}`}`)
  }

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = tables.filter(t => t.status === s).length
    return acc
  }, {})

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dash-text dark:text-dash-textDark">Table Management</h1>
          <p className="text-sm text-dash-muted mt-1">{tables.length} tables · Scan QR to order</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus size={16} /> Add Table
          </button>
        )}
      </div>

      {/* Status Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className={`card p-4 flex items-center gap-3 border ${cfg.border} ${cfg.bg}`}>
            <div className={`w-3 h-3 rounded-full ${cfg.color} flex-shrink-0`} />
            <div>
              <div className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</div>
              <div className="text-xl font-black text-dash-text dark:text-dash-textDark">{statusCounts[key] || 0}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tables Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="card h-48 animate-pulse bg-zinc-100 dark:bg-zinc-800" />)}
        </div>
      ) : tables.length === 0 ? (
        <div className="card p-16 text-center">
          <QrCode size={48} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
          <h2 className="text-lg font-bold text-dash-text dark:text-dash-textDark mb-2">No tables yet</h2>
          <p className="text-dash-muted text-sm mb-6">Add your first table to generate a QR code for customer ordering.</p>
          {isAdmin && <button onClick={() => setShowAddModal(true)} className="btn-primary mx-auto">Add First Table</button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {tables.map(table => {
            const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available
            return (
              <div key={table.id} className={`card p-4 flex flex-col gap-3 border-2 ${cfg.border} transition-all hover:shadow-lg`}>
                {/* Table Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold text-dash-muted uppercase tracking-widest">Table</div>
                    <div className="text-3xl font-black text-dash-text dark:text-dash-textDark leading-none">{table.table_number}</div>
                    <div className="text-xs text-dash-muted mt-0.5">{table.label}</div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${cfg.color} mt-1 shadow-lg ${table.status === 'occupied' ? 'animate-pulse' : ''}`} />
                </div>

                {/* Capacity */}
                <div className="flex items-center gap-1.5 text-xs text-dash-muted">
                  <Users size={12} />
                  <span>{table.capacity} seats</span>
                </div>

                {/* Status selector */}
                <select
                  value={table.status}
                  onChange={e => updateStatus(table.id, e.target.value)}
                  className={`text-xs font-bold px-2 py-1.5 rounded-lg border cursor-pointer ${cfg.border} ${cfg.bg} ${cfg.text} bg-transparent w-full`}
                >
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>

                {/* Actions */}
                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    onClick={() => downloadQR(table)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs font-bold py-2 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                    title="Download QR Code"
                  >
                    <QrCode size={13} /> QR
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => deleteTable(table.id)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete table"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-dash-text dark:text-dash-textDark">Add New Table</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <label className="label">Table Number *</label>
                <input type="number" required min="1" className="input w-full" placeholder="e.g. 1" value={form.table_number} onChange={e => setForm(p => ({...p, table_number: e.target.value}))} />
              </div>
              <div>
                <label className="label">Label</label>
                <input type="text" className="input w-full" placeholder="e.g. Window Seat, Terrace A, VIP 1" value={form.label} onChange={e => setForm(p => ({...p, label: e.target.value}))} />
              </div>
              <div>
                <label className="label">Seating Capacity</label>
                <input type="number" min="1" max="20" className="input w-full" value={form.capacity} onChange={e => setForm(p => ({...p, capacity: e.target.value}))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Adding...' : 'Add Table'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
