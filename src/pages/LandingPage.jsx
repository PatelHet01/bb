import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import SmokeCanvas from '../components/landing/SmokeCanvas'
import RoadJourney from '../components/landing/RoadJourney'
import { useAuthStore } from '../store/authStore'

// All staff credentials — same source of truth as LoginPage
const STAFF_USERS = {
  superadmin: { password: 'Bethak@SuperAdmin#2025', role: 'super_admin', branchId: null,     branchName: 'All Branches' },
  gurukul:    { password: '1234567890',             role: 'admin',       branchId: 'gurukul', branchName: 'Gurukul' },
  bhat:       { password: '1234567890',             role: 'admin',       branchId: 'bhat',    branchName: 'Bhat' },
  visat:      { password: '1234567890',             role: 'admin',       branchId: 'visat',   branchName: 'Visat' },
  dev:        { password: 'DevAccess@2025',         role: 'developer',   branchId: null,      branchName: 'System' },
}

export default function LandingPage() {
  const [loaderDone, setLoaderDone] = useState(() => !!sessionStorage.getItem('bb-visited'))

  useEffect(() => {
    if (!loaderDone) {
      const t = setTimeout(() => {
        setLoaderDone(true)
        sessionStorage.setItem('bb-visited', '1')
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [])

  return (
    <div className="bg-black text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <AnimatePresence>{!loaderDone && <Loader key="loader" />}</AnimatePresence>

      {loaderDone && (
        <>
          <Hero />
          <StoryIntro />
          <RoadJourney />
          <WhatIsBB />
          <GhodaSection />
          <GamesSection />
          <SignupSection />
          <Footer />
        </>
      )}
    </div>
  )
}

/* ── LOADER ── */
function Loader() {
  const [step, setStep] = useState(0)
  const text = 'BOMBAY BETHAK'
  const [chars, setChars] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 500)
    const t2 = setTimeout(() => setStep(2), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (step < 2) return
    let i = 0
    const iv = setInterval(() => {
      i++
      setChars(i)
      if (i >= text.length) clearInterval(iv)
    }, 80)
    return () => clearInterval(iv)
  }, [step])

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
      className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center gap-8"
    >
      {/* SVG Paan Leaf draws itself */}
      <motion.svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <motion.path
          d="M40 10 C60 10, 75 25, 75 45 C75 65, 55 72, 40 70 C25 72, 5 65, 5 45 C5 25, 20 10, 40 10Z"
          stroke="white" strokeWidth="2" fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.3, ease: 'easeInOut' }}
        />
        <motion.path
          d="M40 10 Q50 40, 40 70 M40 10 Q30 40, 40 70"
          stroke="white" strokeWidth="1" strokeOpacity="0.5" fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 1, ease: 'easeInOut' }}
        />
      </motion.svg>

      <div style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.3em', fontSize: '1.5rem', fontWeight: 900 }}>
        {text.slice(0, chars)}
        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>|</motion.span>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="w-48 h-[1px] bg-white/10 overflow-hidden"
      >
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '0%' }}
          transition={{ delay: 1.6, duration: 1.4, ease: 'easeInOut' }}
          className="w-full h-full bg-white"
        />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ delay: 1.8, duration: 1.5, repeat: Infinity }}
        style={{ fontSize: '0.6rem', letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}
      >
        Initializing Sanctuary
      </motion.p>
    </motion.div>
  )
}

/* ── HERO ── */
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black">
      <SmokeCanvas />

      {/* Top right nav */}
      <div className="absolute top-6 right-6 z-20 flex gap-3">
        <Link to="/my-bethak"
          className="px-5 py-2 border border-white/40 text-white text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all rounded-full">
          My Bethak
        </Link>
        <Link to="/games"
          className="px-5 py-2 border border-white/40 text-white text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all rounded-full">
          Games
        </Link>
      </div>

      {/* Center brand */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-center z-10 px-6"
      >
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(3rem, 12vw, 10rem)',
          fontWeight: 900,
          lineHeight: 0.85,
          letterSpacing: '-0.02em',
          color: 'white',
        }}>
          BOMBAY<br />BETHAK
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          style={{ marginTop: '2rem', fontSize: '1rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}
        >
          The street remembers everyone.
        </motion.p>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
      >
        <span style={{ fontSize: '0.55rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Scroll</span>
        <motion.div
          animate={{ scaleY: [1, 1.6, 1], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-px h-12 bg-white"
        />
      </motion.div>
    </section>
  )
}

/* ── STORY INTRO ── */
function StoryIntro() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 bg-black">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 1 }}
        className="text-center max-w-2xl"
      >
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.5rem, 5vw, 3rem)', fontWeight: 700, lineHeight: 1.3, color: 'white', marginBottom: '2rem' }}>
          It started with one shop.<br />One corner. One idea.
        </p>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 1 }}
          style={{ fontSize: '1rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}
        >
          This is the story of Bombay Bethak.
        </motion.p>
      </motion.div>
    </section>
  )
}

/* ── WHAT IS BB ── */
function WhatIsBB() {
  const items = [
    { title: 'Paan Parlour', sub: 'The classic. The original.' },
    { title: 'Smoke Lounge', sub: 'Every kind. Every price.' },
    { title: 'BB Cafe', sub: 'Chai, snacks, and a seat that stays.' },
  ]
  return (
    <section className="min-h-screen flex items-center px-8 md:px-20 py-24 bg-black">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2.5rem, 7vw, 5rem)', fontWeight: 900, lineHeight: 1, color: 'white' }}>
            Three Shops.<br />One Soul.
          </p>
        </motion.div>
        <div className="space-y-10 pt-2">
          {items.map((item, i) => (
            <motion.div key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, duration: 0.8 }}
            >
              <div className="w-8 h-px bg-white/20 mb-3" />
              <p style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'white', marginBottom: '0.4rem' }}>{item.title}</p>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em' }}>{item.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── GHODA ── */
function GhodaSection() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24 bg-black border-t border-white/5">
      <div className="max-w-3xl mx-auto text-center">
        {/* Horse SVG */}
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-12"
        >
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <motion.path
              d="M30 90 C30 70, 40 60, 55 55 C50 45, 52 35, 60 30 C65 25, 72 28, 75 35 C82 30, 88 35, 85 45 C92 48, 95 58, 90 68 C95 72, 95 82, 88 86 C88 86, 80 90, 72 88 C68 95, 56 98, 48 93 C40 97, 30 95, 30 90Z M55 55 C58 52, 63 50, 68 52 M75 35 C78 32, 82 30, 85 32"
              stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2.5, ease: 'easeInOut' }}
            />
            <motion.circle cx="68" cy="38" r="3" fill="white"
              initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 1.5 }}
            />
          </svg>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 6vw, 4rem)', fontWeight: 900, color: 'white', marginBottom: '1.5rem', lineHeight: 1 }}>
            Earn GHODA.<br />Spend GHODA.
          </h2>
          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', maxWidth: '500px', margin: '0 auto 2.5rem', lineHeight: 1.8 }}>
            Every purchase earns you GHODA coins. Redeem them, bet them, or climb the leaderboard. Your loyalty, rewarded your way.
          </p>
          <Link to="/my-bethak"
            className="inline-block px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-sm hover:bg-zinc-200 transition-colors"
            style={{ letterSpacing: '0.2em' }}>
            Join My Bethak
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

/* ── GAMES ── */
function GamesSection() {
  const games = [
    { icon: '🎡', label: 'Spin the Wheel' },
    { icon: '🎰', label: 'Slots' },
    { icon: '⭕', label: 'O / X' },
  ]
  return (
    <section className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-24 bg-black border-t border-white/5">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 6vw, 4rem)', fontWeight: 900, color: 'white', marginBottom: '1rem', lineHeight: 1 }}>
            Kill Time. Win GHODA.
          </h2>
          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.45)', marginBottom: '3rem' }}>
            Play while you wait. Spin the wheel. Roll the slots. Challenge a friend.
          </p>
        </motion.div>

        <div className="flex gap-8 justify-center flex-wrap mb-10">
          {games.map((g, i) => (
            <motion.div key={g.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.8 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-20 h-20 border border-white/20 flex items-center justify-center text-3xl hover:border-white/60 transition-all hover:scale-110">
                {g.icon}
              </div>
              <p style={{ fontSize: '0.65rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{g.label}</p>
            </motion.div>
          ))}
        </div>

        <Link to="/games"
          className="inline-block px-10 py-4 border border-white text-white font-black uppercase tracking-widest text-sm hover:bg-white hover:text-black transition-all"
          style={{ letterSpacing: '0.2em' }}>
          Play Now
        </Link>
        <p style={{ marginTop: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}>
          Sign up to save your coins and climb the leaderboard.
        </p>
      </div>
    </section>
  )
}

/* ── SIGNUP ── */
function SignupSection() {
  const [form, setForm] = useState({ name: '', username: '', mobile: '', dob: '' })
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (form.mobile.length !== 10) { alert('Enter a valid 10-digit mobile number'); return }
    setSubmitted(true)
  }

  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24 bg-black border-t border-white/5">
      <div className="max-w-xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, color: 'white', marginBottom: '0.75rem', lineHeight: 1 }}>
            Make it Your Bethak.
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.4)', marginBottom: '2.5rem', lineHeight: 1.7 }}>
            Join to track your Khata, earn GHODA, and never lose your streak.
          </p>
        </motion.div>

        {submitted ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
            <p style={{ fontSize: '2rem' }}>🎉</p>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.5rem', color: 'white', marginTop: '1rem' }}>Welcome to Bombay Bethak.</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Check your mobile for verification.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Your name' },
              { label: 'Bethak Username', key: 'username', type: 'text', placeholder: 'unique handle (e.g. rahul_g)' },
              { label: 'Mobile Number', key: 'mobile', type: 'tel', placeholder: '10-digit number' },
              { label: 'Date of Birth', key: 'dob', type: 'date', placeholder: '' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  required
                  maxLength={field.key === 'mobile' ? 10 : undefined}
                  value={form[field.key]}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  style={{
                    width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white', padding: '0.9rem 1rem', fontSize: '0.95rem', outline: 'none',
                    transition: 'border-color 0.2s',
                    colorScheme: 'dark',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                />
              </div>
            ))}
            <button type="submit" style={{
              width: '100%', background: 'white', color: 'black', border: 'none', padding: '1rem',
              fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.25em', textTransform: 'uppercase',
              cursor: 'pointer', marginTop: '0.5rem', transition: 'background 0.2s',
            }}
              onMouseEnter={e => e.target.style.background = '#e5e5e5'}
              onMouseLeave={e => e.target.style.background = 'white'}
            >
              Join Bombay Bethak
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.75rem' }}>
              Already registered?{' '}
              <Link to="/my-bethak" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline' }}>Enter My Bethak</Link>
            </p>
          </form>
        )}
      </div>
    </section>
  )
}

/* ── FOOTER ── */
function Footer() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [username, setUsername] = useState('')
  const [open, setOpen] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)

  // Toggle visibility: click the © symbol 3 times
  const [clickCount, setClickCount] = useState(0)
  function handleCopyrightClick() {
    const next = clickCount + 1
    setClickCount(next)
    if (next >= 3) { setOpen(true); setClickCount(0); setTimeout(() => inputRef.current?.focus(), 100) }
  }

  function handleAccess(e) {
    e.preventDefault()
    const u = username.trim().toLowerCase()
    const record = STAFF_USERS[u]
    if (record && record.password === pw) {
      setAuth({ username: u }, record.role, record.branchId, record.branchName)
      navigate('/admin/dashboard', { replace: true })
    } else {
      setShake(true)
      setPw('')
      setTimeout(() => setShake(false), 600)
    }
  }

  return (
    <footer className="bg-black border-t border-white/10 px-8 md:px-20 py-16">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
        <div>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '2.5rem', fontWeight: 900, color: 'white', marginBottom: '2rem', lineHeight: 1 }}>
            BOMBAY<br />BETHAK
          </h3>
          <div className="space-y-3" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
            <div><span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Gurukul</span><br />Gurukul Road, Ahmedabad</div>
            <div><span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Bhat</span><br />Bhat, Gandhinagar Highway</div>
            <div><span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Visat</span><br />Visat, Ahmedabad</div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Links</p>
          {['My Bethak', 'Games'].map(l => (
            <Link key={l} to={`/${l.toLowerCase().replace(' ', '-')}`}
              style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', letterSpacing: '0.1em', fontWeight: 600 }}
              onMouseEnter={e => e.target.style.color = 'white'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.5)'}
            >{l}</Link>
          ))}
        </div>
      </div>

      {/* Hidden Staff Access Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: '2rem' }}
          >
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2rem' }}>
              <motion.form
                onSubmit={handleAccess}
                animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
                transition={{ duration: 0.5 }}
                style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', maxWidth: '480px' }}
              >
                <input
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="off"
                  style={{
                    flex: '1 1 140px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)', padding: '0.6rem 0.9rem', fontSize: '0.8rem',
                    outline: 'none', letterSpacing: '0.05em', minWidth: '120px'
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.35)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <input
                  ref={inputRef}
                  type="password"
                  placeholder="••••••••••"
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  autoComplete="current-password"
                  style={{
                    flex: '1 1 140px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)', padding: '0.6rem 0.9rem', fontSize: '0.8rem',
                    outline: 'none', letterSpacing: '0.15em', minWidth: '120px'
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.35)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button type="submit" style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)',
                  padding: '0.6rem 1.2rem', fontSize: '0.7rem', cursor: 'pointer', letterSpacing: '0.2em',
                  textTransform: 'uppercase', transition: 'all 0.2s', whiteSpace: 'nowrap'
                }}
                  onMouseEnter={e => { e.target.style.background = 'white'; e.target.style.color = 'black' }}
                  onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'rgba(255,255,255,0.4)' }}
                >
                  Enter
                </button>
                <button type="button" onClick={() => { setOpen(false); setPw(''); setUsername('') }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '1rem', padding: '0.4rem' }}>×</button>
              </motion.form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between gap-4" style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>
        <span
          onClick={handleCopyrightClick}
          style={{ cursor: 'default', userSelect: 'none' }}
          title=""
        >© Bombay Bethak</span>
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>⚠️ Tobacco causes cancer. Smoking is injurious to health.</span>
      </div>
    </footer>
  )
}
