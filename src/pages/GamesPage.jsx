import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomerStore } from '../store/customerStore'
import { motion, AnimatePresence } from 'framer-motion'
import { WheelGame, SlotsGame, OXOGame } from '../components/games/GameComponents'

export default function GamesPage() {
  const { customer } = useCustomerStore()
  const [activeGame, setActiveGame] = useState(null)
  const [coins, setCoins] = useState(customer?.ghoda_coins || 0)

  const S = {
    page: { background: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: 'white', overflowX: 'hidden' },
    header: { padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    container: { maxWidth: '700px', margin: '0 auto', padding: '1.5rem' },
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <Link to="/" style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', fontWeight: 900, color: 'white', textDecoration: 'none', lineHeight: 1 }}>BB</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {customer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(255,255,255,0.1)', padding: '0.35rem 0.8rem', fontSize: '0.8rem', fontWeight: 700 }}>
              🪙 {coins} GHODA
            </div>
          )}
          <Link to={customer ? '/my-bethak/dashboard' : '/my-bethak'}
            style={{ fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.75rem' }}>
            {customer ? 'My Bethak' : 'Sign In'}
          </Link>
        </div>
      </div>

      <div style={S.container}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '2.5rem', textAlign: 'center', paddingTop: '1rem' }}>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 7vw, 3.5rem)', fontWeight: 900, lineHeight: 1, marginBottom: '0.75rem' }}>Kill Time.<br />Win GHODA.</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Play while you wait. Every win earns you GHODA coins.</p>
          {!customer && <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>Sign up to save your coins and climb the leaderboard.</p>}
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <GameCard icon="🎡" title="Spin the Wheel" desc="Spin for coins, discounts, or mystery rewards" onPlay={() => setActiveGame('wheel')} active={activeGame === 'wheel'} />
          <GameCard icon="🎰" title="GHODA Slots" desc="Line up the horses. Triple GHODA = jackpot." onPlay={() => setActiveGame('slots')} active={activeGame === 'slots'} />
          <GameCard icon="⭕" title="Noughts & Crosses" desc="Challenge the house. Win double your bet." onPlay={() => setActiveGame('oxo')} active={activeGame === 'oxo'} />
        </div>

        <AnimatePresence mode="wait">
          {activeGame === 'wheel' && <WheelGame key="wheel" coins={coins} setCoins={setCoins} onClose={() => setActiveGame(null)} />}
          {activeGame === 'slots' && <SlotsGame key="slots" coins={coins} setCoins={setCoins} onClose={() => setActiveGame(null)} />}
          {activeGame === 'oxo' && <OXOGame key="oxo" onClose={() => setActiveGame(null)} />}
        </AnimatePresence>
      </div>

      <div style={{ textAlign: 'center', padding: '2rem', fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)' }}>
        ⚠️ Tobacco causes cancer. Smoking is injurious to health.
      </div>
    </div>
  )
}

function GameCard({ icon, title, desc, onPlay, active }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      style={{ border: `1px solid ${active ? 'white' : 'rgba(255,255,255,0.1)'}`, padding: '1.5rem', cursor: 'pointer', transition: 'all 0.2s', background: active ? 'rgba(255,255,255,0.05)' : 'transparent' }}
      onClick={onPlay} whileHover={{ borderColor: 'rgba(255,255,255,0.4)', y: -4 }} whileTap={{ scale: 0.97 }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.4rem' }}>{title}</p>
      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{desc}</p>
      <div style={{ marginTop: '1rem', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        {active ? '▶ Playing' : 'Play →'}
      </div>
    </motion.div>
  )
}
