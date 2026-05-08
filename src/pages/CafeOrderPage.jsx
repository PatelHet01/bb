import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { WheelGame, SlotsGame, OXOGame } from '../components/games/GameComponents'
import { ShoppingCart, Plus, Minus, Trash2, ChevronUp, User, X } from 'lucide-react'

export default function CafeOrderPage() {
  const [params] = useSearchParams()
  const token = params.get('table')

  const [tableInfo, setTableInfo] = useState(null)
  const [tokenError, setTokenError] = useState(false)
  const [items, setItems] = useState([])
  const [activeTab, setActiveTab] = useState('')
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orderPlaced, setOrderPlaced] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [activeGame, setActiveGame] = useState(null)
  const [coins, setCoins] = useState(0)

  // CRM state
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [custForm, setCustForm] = useState({ name: '', mobile: '', email: '' })
  const [custLookup, setCustLookup] = useState(null) // found existing customer
  const [lookingUp, setLookingUp] = useState(false)
  const [custConfirmed, setCustConfirmed] = useState(null) // final linked customer

  const categories = [...new Set(items.map(i => i.subcategory))].sort()
  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  useEffect(() => {
    if (categories.length > 0 && !activeTab) setActiveTab(categories[0])
  }, [categories, activeTab])

  useEffect(() => {
    if (!token) { setTokenError(true); setLoading(false); return }
    async function init() {
      const { data: tbl } = await supabase.from('cafe_tables').select('*, branches(name)').eq('qr_token', token).single()
      if (!tbl) { setTokenError(true); setLoading(false); return }
      setTableInfo(tbl)
      const { data: menuItems } = await supabase.from('items').select('*')
        .eq('branch_id', tbl.branch_id).eq('category', 'BB Cafe')
        .eq('is_active', true).eq('is_archived', false)
        .order('subcategory').order('name')
      setItems(menuItems || [])
      setLoading(false)
    }
    init()
  }, [token])

  function addToCart(item) {
    setCart(p => {
      const ex = p.find(c => c.id === item.id)
      if (ex) return p.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...p, { ...item, quantity: 1 }]
    })
  }

  function removeFromCart(id) {
    setCart(p => {
      const ex = p.find(c => c.id === id)
      if (ex?.quantity === 1) return p.filter(c => c.id !== id)
      return p.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  // CRM: lookup by mobile
  async function lookupMobile(mobile) {
    if (mobile.length < 10) { setCustLookup(null); return }
    setLookingUp(true)
    const { data } = await supabase.from('customers').select('*').eq('mobile_number', mobile).maybeSingle()
    setCustLookup(data || null)
    if (data) setCustForm(f => ({ ...f, name: data.name, email: data.email || '' }))
    setLookingUp(false)
  }

  async function confirmCustomer() {
    const mobile = custForm.mobile.trim()
    if (!mobile || mobile.length < 10) return alert('Enter a valid 10-digit mobile number')
    if (!custForm.name.trim()) return alert('Name is required')

    let customer = custLookup
    if (!customer) {
      // Create new customer
      const { data: newCust, error } = await supabase.from('customers').insert({
        name: custForm.name.trim(),
        mobile_number: mobile,
        email: custForm.email.trim() || null,
        branch_id: tableInfo.branch_id,
        registration_type: 'self',
      }).select().single()
      if (error) return alert('Could not save details: ' + error.message)
      customer = newCust
    }
    setCustConfirmed(customer)
    setShowCustomerForm(false)
    // Immediately place order
    placeOrder(customer)
  }

  async function placeOrder(customerOverride) {
    if (cart.length === 0) return
    setPlacing(true)
    const customer = customerOverride || custConfirmed

    const { data: order, error } = await supabase.from('orders').insert({
      branch_id: tableInfo.branch_id,
      table_number: tableInfo.table_number,
      subtotal: total,
      total,
      status: 'new',
      customer_id: customer?.id || null,
    }).select().single()

    if (error || !order) { setPlacing(false); return alert('Failed to place order.') }
    await supabase.from('order_items').insert(cart.map(c => ({
      order_id: order.id, item_id: c.id, quantity: c.quantity, price: c.price, total: c.price * c.quantity,
    })))
    await supabase.from('cafe_tables').update({ status: 'occupied', current_order_id: order.id }).eq('id', tableInfo.id)
    setOrderPlaced(order)
    setCart([])
    setCartOpen(false)
    setPlacing(false)
  }

  function handleCheckout() {
    setCartOpen(false)
    setShowCustomerForm(true)
  }

  const filteredItems = items.filter(i => i.subcategory === activeTab)

  /* ─── Loading / Error ─── */
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'white', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>☕</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', letterSpacing: '0.2em' }}>LOADING MENU...</div>
      </div>
    </div>
  )

  if (tokenError) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ color: 'white', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>Invalid QR Code</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}>Ask staff for a valid QR.</p>
      </div>
    </div>
  )

  /* ─── Order Placed + Games ─── */
  if (orderPlaced) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '2rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
        </motion.div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900 }}>Order Placed!</h1>
        {custConfirmed && <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>Hi {custConfirmed.name} 👋</p>}
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Table {tableInfo.table_number} · {tableInfo.branches?.name}
        </p>
        <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.25rem', display: 'inline-block' }}>
          <div style={{ fontSize: '0.65rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.4)', marginBottom: '0.5rem' }}>ORDER ID</div>
          <div style={{ fontFamily: 'monospace', fontWeight: 900 }}>#{orderPlaced.id.slice(0, 8).toUpperCase()}</div>
        </div>
        <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Your order is being prepared 🎉</p>
      </div>
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <p style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', marginBottom: '1.5rem' }}>Kill time while you wait 🎮</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[{ key: 'wheel', icon: '🎡', label: 'Spin Wheel' }, { key: 'slots', icon: '🎰', label: 'Slots' }, { key: 'oxo', icon: '⭕', label: 'O / X' }].map(g => (
            <button key={g.key} onClick={() => setActiveGame(activeGame === g.key ? null : g.key)}
              style={{ border: `1px solid ${activeGame === g.key ? 'white' : 'rgba(255,255,255,0.1)'}`, background: activeGame === g.key ? 'rgba(255,255,255,0.07)' : 'transparent', color: 'white', padding: '1rem 0.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>{g.icon}</div>{g.label}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          {activeGame === 'wheel' && <WheelGame key="wheel" coins={coins} setCoins={setCoins} onClose={() => setActiveGame(null)} />}
          {activeGame === 'slots' && <SlotsGame key="slots" coins={coins} setCoins={setCoins} onClose={() => setActiveGame(null)} />}
          {activeGame === 'oxo' && <OXOGame key="oxo" onClose={() => setActiveGame(null)} />}
        </AnimatePresence>
        {coins > 0 && (
          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
            🪙 {coins} GHODA earned · <Link to="/my-bethak" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline' }}>Sign up to save them!</Link>
          </p>
        )}
      </div>
    </div>
  )

  /* ─── Customer Form Modal ─── */
  const customerModal = showCustomerForm && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ color: 'white', fontWeight: 900, fontSize: '1.2rem' }}>Your Details</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', marginTop: '2px' }}>Quick save for rewards & order history</p>
          </div>
          <button onClick={() => { setShowCustomerForm(false); placeOrder(null) }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Mobile */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', display: 'block', marginBottom: '0.4rem' }}>MOBILE NUMBER *</label>
            <input
              type="tel" maxLength={10} value={custForm.mobile}
              onChange={e => { const v = e.target.value.replace(/\D/g, ''); setCustForm(f => ({ ...f, mobile: v })); if (v.length === 10) lookupMobile(v) }}
              placeholder="10-digit mobile"
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.75rem 1rem', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
            />
            {lookingUp && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '0.3rem' }}>Checking…</p>}
            {custLookup && <p style={{ color: '#4ade80', fontSize: '0.75rem', marginTop: '0.3rem' }}>✓ Welcome back, {custLookup.name}!</p>}
          </div>

          {/* Name */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', display: 'block', marginBottom: '0.4rem' }}>NAME *</label>
            <input
              type="text" value={custForm.name}
              onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Your name" readOnly={!!custLookup}
              style={{ width: '100%', background: custLookup ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.75rem 1rem', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Email optional */}
          {!custLookup && (
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', display: 'block', marginBottom: '0.4rem' }}>EMAIL <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></label>
              <input
                type="email" value={custForm.email}
                onChange={e => setCustForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.75rem 1rem', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <button onClick={confirmCustomer} disabled={placing}
            style={{ background: 'white', color: 'black', border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem' }}>
            {custLookup ? `Place Order as ${custLookup.name}` : 'Save & Place Order'}
          </button>

          <button onClick={() => { setShowCustomerForm(false); placeOrder(null) }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}>
            Skip, place order anonymously
          </button>
        </div>
      </motion.div>
    </div>
  )

  /* ─── Main Menu ─── */
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', fontFamily: 'Inter, sans-serif', paddingBottom: '100px' }}>
      {customerModal}

      {/* Header */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 40 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: '0.05em' }}>BB CAFE</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', letterSpacing: '0.2em', marginTop: '2px' }}>
            TABLE {tableInfo.table_number} · {tableInfo.branches?.name?.toUpperCase()}
          </div>
        </div>
        <button onClick={() => setCartOpen(!cartOpen)}
          style={{ background: cartCount > 0 ? 'white' : 'rgba(255,255,255,0.08)', border: 'none', color: cartCount > 0 ? 'black' : 'white', padding: '0.6rem 1rem', borderRadius: '50px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
          <ShoppingCart size={16} />
          {cartCount > 0 ? <span>{cartCount} · ₹{total}</span> : 'Cart'}
        </button>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem 1.5rem', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.06)', scrollbarWidth: 'none' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveTab(cat)}
            style={{ flexShrink: 0, padding: '0.5rem 1rem', borderRadius: '50px', border: `1px solid ${activeTab === cat ? 'white' : 'rgba(255,255,255,0.12)'}`, background: activeTab === cat ? 'white' : 'transparent', color: activeTab === cat ? 'black' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Items */}
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍽️</div>
            <p>No items in this category</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredItems.map(item => {
              const inCart = cart.find(c => c.id === item.id)
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.name}</div>
                    {item.variant && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginTop: '2px' }}>{item.variant}</div>}
                    <div style={{ marginTop: '0.4rem', fontWeight: 900, color: '#E67E22' }}>₹{item.price}</div>
                  </div>
                  {inCart ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.08)', borderRadius: '50px', padding: '0.35rem 0.75rem' }}>
                      <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}><Minus size={15} /></button>
                      <span style={{ fontWeight: 900, minWidth: '20px', textAlign: 'center' }}>{inCart.quantity}</span>
                      <button onClick={() => addToCart(item)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}><Plus size={15} /></button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item)}
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '0.5rem 1rem', borderRadius: '50px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                      ADD
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 48 }}
              onClick={() => setCartOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', borderTop: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px 20px 0 0', padding: '1.5rem', zIndex: 49, maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontWeight: 900, fontSize: '1.1rem' }}>Your Order</h2>
                <button onClick={() => setCartOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
              </div>
              {cart.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '2rem 0' }}>Cart is empty</p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {cart.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{item.name} {item.variant && <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>· {item.variant}</span>}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>₹{item.price} × {item.quantity}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 900 }}>₹{item.price * item.quantity}</span>
                          <button onClick={() => setCart(p => p.filter(c => c.id !== item.id))}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.1rem' }}>
                      <span>Total</span><span>₹{total}</span>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.4rem' }}>Payment at counter or to staff</p>
                  </div>
                  <button onClick={handleCheckout} disabled={placing}
                    style={{ width: '100%', background: 'white', color: 'black', border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: 900, fontSize: '1rem', cursor: 'pointer' }}>
                    {placing ? 'Placing…' : `Checkout · ₹${total}`}
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Cart */}
      {cartCount > 0 && !cartOpen && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 45 }}>
          <button onClick={() => setCartOpen(true)}
            style={{ background: 'white', color: 'black', border: 'none', padding: '1rem 2rem', borderRadius: '50px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <ShoppingCart size={18} />{cartCount} items · ₹{total}<ChevronUp size={18} />
          </button>
        </motion.div>
      )}
    </div>
  )
}
