import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import SmokeCanvas from '../components/landing/SmokeCanvas'
import RoadJourney from '../components/landing/RoadJourney'
import { useAuthStore } from '../store/authStore'
import { WheelGame, SlotsGame, OXOGame } from '../components/games/GameComponents'

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
      const t = setTimeout(() => { setLoaderDone(true); sessionStorage.setItem('bb-visited', '1') }, 3000)
      return () => clearTimeout(t)
    }
  }, [])

  return (
    <div className="bg-black text-white" style={{ fontFamily: 'var(--font-body)' }}>
      <AnimatePresence>{!loaderDone && <Loader key="loader" />}</AnimatePresence>
      {loaderDone && (
        <>
          <TopButtons />
          <main className="relative bg-black">
            <RoadJourney />
            <ThreeShops />
            <GhodaSection />
            <GamesSection />
            <SignupSection />
            <Footer />
          </main>
        </>
      )}
    </div>
  )
}

/* ── LOADER ── */
function Loader() {
  const [chars, setChars] = useState(0)
  const text = 'BOMBAY BETHAK'
  useEffect(() => {
    const t = setTimeout(() => {
      let i = 0
      const iv = setInterval(() => { i++; setChars(i); if (i >= text.length) clearInterval(iv) }, 90)
      return () => clearInterval(iv)
    }, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center gap-8">
      <motion.svg width="72" height="72" viewBox="0 0 80 80" fill="none">
        <motion.path d="M40 10 C60 10,75 25,75 45 C75 65,55 72,40 70 C25 72,5 65,5 45 C5 25,20 10,40 10Z"
          stroke="white" strokeWidth="2" fill="none"
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.2, ease: 'easeInOut' }} />
        <motion.path d="M40 10 Q50 40,40 70 M40 10 Q30 40,40 70" stroke="white" strokeWidth="1" strokeOpacity="0.4" fill="none"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1 }} />
      </motion.svg>
      <div className="font-display text-2xl tracking-[0.3em] font-bold">
        {text.slice(0, chars)}
        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.7 }}>|</motion.span>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
        className="w-40 h-px bg-white/10 overflow-hidden rounded-full">
        <motion.div initial={{ x: '-100%' }} animate={{ x: '0%' }} transition={{ delay: 1.6, duration: 1.4 }} className="w-full h-full bg-white" />
      </motion.div>
    </motion.div>
  )
}

/* ── TOP BUTTONS ── */
function TopButtons() {
  return (
    <div className="fixed top-4 right-4 z-40 flex gap-2 md:top-6 md:right-6">
      <Link to="/my-bethak" className="rounded-full border border-white/40 bg-black/60 backdrop-blur px-4 py-2 text-[10px] tracking-[0.25em] text-white hover:bg-white hover:text-black transition-all md:px-5 md:py-2.5 md:text-xs">
        MY BETHAK
      </Link>
      <Link to="/games" className="rounded-full border border-white/40 bg-black/60 backdrop-blur px-4 py-2 text-[10px] tracking-[0.25em] text-white hover:bg-white hover:text-black transition-all md:px-5 md:py-2.5 md:text-xs">
        GAMES
      </Link>
    </div>
  )
}

/* ── THREE SHOPS ── */
function ThreeShops() {
  const items = [
    { t: 'Paan Parlour', d: 'The classic. The original.' },
    { t: 'Smoke Lounge',  d: 'Every kind. Every price.' },
    { t: 'BB Cafe',       d: 'Chai, snacks, and a seat that stays.' },
  ]
  return (
    <section className="relative bg-black px-6 py-24 md:py-40">
      <div className="mx-auto grid max-w-6xl gap-12 md:gap-16 md:grid-cols-2 md:items-center">
        <h2 className="font-display text-5xl leading-[0.95] text-white md:text-7xl">
          Three Shops.<br /><span className="font-script text-ember text-6xl md:text-8xl">one soul.</span>
        </h2>
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it.t} className="rounded-3xl border border-white/15 bg-white/[0.02] px-6 py-5 transition hover:border-ember/60 hover:bg-white/[0.04]">
              <div className="font-display text-2xl text-white">{it.t}</div>
              <div className="mt-1 text-white/60">{it.d}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ── GHODA ── */
function GhodaSection() {
  return (
    <section className="relative bg-black px-6 py-32 text-center">
      <div className="mx-auto max-w-2xl">
        <div className="mx-auto mb-10 w-[200px] animate-breathe">
          <svg viewBox="0 0 240 200" className="w-full h-auto">
            <g stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M40 160 Q50 110 90 90 Q110 80 130 85 Q150 88 165 70 Q175 55 185 50 Q195 48 200 55 Q198 65 188 70 L195 85 Q205 95 200 110 L195 130 Q210 145 205 165" />
              <path d="M165 70 Q175 45 195 40 Q190 55 180 60" />
              <path d="M90 90 L80 160 M115 100 L120 160 M150 110 L155 160 M170 105 L175 160" />
              <circle cx="192" cy="58" r="1.5" fill="white" />
              <path d="M188 65 Q192 68 196 65" />
            </g>
          </svg>
        </div>
        <h2 className="font-display text-4xl text-white md:text-6xl leading-tight">
          Earn GHODA. <span className="font-script text-ember text-5xl md:text-7xl">spend ghoda.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-white/60 leading-relaxed">
          Every purchase earns you GHODA coins. Redeem them, bet them, or climb the leaderboard. Your loyalty, rewarded your way.
        </p>
        <Link to="/my-bethak" className="mt-10 inline-block rounded-full bg-ember px-8 py-3.5 font-display text-sm tracking-[0.25em] text-black hover:bg-white transition">
          JOIN MY BETHAK
        </Link>
      </div>
    </section>
  )
}

/* ── GAMES ── */
function GamesSection() {
  const [activeGame, setActiveGame] = useState(null)
  const [coins, setCoins] = useState(0)

  return (
    <section className="relative bg-black px-6 py-24 text-center">
      <h2 className="font-display text-4xl text-white md:text-6xl leading-tight">
        Kill Time. <span className="font-script text-ember text-5xl md:text-7xl">win ghoda.</span>
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-white/60">Play while you wait. Spin the wheel. Roll the slots. Challenge a friend to O/X.</p>

      {/* Game Selector Cards */}
      <div className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-3">
        {[
          { key: 'wheel', icon: '🎡', label: 'Spin Wheel' },
          { key: 'slots', icon: '🎰', label: 'GHODA Slots' },
          { key: 'oxo',   icon: '⭕', label: 'O / X' },
        ].map(g => (
          <button key={g.key} onClick={() => setActiveGame(activeGame === g.key ? null : g.key)}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer ${
              activeGame === g.key
                ? 'border-white bg-white/10 text-white'
                : 'border-white/15 bg-white/[0.02] text-white/60 hover:border-white/40 hover:text-white'
            }`}>
            <span style={{ fontSize: '2rem' }}>{g.icon}</span>
            <span style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>{g.label}</span>
          </button>
        ))}
      </div>

      {/* Inline Game */}
      <div className="mx-auto mt-4 max-w-lg">
        <AnimatePresence mode="wait">
          {activeGame === 'wheel' && <WheelGame key="wheel" coins={coins} setCoins={setCoins} onClose={() => setActiveGame(null)} />}
          {activeGame === 'slots' && <SlotsGame key="slots" coins={coins} setCoins={setCoins} onClose={() => setActiveGame(null)} />}
          {activeGame === 'oxo'   && <OXOGame   key="oxo"   onClose={() => setActiveGame(null)} />}
        </AnimatePresence>
      </div>

      {coins > 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-ember font-bold">
          🪙 {coins} GHODA earned!
        </motion.p>
      )}
      <p className="mt-4 text-[10px] tracking-[0.2em] text-white/30 uppercase">Sign up to save your coins · <Link to="/my-bethak" className="text-white/50 underline">Join My Bethak</Link></p>
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
    <section className="relative bg-black px-6 py-32">
      <div className="mx-auto max-w-3xl rounded-[2.5rem] border border-white/15 bg-white/[0.02] px-6 py-12 md:px-12 md:py-16 text-center">
        <h2 className="font-display text-4xl text-white md:text-6xl leading-tight">
          Make it <span className="font-script text-ember text-5xl md:text-7xl">your bethak.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-white/60">Join to track your Khata, earn GHODA, and never lose your streak.</p>
        {submitted ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-10 text-center">
            <p className="text-4xl">🎉</p>
            <p className="font-display text-xl text-white mt-4">Welcome to Bombay Bethak.</p>
            <p className="text-white/40 mt-2 text-sm">Check your mobile for verification.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-4 text-left">
            {[
              { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Your name' },
              { label: 'Bethak Username', key: 'username', type: 'text', placeholder: 'your handle e.g. rahul_g' },
              { label: 'Mobile Number', key: 'mobile', type: 'tel', placeholder: '10-digit number' },
              { label: 'Date of Birth', key: 'dob', type: 'date', placeholder: '' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{field.label}</label>
                <input type={field.type} placeholder={field.placeholder} required maxLength={field.key === 'mobile' ? 10 : undefined}
                  value={form[field.key]} onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  className="w-full rounded-2xl bg-white/5 border border-white/15 text-white px-4 py-3 text-sm outline-none focus:border-white/40 transition placeholder:text-white/25"
                  style={{ colorScheme: 'dark' }} />
              </div>
            ))}
            <button type="submit" className="mt-2 w-full rounded-full bg-white text-black font-display font-bold py-4 tracking-[0.2em] text-sm uppercase hover:bg-zinc-200 transition">
              Join Bombay Bethak
            </button>
            <p className="text-center text-sm text-white/30 mt-3">
              Already registered?{' '}
              <Link to="/my-bethak" className="text-white/60 underline">Enter My Bethak</Link>
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
  const [clickCount, setClickCount] = useState(0)
  const inputRef = useRef(null)

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
      setShake(true); setPw(''); setTimeout(() => setShake(false), 600)
    }
  }

  return (
    <footer className="relative bg-black px-6 pt-24 pb-6">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
        <div>
          <div className="font-display text-4xl tracking-[0.15em] text-white md:text-6xl">BOMBAY<br />BETHAK</div>
          <ul className="mt-10 space-y-4 text-sm text-white/60">
            <li><span className="text-white">Gurukul</span> — Near Gurukul Cross Road, Memnagar, Ahmedabad</li>
            <li><span className="text-white">Bhat</span> — Bhat Circle, Gandhinagar Road, Ahmedabad</li>
            <li><span className="text-white">Visat</span> — Visat Circle, Sabarmati, Ahmedabad</li>
          </ul>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <Link to="/my-bethak" className="text-xs tracking-[0.3em] uppercase text-white/70 hover:text-white transition">My Bethak</Link>
          <Link to="/games"     className="text-xs tracking-[0.3em] uppercase text-white/70 hover:text-white transition">Games</Link>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div className="mx-auto max-w-6xl mt-10 border-t border-white/10 pt-8">
              <motion.form onSubmit={handleAccess} animate={shake ? { x: [-8,8,-6,6,-4,4,0] } : {}} transition={{ duration: 0.5 }}
                className="flex gap-3 flex-wrap items-center max-w-md">
                <input type="text" placeholder="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="off"
                  className="flex-1 min-w-[120px] rounded-full bg-transparent border border-white/15 text-white/70 px-4 py-2 text-sm outline-none focus:border-white/40 transition" />
                <input ref={inputRef} type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password"
                  className="flex-1 min-w-[120px] rounded-full bg-transparent border border-white/15 text-white/70 px-4 py-2 text-sm outline-none focus:border-white/40 transition tracking-widest" />
                <button type="submit" className="rounded-full border border-white/20 text-white/40 px-5 py-2 text-xs tracking-widest uppercase hover:bg-white hover:text-black transition">Enter</button>
                <button type="button" onClick={() => { setOpen(false); setPw(''); setUsername('') }} className="text-white/20 hover:text-white/50 text-lg">×</button>
              </motion.form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto mt-16 max-w-6xl border-t border-white/15 pt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[11px] text-white/50">
        <div onClick={handleCopyrightClick} style={{ cursor: 'default', userSelect: 'none' }}>© Bombay Bethak</div>
        <div className="text-white/80">⚠ Tobacco causes cancer. Smoking is injurious to health.</div>
      </div>
    </footer>
  )
}
