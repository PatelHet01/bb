import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { Utensils, Check, Clock, Trash2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function KDSPage() {
  const { branchId } = useAuthStore()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActiveOrders()
    
    const channel = supabase.channel('kds-orders')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: branchId ? `branch_id=eq.${branchId}` : undefined
      }, payload => {
        fetchActiveOrders()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchId])

  async function fetchActiveOrders() {
    let q = supabase.from('orders')
      .select('*, order_items(*, items(name, variant))')
      .in('status', ['new', 'preparing'])
      .order('created_at', { ascending: true })
    if (branchId) q = q.eq('branch_id', branchId)
    
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }

  async function updateStatus(id, newStatus) {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id)
    if (error) toast.error(error.message)
  }

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white -m-4 md:-m-6 p-4 md:p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin/dashboard')} 
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-dash-accent">
            <Utensils /> Kitchen Display Screen (KDS)
          </h1>
        </div>
        <div className="text-sm text-zinc-400">
          Branch: {branchId || 'All'} | {orders.length} Active Orders
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-dash-accent animate-pulse"><Utensils size={40} /></div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <Utensils size={48} className="mb-4 opacity-50" />
          <h2 className="text-xl font-bold">Kitchen is clear</h2>
          <p>Waiting for new orders...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {orders.map(order => (
            <div 
              key={order.id} 
              className={`bg-[#1C1C2E] rounded-xl border-2 overflow-hidden flex flex-col ${
                order.status === 'new' ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'border-blue-500/50'
              }`}
            >
              {/* Header */}
              <div className={`px-4 py-3 flex justify-between items-center ${order.status === 'new' ? 'bg-yellow-500/20' : 'bg-blue-500/20'}`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Order</span>
                  <p className="font-mono font-bold text-lg">#{order.order_number || order.id.slice(0,6).toUpperCase()}</p>
                  {order.table_number && (
                    <p className="text-xs font-bold text-amber-400 mt-0.5">🪑 Table {order.table_number}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Time</span>
                  <p className="font-mono flex items-center gap-1">
                    <Clock size={14} className={order.status === 'new' ? 'text-yellow-400' : 'text-blue-400'} />
                    {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="p-4 flex-1">
                <ul className="space-y-3">
                  {order.order_items?.map(item => (
                    <li key={item.id} className="flex justify-between items-start gap-4 border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <span className="bg-zinc-800 text-dash-accent font-bold px-2 py-1 rounded text-sm min-w-[32px] text-center">
                          {item.quantity}x
                        </span>
                        <div>
                          <p className="font-bold text-base">{item.items?.name}</p>
                          {item.items?.variant && <p className="text-xs text-zinc-400">{item.items.variant}</p>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 flex gap-2">
                {order.status === 'new' ? (
                  <button 
                    onClick={() => updateStatus(order.id, 'preparing')}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors"
                  >
                    Start Preparing
                  </button>
                ) : (
                  <button 
                    onClick={() => updateStatus(order.id, 'ready')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Check size={18} /> Mark Ready
                  </button>
                )}
                <button 
                  onClick={() => { if(confirm('Cancel order from kitchen?')) updateStatus(order.id, 'cancelled') }}
                  className="bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 p-3 rounded-lg transition-colors"
                  title="Cancel Order"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
