import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCustomerStore } from '../store/customerStore'
import { motion } from 'framer-motion'
import { LogOut, Coins, ArrowUpCircle, ArrowDownCircle, Star, Gamepad2 } from 'lucide-react'

const S = {
  page: { background: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: 'white' },
  header: { padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  container: { maxWidth: '600px', margin: '0 auto', padding: '1.5rem' },
  card: { border: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem', marginBottom: '1rem' },
  label: { fontSize: '0.6rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' },
  tab: (active) => ({
    padding: '0.75rem 1.25rem', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', border: 'none', background: 'none', color: active ? 'white' : 'rgba(255,255,255,0.3)', borderBottom: active ? '2px solid white' : '2px solid transparent', transition: 'all 0.2s',
  }),
}

export default function MyBethakDashboard() {
  const { customer, logout } = useCustomerStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview') // overview | khata | advance
  const [khataLedger, setKhataLedger] = useState([])
  const [advLedger, setAdvLedger] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customer) { navigate('/my-bethak'); return }
    async function fetch() {
      const [kRes, aRes, oRes] = await Promise.all([
        supabase.from('khata_ledger').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('advance_ledger').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('orders').select('*, order_items(quantity, unit_price, items(name)), order_payments(mode, amount)').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20),
      ])
      setKhataLedger(kRes.data || [])
      setAdvLedger(aRes.data || [])
      setOrders(oRes.data || [])
      setLoading(false)
    }
    fetch()
  }, [customer])

  const khataBalance = khataLedger.reduce((s, l) => l.type === 'CREDIT' ? s + Number(l.amount) : s - Number(l.amount), 0)
  const advBalance = advLedger.reduce((s, l) => l.type === 'TOPUP' ? s + Number(l.amount) : s - Number(l.amount), 0)

  if (!customer) return null

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', fontWeight: 900, lineHeight: 1 }}>BOMBAY BETHAK</p>
          <p style={{ ...S.label, marginTop: '0.2rem' }}>My Bethak</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/games" style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Gamepad2 size={14} /> Games
          </Link>
          <button onClick={() => { logout(); navigate('/my-bethak') }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '0.4rem 0.8rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </div>

      <div style={S.container}>
        {/* Profile strip */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '52px', height: '52px', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 900, flexShrink: 0 }}>
            {customer.name[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{customer.name}</p>
            <p style={{ ...S.label, marginTop: '0.1rem' }}>@{customer.username} · {customer.mobile_number}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 900 }}>🪙 {customer.ghoda_coins || 0}</p>
            <p style={{ ...S.label }}>GHODA</p>
          </div>
        </motion.div>

        {/* Balance Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Your Devaa (you owe)', value: `₹${khataBalance.toLocaleString('en-IN')}`, color: khataBalance > 0 ? '#ef4444' : 'white', note: khataBalance > 0 ? 'Outstanding khata' : 'All clear' },
            { label: 'Advance Balance', value: `₹${advBalance.toLocaleString('en-IN')}`, color: '#22c55e', note: 'Pre-paid balance' },
          ].map((b, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              style={{ ...S.card, marginBottom: 0 }}>
              <p style={{ ...S.label, marginBottom: '0.5rem' }}>{b.label}</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: b.color, lineHeight: 1 }}>{b.value}</p>
              <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.3rem' }}>{b.note}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '1.5rem' }}>
          {[['overview', 'Orders'], ['khata', 'Khata Ledger'], ['advance', 'Advance']].map(([t, l]) => (
            <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3].map(i => <div key={i} style={{ height: '64px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }} />)}
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <div>
                {orders.length === 0 ? <EmptyState text="No orders yet." /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {orders.map(o => (
                      <div key={o.id} style={{ ...S.card, marginBottom: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                          <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>#{o.order_number || o.id.slice(0,8).toUpperCase()}</p>
                          <p style={{ fontWeight: 900, fontSize: '1.1rem' }}>₹{o.total}</p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                          {(o.order_items || []).slice(0,4).map((oi, i) => (
                            <span key={i} style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '2px' }}>
                              {oi.items?.name} ×{oi.quantity}
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            {(o.order_payments || []).map((p, i) => (
                              <span key={i} style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem' }}>{p.mode}</span>
                            ))}
                          </div>
                          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'khata' && (
              <LedgerList entries={khataLedger} type="khata" />
            )}

            {tab === 'advance' && (
              <LedgerList entries={advLedger} type="advance" />
            )}
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '2rem', fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)' }}>
        ⚠️ Tobacco causes cancer. Smoking is injurious to health.
      </div>
    </div>
  )
}

function LedgerList({ entries, type }) {
  if (entries.length === 0) return <EmptyState text={`No ${type} history yet.`} />

  const isCredit = (l) => type === 'khata' ? l.type === 'CREDIT' : l.type === 'TOPUP'
  const label = (l) => {
    if (type === 'khata') return l.type === 'CREDIT' ? 'Goods taken on credit' : l.type === 'PAYMENT' ? 'Payment made' : 'Adjustment'
    return l.type === 'TOPUP' ? 'Advance added' : l.type === 'DEDUCTION' ? 'Used for purchase' : 'Refunded'
  }

  // Running balance
  let bal = 0
  const withBal = [...entries].reverse().map(l => {
    if (type === 'khata') bal = l.type === 'CREDIT' ? bal + Number(l.amount) : bal - Number(l.amount)
    else bal = l.type === 'TOPUP' ? bal + Number(l.amount) : bal - Number(l.amount)
    return { ...l, runningBal: bal }
  }).reverse()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {withBal.map(l => (
        <div key={l.id} style={{ border: '1px solid rgba(255,255,255,0.07)', padding: '0.9rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div style={{ color: isCredit(l) ? '#ef4444' : '#22c55e', marginTop: '2px', flexShrink: 0 }}>
            {isCredit(l) ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{label(l)}</p>
              <p style={{ fontWeight: 900, fontSize: '0.95rem', color: isCredit(l) ? '#ef4444' : '#22c55e' }}>
                {isCredit(l) ? '+' : '-'}₹{l.amount}
              </p>
            </div>
            {l.reason && <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.reason}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
              <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>{new Date(l.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>Bal: ₹{l.runningBal.toFixed(0)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ text }) {
  return <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem' }}>{text}</div>
}
