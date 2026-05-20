import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Utensils, Clock, Maximize2, Check, ChevronLeft, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { playBell } from '../utils/bell'

function KDSItemRow({ item, onUpdate, orderId }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
      item.status === 'ready' ? 'bg-emerald-900/40' :
      item.status === 'preparing' ? 'bg-amber-900/30' : 'bg-zinc-800/60'
    }`}>
      <span className="bg-zinc-700 text-white font-black text-xs px-1.5 py-0.5 rounded min-w-[28px] text-center">
        {item.quantity}x
      </span>
      <span className={`flex-1 text-sm font-bold truncate ${item.status === 'ready' ? 'line-through text-zinc-500' : 'text-white'}`}>
        {item.item_name}
      </span>
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => onUpdate(item.id, 'preparing', orderId)}
          className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
            item.status === 'preparing' ? 'bg-amber-500 text-black' : 'bg-zinc-700 text-zinc-400 hover:bg-amber-500/30 hover:text-amber-300'
          }`}
        >Prep</button>
        <button
          onClick={() => onUpdate(item.id, 'ready', orderId)}
          className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
            item.status === 'ready' ? 'bg-emerald-500 text-black' : 'bg-zinc-700 text-zinc-400 hover:bg-emerald-500/30 hover:text-emerald-300'
          }`}
        ><Check size={12} /></button>
      </div>
    </div>
  )
}

function getTypeBadge(orderType) {
  const t = (orderType || '').toLowerCase()
  if (t.includes('swiggy') || t.includes('zomato') || t.includes('delivery')) return { label: 'Delivery', cls: 'bg-rose-500' }
  if (t.includes('takeaway') || t.includes('parcel')) return { label: 'Takeaway', cls: 'bg-amber-500' }
  return { label: 'Dine-in', cls: 'bg-blue-500' }
}

export default function KDSPage() {
  const { branchId } = useAuthStore()
  const [orders, setOrders] = useState([])
  const [kdsItems, setKdsItems] = useState({})
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  const [dbError, setDbError] = useState(false)

  // Live ticking clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchAll = useCallback(async () => {
    let q = supabase.from('orders')
      .select('*, customers(name), users!received_by(username)')
      .in('status', ['preparing', 'ready'])
      .order('created_at', { ascending: true })
    if (branchId) q = q.eq('branch_id', branchId)

    const { data: ordersData } = await q
    const fetched = ordersData || []
    setOrders(fetched)

    if (fetched.length > 0) {
      const ids = fetched.map(o => o.id)
      const { data: kItems, error } = await supabase.from('kds_items').select('*').in('order_id', ids)
      
      if (error) {
        console.error('KDS Fetch Error:', error)
        setDbError(true)
        toast.error('Database Error: Did you run the SQL migration? kds_items is missing.', { id: 'kds-err' })
      } else {
        setDbError(false)
      }

      const grouped = {}
      ;(kItems || []).forEach(ki => {
        if (!grouped[ki.order_id]) grouped[ki.order_id] = []
        grouped[ki.order_id].push(ki)
      })
      setKdsItems(grouped)
    } else {
      setKdsItems({})
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    fetchAll()
    const ch1 = supabase.channel('kds-orders-ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAll)
      .subscribe()
    const ch2 = supabase.channel('kds-kdsitems-ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kds_items' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [fetchAll])

  async function updateKdsItem(kdsItemId, newStatus, orderId) {
    const { error } = await supabase.from('kds_items')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', kdsItemId)
    if (error) { toast.error(error.message); return }

    // Optimistic local update
    setKdsItems(prev => {
      const updated = (prev[orderId] || []).map(ki =>
        ki.id === kdsItemId ? { ...ki, status: newStatus } : ki
      )
      const allReady = updated.length > 0 && updated.every(ki => ki.status === 'ready')
      if (allReady) {
        // Auto-mark order ready + bell + broadcast
        supabase.from('orders').update({ status: 'ready' }).eq('id', orderId)
        playBell()
        const order = orders.find(o => o.id === orderId)
        supabase.channel('order-ready-broadcast').send({
          type: 'broadcast',
          event: 'order_ready',
          payload: {
            order_id: orderId,
            table_number: order?.table_number,
            order_number: order?.order_number || orderId.slice(0, 6).toUpperCase(),
            order_type: order?.order_type
          }
        })
        toast.success(`🔔 Order #${order?.order_number || orderId.slice(0,6).toUpperCase()} is READY!`, {
          duration: 6000,
          style: { background: '#059669', color: '#fff', fontWeight: 'bold' }
        })
      }
      return { ...prev, [orderId]: updated }
    })
  }

  function elapsed(createdAt) {
    const s = Math.floor((now - new Date(createdAt).getTime()) / 1000)
    const m = Math.floor(s / 60)
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
  }

  async function dismissOrder(orderId) {
    if (!window.confirm('Dismiss this order from the kitchen board?')) return
    const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId)
    if (error) { toast.error('Failed to dismiss: ' + error.message); return }
    setOrders(prev => prev.filter(o => o.id !== orderId))
  }

  return (
    <div className="min-h-screen bg-[#09090F] text-white p-4 md:p-5">

      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
          ><ChevronLeft size={18} /></button>
          <div>
            <h1 className="font-black text-xl flex items-center gap-2">
              <Utensils size={20} className="text-amber-400" /> Kitchen Display
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
              {branchId || 'All Branches'} · {orders.length} active
            </p>
          </div>
        </div>
        <button
          onClick={() => document.documentElement.requestFullscreen?.()}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-bold text-zinc-300 transition-colors"
        >
          <Maximize2 size={15} /> Fullscreen
        </button>
      </div>

      {dbError && (
        <div className="mb-6 p-4 bg-red-900/50 border-2 border-red-500 rounded-xl text-red-200">
          <h2 className="text-xl font-black text-red-400 mb-1 flex items-center gap-2"><AlertTriangle size={20}/> CRITICAL DATABASE ERROR</h2>
          <p className="font-bold">The KDS cannot function because the <code>kds_items</code> table is missing from Supabase.</p>
          <p className="text-sm mt-1">You MUST go to the Supabase SQL Editor and run the script in <code>/scratch/migration_kds_items.sql</code></p>
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex justify-center py-28 text-amber-400 animate-pulse">
          <Utensils size={44} />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-36 text-zinc-700">
          <Utensils size={52} className="mb-4 opacity-20" />
          <h2 className="text-xl font-black text-zinc-600">Kitchen is clear</h2>
          <p className="text-zinc-700 text-sm mt-1">Waiting for orders…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {orders.map(order => {
            const items = kdsItems[order.id] || []
            const regular = items.filter(ki => !ki.is_addon)
            const addons  = items.filter(ki => ki.is_addon)
            const allReady = items.length > 0 && items.every(ki => ki.status === 'ready')
            const isOld = (now - new Date(order.created_at).getTime()) > 10 * 60 * 1000
            const { label: typeLabel, cls: typeCls } = getTypeBadge(order.order_type)

            return (
              <div
                key={order.id}
                className={`rounded-2xl border-2 overflow-hidden flex flex-col ${
                  order.status === 'ready' || allReady
                    ? 'border-emerald-500/50 bg-[#0C1C18]'
                    : 'border-zinc-800 bg-[#12121C]'
                }`}
              >
                {/* Card Header */}
                <div className={`px-4 py-3 flex justify-between items-start ${
                  order.status === 'ready' || allReady ? 'bg-emerald-900/30' : 'bg-zinc-800/40'
                }`}>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full text-white uppercase tracking-wider ${typeCls}`}>
                        {typeLabel}
                      </span>
                      {order.table_number && (
                        <span className="text-[9px] font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          Table {order.table_number}
                        </span>
                      )}
                      {(order.status === 'ready' || allReady) && (
                        <span className="text-[9px] font-black text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-pulse">
                          ✓ READY
                        </span>
                      )}
                    </div>
                    <p className="font-mono font-black text-base text-white">
                      #{order.order_number || order.id.slice(0, 6).toUpperCase()}
                    </p>
                    {order.customers?.name && (
                      <p className="text-xs text-zinc-500 leading-none mt-0.5">{order.customers.name}</p>
                    )}
                    {order.users?.username && (
                      <p className="text-[9px] text-zinc-600 leading-none mt-0.5">Staff: {order.users.username}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`flex items-center gap-1 text-sm font-bold ${isOld ? 'text-red-400' : 'text-zinc-500'}`}>
                      <Clock size={13} />
                      <span className="tabular-nums">{elapsed(order.created_at)}</span>
                    </div>
                    {(order.status === 'ready' || allReady || (regular.length === 0 && addons.length === 0)) && (
                      <button 
                        onClick={() => dismissOrder(order.id)}
                        className="text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                      >
                        <X size={12} /> Dismiss
                      </button>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="p-3 flex-1 space-y-1.5">
                  {regular.length === 0 && addons.length === 0 && (
                    <p className="text-center text-zinc-600 text-xs py-4">No items tracked</p>
                  )}
                  {regular.map(ki => (
                    <KDSItemRow key={ki.id} item={ki} onUpdate={updateKdsItem} orderId={order.id} />
                  ))}
                  {addons.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 pt-1">
                        <div className="h-px flex-1 bg-amber-500/25" />
                        <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full uppercase tracking-widest">
                          Add-on
                        </span>
                        <div className="h-px flex-1 bg-amber-500/25" />
                      </div>
                      {addons.map(ki => (
                        <KDSItemRow key={ki.id} item={ki} onUpdate={updateKdsItem} orderId={order.id} />
                      ))}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
