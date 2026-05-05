import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const STOPS = [
  {
    id: 'gurukul',
    year: '2021',
    label: 'BOMBAY BETHAK — GURUKUL',
    line1: '2021. Gurukul, Ahmedabad.',
    line2: 'One small shop. Paan, smoke, and a place to sit. The first Bethak was born.',
    x: 25, // % of road width
  },
  {
    id: 'bhat',
    label: 'BOMBAY BETHAK CAFE — BHAT',
    line1: 'Bhat. The cafe chapter begins.',
    line2: 'Bombay Bethak grew. A cafe joined the story — BB Cafe. A new corner, a new crowd.',
    x: 55,
  },
  {
    id: 'visat',
    label: 'BOMBAY BETHAK — VISAT',
    line1: 'Visat. The third Bethak.',
    line2: 'Three corners. One story. Yours.',
    x: 85,
  },
]

export default function RoadJourney() {
  const sectionRef = useRef(null)
  const roadRef = useRef(null)
  const manRef = useRef(null)
  const [activeStop, setActiveStop] = useState(-1)
  const [journeyDone, setJourneyDone] = useState(false)
  const progressRef = useRef(0)

  useEffect(() => {
    const section = sectionRef.current
    const road = roadRef.current
    const man = manRef.current
    if (!section || !road || !man) return

    // Create a tall scroll space to drive the animation
    const totalScrollDist = window.innerHeight * 6

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: `+=${totalScrollDist}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress
            progressRef.current = p

            // Man walks from left to right
            const manX = 5 + p * 82 // % of road
            man.style.left = `${manX}%`

            // Walk cycle via rotation
            const bounce = Math.sin(p * 200) * 3
            man.style.transform = `translateX(-50%) rotate(${bounce}deg)`

            // Reveal stops
            STOPS.forEach((stop, i) => {
              const threshold = (i + 1) / (STOPS.length + 1)
              if (p >= threshold - 0.02 && p < threshold + 0.12) {
                setActiveStop(i)
              } else if (p >= threshold + 0.12 && i === STOPS.length - 1 && p > 0.92) {
                setJourneyDone(true)
              }
            })
          },
        },
      })

      // Pan the road horizontally
      tl.to(road, {
        x: '-60%',
        ease: 'none',
        duration: 1,
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: 'black' }}>
      {/* The Road (wide, pannable) */}
      <div ref={roadRef} style={{ position: 'absolute', top: 0, left: 0, width: '200%', height: '100%', display: 'flex', alignItems: 'center' }}>
        {/* Road SVG */}
        <svg width="100%" height="100%" viewBox="0 0 2000 800" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', top: 0, left: 0 }}>
          {/* Road surface */}
          <rect x="0" y="420" width="2000" height="120" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.15" />
          {/* Center dashes */}
          {Array.from({ length: 20 }).map((_, i) => (
            <rect key={i} x={i * 110 + 40} y="477" width="60" height="4" fill="white" fillOpacity="0.08" rx="2" />
          ))}
          {/* Road edge lines */}
          <line x1="0" y1="420" x2="2000" y2="420" stroke="white" strokeWidth="1.5" strokeOpacity="0.2" />
          <line x1="0" y1="540" x2="2000" y2="540" stroke="white" strokeWidth="1.5" strokeOpacity="0.2" />

          {/* Street details */}
          {/* Streetlight 1 */}
          <line x1="320" y1="200" x2="320" y2="420" stroke="white" strokeWidth="2" strokeOpacity="0.15" />
          <ellipse cx="300" cy="200" rx="25" ry="6" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.2" />
          <ellipse cx="300" cy="200" rx="8" ry="8" fill="white" fillOpacity="0.03" />

          {/* Chai cup */}
          <path d="M680 535 L685 545 L695 545 L700 535 Z" stroke="white" strokeWidth="1" strokeOpacity="0.2" fill="none" />
          <line x1="695" y1="538" x2="700" y2="535" stroke="white" strokeWidth="1" strokeOpacity="0.15" />

          {/* Streetlight 2 */}
          <line x1="980" y1="180" x2="980" y2="420" stroke="white" strokeWidth="2" strokeOpacity="0.15" />
          <ellipse cx="960" cy="180" rx="25" ry="6" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.2" />

          {/* Cigarette box */}
          <rect x="1250" y="532" width="18" height="10" rx="1" stroke="white" strokeWidth="1" strokeOpacity="0.2" fill="none" />

          {/* Streetlight 3 */}
          <line x1="1600" y1="200" x2="1600" y2="420" stroke="white" strokeWidth="2" strokeOpacity="0.15" />
          <ellipse cx="1580" cy="200" rx="25" ry="6" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.2" />

          {/* Shop fronts */}
          {STOPS.map((stop, i) => (
            <ShopFront key={stop.id} x={200 + i * 620} stopIndex={i} activeStop={activeStop} />
          ))}

          {/* Footstep marks */}
          {Array.from({ length: 30 }).map((_, i) => (
            <ellipse key={i} cx={150 + i * 60} cy={530} rx="6" ry="3"
              fill="white" fillOpacity={0.03 + (i % 2) * 0.02}
            />
          ))}
        </svg>

        {/* The Man */}
        <div
          ref={manRef}
          style={{ position: 'absolute', bottom: '260px', left: '5%', transform: 'translateX(-50%)', zIndex: 10, transition: 'bottom 0.1s' }}
        >
          <ManSVG />
          {/* Foot dust */}
          <motion.div
            animate={{ opacity: [0, 0.4, 0], y: [0, -10] }}
            transition={{ duration: 0.4, repeat: Infinity }}
            style={{ position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)', width: '20px', height: '5px', background: 'white', borderRadius: '50%', filter: 'blur(4px)' }}
          />
        </div>
      </div>

      {/* Stop Story Cards (overlaid) */}
      <AnimatePresence>
        {activeStop >= 0 && activeStop < STOPS.length && (
          <motion.div
            key={activeStop}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
              textAlign: 'center', zIndex: 20, maxWidth: '520px', pointerEvents: 'none',
            }}
          >
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{STOPS[activeStop].line1}</p>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem', color: 'white', lineHeight: 1.6 }}>{STOPS[activeStop].line2}</p>
            {activeStop === 2 && journeyDone && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                style={{ marginTop: '1.5rem', fontSize: '0.8rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}
              >
                And the story isn't over.
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section label */}
      <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', zIndex: 20, pointerEvents: 'none' }}>
        <p style={{ fontSize: '0.6rem', letterSpacing: '0.5em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>The Journey</p>
      </div>
    </section>
  )
}

/* ── Shop Front SVG Component ── */
function ShopFront({ x, stopIndex, activeStop }) {
  const visible = activeStop >= stopIndex
  const labels = ['GURUKUL', 'BHAT', 'VISAT']

  return (
    <g transform={`translate(${x}, 260)`}>
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Shop body */}
        <motion.rect x="0" y="0" width="120" height="160" rx="4" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: visible ? 1 : 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />
        {/* Awning */}
        <motion.path d="M-10,0 L130,0 L120,-20 L0,-20 Z" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: visible ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
        {/* Door */}
        <rect x="42" y="100" width="36" height="60" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.4" />
        {/* Window */}
        <rect x="10" y="30" width="40" height="40" fill="white" fillOpacity="0.03" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
        <rect x="70" y="30" width="40" height="40" fill="white" fillOpacity="0.03" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
        {/* Label */}
        <text x="60" y="-30" textAnchor="middle" fill="white" fillOpacity="0.8" fontSize="8" fontFamily="Georgia, serif" fontWeight="bold" letterSpacing="2">
          BB · {labels[stopIndex]}
        </text>
        {/* Glow */}
        {visible && (
          <ellipse cx="60" cy="80" rx="50" ry="50" fill="white" fillOpacity="0.012" />
        )}
      </motion.g>
    </g>
  )
}

/* ── Man SVG ── */
function ManSVG() {
  return (
    <svg width="40" height="80" viewBox="0 0 40 80" fill="none">
      {/* Head */}
      <circle cx="20" cy="12" r="8" stroke="white" strokeWidth="1.5" fill="none" />
      {/* Body - kurta */}
      <path d="M12 20 L10 50 L30 50 L28 20 Z" stroke="white" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      {/* Arms */}
      <path d="M12 22 L5 38" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M28 22 L35 38" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      {/* Legs */}
      <path d="M15 50 L13 72" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M25 50 L27 72" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      {/* Feet */}
      <path d="M13 72 L8 75" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M27 72 L32 75" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
