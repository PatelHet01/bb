import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCustomerStore } from '../store/customerStore'
import { motion } from 'framer-motion'
import { LogOut, Gamepad2, Key } from 'lucide-react'
import toast from 'react-hot-toast'
import { computeNetBalance, buildUnifiedLedger, computeRunningBalances } from '../utils/khata'

const S = {
  page: { background: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: 'white' },
  header: { padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  container: { maxWidth: '600px', margin: '0 auto', padding: '1.5rem' },
  card: { border: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem', marginBottom: '1rem' },
  label: { fontSize: '0.6rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' },
  tab: (active) => ({
    padding: '0.75rem 1.25rem', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', border: 'none', background: 'none', color: active ? 'white' : 'rgba(255,255,255,0.3)', borderBottom: active ? '2px solid white' : '2px solid transparent', transition: 'all 0.2s',
  }),
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem'
  },
  modalContent: {
    width: '100%',
    maxWidth: '400px',
    background: '#0a0a0a',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '2.5rem',
    position: 'relative'
  },
  input: {
    width: '100%',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'white',
    padding: '0.85rem 1rem',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '1rem'
  },
  btn: {
    width: '100%',
    background: 'white',
    color: 'black',
    border: 'none',
    padding: '1rem',
    fontWeight: 900,
    fontSize: '0.8rem',
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    marginTop: '0.5rem'
  },
  btnSecondary: {
    width: '100%',
    background: 'transparent',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '1rem',
    fontWeight: 900,
    fontSize: '0.8rem',
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    marginTop: '0.5rem'
  }
}

export default function MyBethakDashboard() {
  const { customer, logout } = useCustomerStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview') // overview | khata
  const [khataLedger, setKhataLedger] = useState([])
  const [advLedger, setAdvLedger] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Password reset state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  useEffect(() => {
    if (!customer) { navigate('/my-bethak'); return }
    async function fetch() {
      const [kRes, aRes, oRes] = await Promise.all([
        // NO .limit() — must read ALL rows for correct balance
        supabase.from('khata_ledger').select('*, orders(order_number, order_items(quantity, price, items(name, variant)))').eq('customer_id', customer.id).order('created_at', { ascending: false }),
        supabase.from('advance_ledger').select('*, orders(order_number, order_items(quantity, price, items(name, variant)))').eq('customer_id', customer.id).order('created_at', { ascending: false }),
        supabase.from('orders').select('*, order_items(quantity, price, items(name, variant)), order_payments(mode, amount)').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(20),
      ])
      setKhataLedger(kRes.data || [])
      setAdvLedger(aRes.data || [])
      setOrders(oRes.data || [])
      setLoading(false)
    }
    fetch()
  }, [customer])

  async function handleAvatarUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const img = new Image()
        img.onload = async () => {
          const canvas = document.createElement('canvas')
          const MAX_SIZE = 150
          let width = img.width
          let height = img.height
          if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
          else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          const base64Avatar = canvas.toDataURL('image/jpeg', 0.8)
          
          const { error } = await supabase.from('customers').update({ avatar_url: base64Avatar }).eq('id', customer.id)
          if (error) throw error
          
          useCustomerStore.getState().setCustomer({ ...customer, avatar_url: base64Avatar })
          toast.success('Profile picture updated!')
          setUploadingAvatar(false)
        }
        img.src = event.target.result
      }
      reader.readAsDataURL(file)
    } catch (err) {
      toast.error('Failed to update picture: ' + err.message)
      setUploadingAvatar(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPassword.length < 4) {
      toast.error('New password must be at least 4 characters long')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    setPasswordLoading(true)
    try {
      const { data: freshCust, error: fetchErr } = await supabase.from('customers').select('password_hash').eq('id', customer.id).single()
      if (fetchErr || !freshCust) {
        toast.error('Customer not found')
        return
      }

      if (freshCust.password_hash && freshCust.password_hash !== currentPassword) {
        toast.error('Incorrect current password')
        return
      }

      const { error: updateErr } = await supabase.from('customers').update({
        password_hash: newPassword,
        is_temp_password: false
      }).eq('id', customer.id)

      if (updateErr) throw updateErr

      toast.success('Password changed successfully!')
      setShowPasswordModal(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      useCustomerStore.getState().setCustomer({ ...customer, password_hash: newPassword, is_temp_password: false })
    } catch (err) {
      toast.error('Failed to change password: ' + err.message)
    } finally {
      setPasswordLoading(false)
    }
  }

  // Unified net balance — single source of truth
  const net = computeNetBalance(khataLedger, advLedger)
  const owes = net > 0   // customer owes shop
  const jama = net < 0   // shop owes customer (advance/jama)
  const absNet = Math.abs(net)

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
          <button onClick={() => { setConfirmPassword(''); setNewPassword(''); setCurrentPassword(''); setShowPasswordModal(true); }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '0.4rem 0.8rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Key size={12} /> Security
          </button>
          <button onClick={() => { logout(); navigate('/my-bethak') }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '0.4rem 0.8rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </div>

      <div style={S.container}>
        {/* Profile strip */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <label style={{ cursor: 'pointer', position: 'relative' }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            <div style={{ width: '52px', height: '52px', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 900, flexShrink: 0, overflow: 'hidden', opacity: uploadingAvatar ? 0.5 : 1 }}>
              {customer.avatar_url ? (
                <img src={customer.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                customer.name[0].toUpperCase()
              )}
            </div>
            {uploadingAvatar && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '0.7rem' }}>...</div>}
          </label>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{customer.name}</p>
            <p style={{ ...S.label, marginTop: '0.1rem' }}>@{customer.username} · {customer.mobile_number}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 900 }}>🪙 {customer.ghoda_coins || 0}</p>
            <p style={{ ...S.label }}>GHODA</p>
          </div>
        </motion.div>

        {/* Unified Balance Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          style={{ ...S.card, marginBottom: '1.5rem', borderColor: owes ? 'rgba(239,68,68,0.4)' : jama ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)' }}>
          <p style={{ ...S.label, marginBottom: '0.5rem' }}>Khata Balance</p>
          {net === 0 ? (
            <>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>✅ All Clear</p>
              <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.3rem' }}>No outstanding balance</p>
            </>
          ) : owes ? (
            <>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ef4444', lineHeight: 1 }}>- ₹{absNet.toLocaleString('en-IN')}</p>
              <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.3rem' }}>You owe this amount to the shop</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>+ ₹{absNet.toLocaleString('en-IN')}</p>
              <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.3rem' }}>Jama — shop owes you this amount</p>
            </>
          )}
        </motion.div>

        {/* Credit Limit Status */}
        {customer?.khata_limit != null && (() => {
          const limit = Number(customer.khata_limit)
          const unlockPct = Number(customer.khata_unlock_percent || 30)
          const unlockThr = limit * (1 - unlockPct / 100)
          const locked = customer.is_khata_locked
          const usedPct = limit > 0 ? Math.min(100, (Math.max(0, net) / limit) * 100) : 0
          return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{
                ...S.card,
                marginBottom: '1.5rem',
                border: locked ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                background: locked ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p style={{ ...S.label }}>Credit Limit (Khata)</p>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, letterSpacing: '0.05em',
                  background: locked ? '#ef4444' : '#22c55e', color: 'white', textTransform: 'uppercase'
                }}>{locked ? '🔒 LOCKED' : '🔓 Active'}</span>
              </div>
              {/* Progress bar */}
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 99, height: 8, marginBottom: '0.75rem', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, transition: 'width 0.6s ease',
                  width: `${usedPct}%`,
                  background: locked ? '#ef4444' : usedPct > 80 ? '#f59e0b' : '#22c55e'
                }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {[
                  { l: 'Limit', v: `₹${limit.toLocaleString('en-IN')}` },
                  { l: 'Outstanding', v: owes ? `₹${absNet.toLocaleString('en-IN')}` : '₹0', c: owes ? '#ef4444' : '#22c55e' },
                  { l: 'Unlock at ≤', v: `₹${unlockThr.toLocaleString('en-IN')}` }
                ].map(({ l, v, c }) => (
                  <div key={l}>
                    <p style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{l}</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 900, color: c || 'white' }}>{v}</p>
                  </div>
                ))}
              </div>
              {locked && (
                <p style={{ fontSize: '0.65rem', color: '#fca5a5', marginTop: '0.75rem', lineHeight: 1.5 }}>
                  ⚠️ Your khata credit is paused. Pay down to ₹{unlockThr.toLocaleString('en-IN')} to resume credit ordering.
                </p>
              )}
            </motion.div>
          )
        })()}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '1.5rem' }}>
          {[['overview', 'Orders'], ['khata', 'Khata']].map(([t, l]) => (
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
              <UnifiedLedgerList khataRows={khataLedger} advRows={advLedger} />
            )}
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '2rem', fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)' }}>
        ⚠️ Tobacco causes cancer. Smoking is injurious to health.
      </div>

      {showPasswordModal && (
        <div style={S.modalOverlay}>
          <div style={S.modalContent}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', color: 'white', marginBottom: '0.5rem', fontWeight: 700 }}>Change Password</p>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1.5rem' }}>Update your security credentials for My Bethak.</p>
            
            <form onSubmit={handleChangePassword}>
              {customer.password_hash && (
                <div>
                  <label style={S.label}>Current Password</label>
                  <input 
                    style={S.input} 
                    type="password" required 
                    value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} 
                    placeholder="••••••••"
                  />
                </div>
              )}
              
              <div>
                <label style={S.label}>New Password</label>
                <input 
                  style={S.input} 
                  type="password" required 
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} 
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label style={S.label}>Confirm New Password</label>
                <input 
                  style={S.input} 
                  type="password" required 
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} 
                  placeholder="••••••••"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" style={S.btn} disabled={passwordLoading}>
                  {passwordLoading ? 'Updating...' : 'Save Password'}
                </button>
                <button type="button" style={S.btnSecondary} onClick={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UnifiedLedgerList({ khataRows, advRows }) {
  if (khataRows.length === 0 && advRows.length === 0)
    return <EmptyState text="No khata history yet." />

  const unified = computeRunningBalances(buildUnifiedLedger(khataRows, advRows))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {unified.map(l => {
        const colorHex = l._color === 'green' ? '#22c55e' : '#ef4444'
        // Customer-friendly labels
        let userLabel = l._label
        if (l._source === 'khata') {
          userLabel = l.type === 'CREDIT' ? 'Khata Used (You Owe)' : 'You Paid'
        } else {
          userLabel = l.type === 'TOPUP' ? 'Jama / Advance (You Pre-Paid)' : 'Advance Used for Bill'
        }

        return (
          <div key={`${l._source}-${l.id}`} style={{ border: `1px solid ${l._color === 'green' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, padding: '0.9rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ color: colorHex, marginTop: '2px', flexShrink: 0, fontSize: '1.1rem', fontWeight: 900, minWidth: '1.5rem', textAlign: 'center' }}>
              {l._prefix}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{userLabel}</p>
                <p style={{ fontWeight: 900, fontSize: '0.95rem', color: colorHex }}>
                  {l._prefix}₹{Number(l.amount).toLocaleString('en-IN')}
                </p>
              </div>

              {/* Order items */}
              {l.order_id && l.orders?.order_items && l.orders.order_items.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem', marginBottom: '0.2rem' }}>
                  {l.orders.order_items.map((oi, i) => (
                    <span key={i} style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.4rem', borderRadius: '3px' }}>
                      {oi.items?.name} {oi.items?.variant ? `(${oi.items.variant})` : ''} ×{oi.quantity}
                    </span>
                  ))}
                </div>
              )}

              {/* Reason */}
              {l.reason && (
                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.3rem', lineHeight: 1.3 }}>
                  {l.reason}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>
                  {new Date(l.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p style={{ fontSize: '0.65rem', color: l._runningBal > 0 ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)' }}>
                  Bal: {l._runningBal > 0 ? `-₹${l._runningBal.toFixed(0)}` : l._runningBal < 0 ? `+₹${Math.abs(l._runningBal).toFixed(0)}` : '✅ Clear'}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ text }) {
  return <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem' }}>{text}</div>
}
