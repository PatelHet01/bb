import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { Utensils, X, ChevronRight } from 'lucide-react'

export default function OrderNotificationOverlay() {
  const { branchId } = useAuthStore()
  const navigate = useNavigate()
  const [newOrderAlert, setNewOrderAlert] = useState(null)

  useEffect(() => {
    // Listen for new orders (TMS/QR)
    const channel = supabase.channel('global-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders',
        filter: branchId ? `branch_id=eq.${branchId}` : undefined
      }, payload => {
        const order = payload.new
        // Only trigger for priority orders with table numbers (QR/TMS)
        if (order.table_number || order.order_type?.includes('QR')) {
          setNewOrderAlert(order)
          try { new Audio('/notification.mp3').play().catch(()=>{}) } catch(e){}
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [branchId])

  if (!newOrderAlert) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-fade-in">
      <div className="bg-white dark:bg-ink-900 w-full max-w-sm rounded-3xl shadow-2xl border-2 border-ember overflow-hidden animate-bounce-in">
        <div className="p-6 text-center">
          <div className="w-20 h-20 bg-ember/10 text-ember rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Utensils size={40} />
          </div>
          <h2 className="text-2xl font-black text-ink-900 dark:text-white uppercase tracking-tighter">New QR Order!</h2>
          <p className="text-ink-500 font-bold mt-1 uppercase tracking-widest text-[10px]">Action Required in Kitchen</p>
          
          <div className="mt-6 bg-ink-50 dark:bg-ink-950/50 p-4 rounded-2xl border border-ink-100 dark:border-ink-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-ink-400 uppercase">Order #</span>
              <span className="font-mono font-black text-ink-900 dark:text-white">#{newOrderAlert.order_number || newOrderAlert.id.slice(0,6).toUpperCase()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-ink-400 uppercase">Table</span>
              <span className="font-black text-ember text-xl tracking-widest">{newOrderAlert.table_number || '??'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-8">
            <button 
              onClick={() => setNewOrderAlert(null)}
              className="btn-secondary py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center"
            >
              <X size={16} className="mr-2" /> Dismiss
            </button>
            <button 
              onClick={() => { setNewOrderAlert(null); navigate('/kitchen'); }}
              className="btn-primary py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center shadow-lg shadow-ember/30"
            >
              View KDS <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
