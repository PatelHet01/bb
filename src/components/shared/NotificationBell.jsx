import { useState, useRef, useEffect } from 'react'
import { Bell, X, CheckCheck, Trash2 } from 'lucide-react'
import { useNotificationStore } from '../../store/notificationStore'

const TYPE_ICON = {
  order:   '🧾',
  payment: '💳',
  system:  '⚙️',
}

const TYPE_COLOR = {
  order:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  payment: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  system:  'bg-ink-100 text-ink-600 dark:bg-ink-800',
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000)
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount   = useNotificationStore((s) => s.unreadCount)
  const markAllRead   = useNotificationStore((s) => s.markAllRead)
  const clearAll      = useNotificationStore((s) => s.clearAll)

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) markAllRead()
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors text-ink-500 dark:text-ink-400"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-ember text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 animate-bounce-once">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-ink-900 rounded-2xl shadow-2xl border border-ink-100 dark:border-ink-800 z-[150] overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50">
            <span className="text-xs font-black text-ink-700 dark:text-ink-200 uppercase tracking-widest">
              Notifications {notifications.length > 0 && `(${notifications.length})`}
            </span>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    title="Mark all read"
                    className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-emerald-600 transition-colors"
                  >
                    <CheckCheck size={13} />
                  </button>
                  <button
                    onClick={clearAll}
                    title="Clear all"
                    className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-ink-400">
                <Bell size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold uppercase tracking-widest">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 items-start px-4 py-3 border-b border-ink-50 dark:border-ink-800/50 last:border-0 transition-colors ${
                    !n.read ? 'bg-ember/5 dark:bg-ember/5' : 'hover:bg-ink-50 dark:hover:bg-ink-950/30'
                  }`}
                >
                  <span className={`text-sm flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg ${TYPE_COLOR[n.type] || TYPE_COLOR.system}`}>
                    {TYPE_ICON[n.type] || '📢'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-ink-800 dark:text-ink-200 leading-tight">{n.title}</p>
                    <p className="text-[11px] text-ink-500 font-semibold mt-0.5 leading-tight truncate">{n.body}</p>
                    <p className="text-[10px] text-ink-300 font-semibold mt-1">{timeAgo(n.time)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-ember flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
