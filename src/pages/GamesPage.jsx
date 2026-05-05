import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useCustomerStore } from '../store/customerStore'
import { motion, AnimatePresence } from 'framer-motion'

const S = {
  page: { background: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: 'white', overflowX: 'hidden' },
  header: { padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  container: { maxWidth: '700px', margin: '0 auto', padding: '1.5rem' },
}

export default function GamesPage() {
  const { customer } = useCustomerStore()
  const [activeGame, setActiveGame] = useState(null)
  const [coins, setCoins] = useState(customer?.ghoda_coins || 0)

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
          {activeGame === 'oxo' && <OXOGame key="oxo" coins={coins} setCoins={setCoins} onClose={() => setActiveGame(null)} />}
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
      onClick={onPlay} whileHover={{ borderColor: 'rgba(255,255,255,0.4)', y: -4 }} whileTap={{ scale: 0.97 }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.4rem' }}>{title}</p>
      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{desc}</p>
      <div style={{ marginTop: '1rem', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        {active ? '▶ Playing' : 'Play →'}
      </div>
    </motion.div>
  )
}

/* ── WHEEL GAME ── */
function WheelGame({ coins, setCoins, onClose }) {
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const [rotation, setRotation] = useState(0)
  const PRIZES = ['+5', '+10', '+0', '+20', '+2', '+50', '+0', '+15']
  const COLORS = ['#fff', '#ccc', '#555', '#fff', '#999', '#fff', '#444', '#ccc']

  function spin() {
    if (spinning) return
    setSpinning(true)
    setResult(null)
    const spins = 5 + Math.random() * 5
    const prizeIdx = Math.floor(Math.random() * PRIZES.length)
    const targetAngle = rotation + spins * 360 + (prizeIdx * (360 / PRIZES.length))
    setRotation(targetAngle)
    setTimeout(() => {
      const prize = parseInt(PRIZES[prizeIdx].replace('+', ''))
      setResult(prize)
      setCoins(c => c + prize)
      setSpinning(false)
    }, 3000)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
      style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.1em' }}>🎡 SPIN THE WHEEL</p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
      </div>

      {/* Wheel */}
      <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto 2rem' }}>
        <motion.div
          style={{ width: '220px', height: '220px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', position: 'relative', overflow: 'hidden' }}
          animate={{ rotate: rotation }}
          transition={{ duration: spinning ? 3 : 0, ease: [0.2, 1, 0.3, 1] }}
        >
          {PRIZES.map((p, i) => {
            const angle = (i * 360) / PRIZES.length
            return (
              <div key={i} style={{
                position: 'absolute', top: '50%', left: '50%', width: '110px', height: '2px',
                transformOrigin: '0 50%', transform: `rotate(${angle}deg)`,
                background: 'rgba(255,255,255,0.1)',
              }}>
                <span style={{ position: 'absolute', left: '55px', top: '-14px', fontSize: '0.7rem', fontWeight: 900, color: 'white', transform: `rotate(${90 + 360 / PRIZES.length / 2}deg)` }}>
                  {p}
                </span>
              </div>
            )
          })}
          {/* Center */}
          <div style={{ position: 'absolute', inset: '40%', background: 'black', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🪙</div>
        </motion.div>
        {/* Pointer */}
        <div style={{ position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '16px solid white' }} />
      </div>

      <AnimatePresence>
        {result !== null && (
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '2.5rem', fontWeight: 900 }}>{result > 0 ? `+${result} 🪙` : 'No luck!'}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>{result > 0 ? 'GHODA added to your wallet!' : 'Better luck next time'}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={spin} disabled={spinning}
        style={{ background: spinning ? 'rgba(255,255,255,0.1)' : 'white', color: spinning ? 'rgba(255,255,255,0.3)' : 'black', border: 'none', padding: '1rem 3rem', fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: spinning ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
        {spinning ? 'Spinning...' : 'SPIN'}
      </button>
    </motion.div>
  )
}

/* ── SLOTS GAME ── */
function SlotsGame({ coins, setCoins, onClose }) {
  const SYMBOLS = ['🐎', '🪙', '🔥', '⭐', '🎯', '🍀']
  const [reels, setReels] = useState(['🐎', '🐎', '🐎'])
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)

  function spin() {
    if (spinning) return
    setSpinning(true)
    setResult(null)
    const newReels = Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
    let count = 0
    const iv = setInterval(() => {
      setReels(Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]))
      count++
      if (count > 15) {
        clearInterval(iv)
        setReels(newReels)
        if (newReels[0] === newReels[1] && newReels[1] === newReels[2]) {
          const prize = newReels[0] === '🐎' ? 100 : 30
          setResult({ win: true, amount: prize })
          setCoins(c => c + prize)
        } else if (newReels[0] === newReels[1] || newReels[1] === newReels[2]) {
          setResult({ win: true, amount: 10 })
          setCoins(c => c + 10)
        } else {
          setResult({ win: false, amount: 0 })
        }
        setSpinning(false)
      }
    }, 80)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
      style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.1em' }}>🎰 GHODA SLOTS</p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
        {reels.map((r, i) => (
          <motion.div key={i}
            animate={spinning ? { y: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.3, repeat: spinning ? Infinity : 0 }}
            style={{ width: '80px', height: '80px', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', background: 'rgba(255,255,255,0.03)' }}>
            {r}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ marginBottom: '1.5rem' }}>
            {result.win ? (
              <>
                <p style={{ fontSize: '2rem', fontWeight: 900 }}>+{result.amount} 🪙</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>{result.amount === 100 ? 'JACKPOT! Triple GHODA!' : result.amount === 30 ? 'Triple! Nice!' : 'Pair! Not bad!'}</p>
              </>
            ) : (
              <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.4)' }}>No match. Try again!</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={spin} disabled={spinning}
        style={{ background: spinning ? 'rgba(255,255,255,0.1)' : 'white', color: spinning ? 'rgba(255,255,255,0.3)' : 'black', border: 'none', padding: '1rem 3rem', fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: spinning ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
        {spinning ? 'Spinning...' : 'PULL'}
      </button>
      <p style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>Triple GHODA 🐎 = 100 coins · Triple = 30 · Pair = 10</p>
    </motion.div>
  )
}

/* ── O/X GAME ── */
function OXOGame({ onClose }) {
  const [board, setBoard] = useState(Array(9).fill(null))
  const [turn, setTurn] = useState('X') // X = player, O = computer
  const [winner, setWinner] = useState(null)
  const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

  function checkWinner(b) {
    for (const [a,c,d] of WINS) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
    if (b.every(Boolean)) return 'draw'
    return null
  }

  function playerMove(i) {
    if (board[i] || winner || turn !== 'X') return
    const nb = [...board]; nb[i] = 'X'
    setBoard(nb)
    const w = checkWinner(nb)
    if (w) { setWinner(w); return }
    setTurn('O')
    setTimeout(() => {
      const empties = nb.map((v,i) => v ? null : i).filter(v => v !== null)
      if (empties.length === 0) return
      const pick = empties[Math.floor(Math.random() * empties.length)]
      const nb2 = [...nb]; nb2[pick] = 'O'
      setBoard(nb2)
      const w2 = checkWinner(nb2)
      if (w2) setWinner(w2)
      setTurn('X')
    }, 500)
  }

  function reset() { setBoard(Array(9).fill(null)); setTurn('X'); setWinner(null) }

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
      style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <p style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.1em' }}>⭕ NOUGHTS & CROSSES</p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1.5rem' }}>You are X · Computer is O</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 80px)', gap: '4px', justifyContent: 'center', marginBottom: '1.5rem' }}>
        {board.map((cell, i) => (
          <motion.button key={i} onClick={() => playerMove(i)}
            whileTap={{ scale: 0.92 }}
            style={{ width: '80px', height: '80px', border: '1px solid rgba(255,255,255,0.15)', background: cell ? 'rgba(255,255,255,0.03)' : 'transparent', fontSize: '2rem', cursor: cell || winner ? 'default' : 'pointer', fontWeight: 900, color: cell === 'X' ? 'white' : 'rgba(255,255,255,0.4)', transition: 'background 0.15s' }}
          >{cell}</motion.button>
        ))}
      </div>

      <AnimatePresence>
        {winner && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 900 }}>
              {winner === 'draw' ? "It's a draw!" : winner === 'X' ? '🎉 You win!' : '😅 Computer wins!'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={reset}
        style={{ background: 'white', color: 'black', border: 'none', padding: '0.75rem 2.5rem', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer' }}>
        {winner ? 'Play Again' : 'Reset'}
      </button>
    </motion.div>
  )
}
