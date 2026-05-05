import { useRef, useState } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'

const STOPS = [
  { key: 'gurukul', name: 'GURUKUL', sign: 'BOMBAY BETHAK', year: 'Gurukul, Ahmedabad · 2025', label: 'Stop One',   title: 'The First Corner',        body: 'One small shop. Paan, smoke, and a place to sit. The first Bethak was born.',                              progress: 0.25, bottom: 26 },
  { key: 'bhat',    name: 'BHAT',    sign: 'BB CAFE',       year: 'Bhat · Jan 2026',           label: 'Stop Two',   title: 'A New Crowd',              body: 'Bombay Bethak grew. A cafe joined the story — BB Cafe. A new corner, a new crowd.',                       progress: 0.55, bottom: 28.6 },
  { key: 'visat',   name: 'VISAT',   sign: 'BOMBAY BETHAK', year: 'Visat · March 2026',        label: 'Stop Three', title: 'Three Corners. One Soul.', body: 'Three corners. One story. Yours.',                                                                         progress: 0.85, bottom: 25.2 },
]

function Stars() {
  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
      {Array.from({ length: 50 }).map((_, i) => (
        <circle key={i} cx={`${((i * 173) % 1000) / 10}%`} cy={`${((i * 91) % 350) / 10}%`} r={(i % 3) * 0.4 + 0.4} fill="white" opacity={0.15 + (i % 4) * 0.15} />
      ))}
    </svg>
  )
}

function Moon() {
  return (
    <div className="absolute top-[8%] left-[6%] md:left-[8%]">
      <div className="relative h-20 w-20 md:h-28 md:w-28 rounded-full bg-white/85 shadow-[0_0_80px_30px_rgba(255,255,255,0.08)]">
        <div className="absolute top-1 left-1 h-16 md:h-24 w-16 md:w-24 rounded-full bg-black" />
      </div>
    </div>
  )
}

function Shop({ data, index }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-48 w-56 rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(255,180,90,0.2),transparent_70%)] blur-xl" />
      <svg viewBox="0 0 260 220" className="relative w-[160px] md:w-[220px] h-auto">
        <defs>
          <radialGradient id={`wg-${index}`} cx="50%" cy="50%" r="55%">
            <stop offset="0%"   stopColor="rgba(255,190,110,0.85)" />
            <stop offset="60%"  stopColor="rgba(255,160,80,0.4)" />
            <stop offset="100%" stopColor="rgba(255,140,60,0)" />
          </radialGradient>
        </defs>
        <motion.g stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 1.2 }}>
          <path d="M30 90 Q130 30 230 90" />
          <path d="M30 90 Q130 60 230 90" strokeDasharray="4 6" />
          <path d="M40 90 L40 180 Q40 200 60 200 L200 200 Q220 200 220 180 L220 90" />
          <path d="M105 200 L105 150 Q105 130 130 130 Q155 130 155 150 L155 200" />
          <path d="M55 175 L55 115 Q55 100 70 100 L92 100 Q107 100 107 115 L107 175 Z" fill={`url(#wg-${index})`} />
          <path d="M168 175 L168 115 Q168 100 183 100 L205 100 Q220 100 220 115 L220 175 Z" fill={`url(#wg-${index})`} />
          <path d="M20 200 Q130 210 240 200" />
        </motion.g>
        <g>
          <rect x="55" y="68" width="150" height="22" rx="11" fill="black" stroke="white" strokeWidth="1.2" />
          <text x="130" y="83" textAnchor="middle" fill="white" fontSize="8.5"
            style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '0.22em', fontWeight: 700 }}>{data.sign}</text>
        </g>
        <g>
          <line x1="130" y1="90" x2="130" y2="112" stroke="white" strokeWidth="0.8" />
          <circle cx="130" cy="116" r="3.5" fill="rgba(255,190,110,1)">
            <animate attributeName="opacity" values="1;0.7;1;0.85;1" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
      <div className="absolute top-[100%] mt-3 md:mt-4 text-center">
        <div className="font-display text-white/50 tracking-[0.3em] text-[10px] md:text-xs uppercase">{data.name}</div>
      </div>
    </div>
  )
}

function Man() {
  return (
    <div className="relative animate-walk">
      <svg viewBox="0 0 60 110" className="w-[38px] md:w-[50px] h-auto drop-shadow-[0_0_10px_rgba(255,190,110,0.3)]">
        <g stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="30" cy="14" r="7" />
          <path d="M18 30 Q30 22 42 30 L44 60 Q30 66 16 60 Z" fill="rgba(255,255,255,0.05)" />
          <path d="M18 32 Q10 46 14 56" />
          <path d="M42 32 Q50 44 46 54" />
          <path d="M24 60 Q22 78 20 92" />
          <path d="M36 60 Q40 78 42 92" />
          <path d="M16 92 Q20 96 24 92" />
          <path d="M38 92 Q42 96 46 92" />
        </g>
      </svg>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-8 rounded-full bg-white/15 blur-[2px]" />
    </div>
  )
}

function StreetProp({ x, b, type }) {
  const s = { stroke: 'white', strokeWidth: 1.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <div className="absolute" style={{ left: `${x}%`, bottom: `${b}%` }}>
      <svg viewBox="0 0 60 100" className="w-[36px] md:w-[50px] h-auto opacity-70">
        {type === 'lamp'  && <g {...s}><path d="M30 100 L30 20 Q30 12 38 12 L48 12" /><circle cx="50" cy="16" r="5" fill="rgba(255,190,110,0.85)" stroke="rgba(255,190,110,1)" /><circle cx="50" cy="16" r="14" fill="rgba(255,190,110,0.12)" stroke="none" /><path d="M22 100 L38 100" /></g>}
        {type === 'tree'  && <g {...s}><path d="M30 100 L30 60" /><path d="M14 60 Q30 20 46 60 Q38 64 30 60 Q22 64 14 60 Z" /></g>}
        {type === 'cup'   && <g {...s}><path d="M18 96 Q30 100 42 96 L40 78 Q30 82 20 78 Z" /><path d="M40 84 Q48 84 48 92 Q48 96 42 96" /><path d="M22 74 Q26 70 24 66 M30 74 Q34 70 32 66" opacity="0.5" /></g>}
        {type === 'bench' && <g {...s}><path d="M10 90 Q30 86 50 90" /><path d="M10 90 L10 98 M50 90 L50 98 M22 90 L22 98 M38 90 L38 98" /><path d="M14 86 Q30 82 46 86" /></g>}
        {type === 'bike'  && <g {...s}><circle cx="18" cy="84" r="8" /><circle cx="44" cy="84" r="8" /><path d="M18 84 L30 64 L44 84 M30 64 L36 56 L44 56" /></g>}
      </svg>
    </div>
  )
}

function getManBottom(p) {
  if (p < 0.1) return 27.2 + (p/0.1)*(28-27.2);
  if (p < 0.23) return 28 + ((p-0.1)/0.13)*(26-28);
  if (p < 0.33) return 26 + ((p-0.23)/0.1)*(24.7-26);
  if (p < 0.51) return 24.7 + ((p-0.33)/0.18)*(27-24.7);
  if (p < 0.56) return 27 + ((p-0.51)/0.05)*(28.6-27);
  if (p < 0.64) return 28.6 + ((p-0.56)/0.08)*(29.5-28.6);
  if (p < 0.73) return 29.5 + ((p-0.64)/0.09)*(27.4-29.5);
  if (p < 0.78) return 27.4 + ((p-0.73)/0.05)*(27-27.4);
  if (p < 0.9) return 27 + ((p-0.78)/0.12)*(25.2-27);
  return 25.2 + ((p-0.9)/0.1)*(25.9-25.2);
}

function Road({ progress }) {
  const manLeft = `${4 + progress * 90}%`
  const manBottom = `${getManBottom(progress)}%`
  
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 3600 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="roadEdge" x1="0" x2="1">
            <stop offset="0"   stopColor="rgba(255,255,255,0.04)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="1"   stopColor="rgba(255,255,255,0.04)" />
          </linearGradient>
        </defs>
        <path d="M0 720 Q900 700 1800 730 Q2700 760 3600 720 L3600 1000 L0 1000 Z" fill="rgba(255,255,255,0.015)" />
        <path d="M0 740 Q450 700 900 740 Q1350 780 1800 730 Q2250 680 2700 730 Q3150 770 3600 720"
          stroke="url(#roadEdge)" strokeWidth="3" fill="none" />
        <path d="M0 760 Q450 720 900 760 Q1350 800 1800 750 Q2250 700 2700 750 Q3150 790 3600 740"
          stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeDasharray="14 22" fill="none" strokeLinecap="round" />
      </svg>

      <StreetProp x={5}  b={27.2} type="lamp"  />
      <StreetProp x={13} b={28.0} type="cup"   />
      <StreetProp x={20} b={27.2} type="bench" />
      <StreetProp x={30} b={24.7} type="lamp"  />
      <StreetProp x={42} b={24.7} type="tree"  />
      <StreetProp x={55} b={28.6} type="bike"  />
      <StreetProp x={62} b={29.5} type="lamp"  />
      <StreetProp x={74} b={27.4} type="tree"  />
      <StreetProp x={83} b={25.3} type="cup"   />
      <StreetProp x={93} b={25.9} type="lamp"  />

      {STOPS.map((s, idx) => (
        <div key={s.key} className="absolute flex flex-col items-center"
          style={{ left: `${s.progress * 90 + 4}%`, bottom: `${s.bottom}%`, transform: 'translateX(-50%)' }}>
          <Shop data={s} index={idx} />
        </div>
      ))}

      <div className="absolute animate-walk" style={{ left: manLeft, bottom: manBottom, transform: 'translateX(-50%)' }}>
        <Man />
      </div>
    </div>
  )
}

/* Story overlay shown at each stop — lives in sticky viewport, NOT in the scrolling world */
function StoryOverlay({ stop, opacity }) {
  return (
    <motion.div
      style={{ opacity }}
      className="absolute top-[10%] left-1/2 -translate-x-1/2 z-20 text-center w-[92%] max-w-lg px-4 pointer-events-none"
    >
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="h-px w-8 bg-ember/60" />
        <span className="text-ember text-[10px] md:text-xs tracking-[0.5em] uppercase">{stop.label}</span>
        <span className="h-px w-8 bg-ember/60" />
      </div>
      <h3 className="font-display text-3xl md:text-5xl text-white leading-tight drop-shadow-[0_4px_20px_rgba(255,180,80,0.2)]">
        {stop.title}
      </h3>
      <p className="text-white/65 mt-3 text-sm md:text-base max-w-sm mx-auto leading-relaxed">{stop.year}</p>
      <p className="text-white/50 mt-2 text-sm md:text-base max-w-sm mx-auto leading-relaxed">{stop.body}</p>
    </motion.div>
  )
}

export default function RoadJourney() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-72%'])

  // Hero completely fades out very early. Fades back in ONLY at the end.
  const heroOpacity = useTransform(scrollYProgress, [0, 0.04, 0.96, 0.99], [1, 0, 0, 1])
  const heroScale = useTransform(scrollYProgress, [0, 0.04, 0.96, 0.99], [1, 1.1, 1.1, 1])
  const heroY = useTransform(scrollYProgress, [0, 1], ['0vh', '0vh'])
  
  // Story Intro
  const introOpacity = useTransform(scrollYProgress, [0.05, 0.08, 0.16, 0.19], [0, 1, 1, 0])
  const introY = useTransform(scrollYProgress, [0.05, 0.08], [20, 0])

  // Stop 1, 2, 3 overlays — extended visibility to allow smooth reading
  const t1 = useTransform(scrollYProgress, [0.19, 0.23, 0.40, 0.44], [0, 1, 1, 0])
  const t2 = useTransform(scrollYProgress, [0.49, 0.53, 0.70, 0.74], [0, 1, 1, 0])
  const t3 = useTransform(scrollYProgress, [0.79, 0.83, 0.94, 0.96], [0, 1, 1, 0])
  
  const finalLine = useTransform(scrollYProgress, [0.95, 0.98], [0, 1])
  const hintOpacity = useTransform(scrollYProgress, [0, 0.03], [1, 0])
  const barWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  const [progress, setProgress] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setProgress(v))
  
  // Sync HUD perfectly with the overlay fade-ins
  const active = STOPS.reduce((acc, s) => (progress >= s.progress - 0.08 ? s : acc), STOPS[0])

  return (
    <section ref={ref} className="relative bg-black" style={{ height: '600vh' }} aria-label="The Bombay Bethak journey">
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">

        {/* Sky */}
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(20,15,10,0.4),transparent_60%),linear-gradient(to_bottom,#0a0807,#000)]" />
        <Stars />
        <Moon />

        {/* Horizontally scrolling world */}
        <motion.div style={{ x }} className="absolute inset-y-0 left-0 h-full w-[360%] opacity-80">
          <Road progress={progress} />
        </motion.div>

        {/* HERO SECTION OVERLAY */}
        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale, y: heroY }} 
          className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center pointer-events-none"
        >
          <motion.div initial={{ opacity: 0, letterSpacing: '0.5em' }} animate={{ opacity: 1, letterSpacing: '0.18em' }}
            transition={{ duration: 1.6, ease: 'easeOut', delay: 0.2 }}
            className="font-display text-6xl leading-none text-white sm:text-8xl md:text-[8rem] lg:text-[10rem] drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            BOMBAY
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, delay: 0.6 }}
            className="font-display text-6xl leading-none text-white sm:text-8xl md:text-[8rem] lg:text-[10rem] drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            style={{ letterSpacing: '0.18em' }}>
            BETHAK
          </motion.div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 1.2 }}
            className="mt-8 font-script text-ember text-2xl md:text-4xl">
            where every sip has a story
          </motion.p>
        </motion.div>

        {/* INTRO TEXT OVERLAY */}
        <motion.div 
          style={{ opacity: introOpacity, y: introY }} 
          className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center pointer-events-none"
        >
          <h2 className="font-display text-3xl text-white md:text-5xl max-w-3xl mx-auto leading-tight drop-shadow-md">
            It started with one shop. One corner. One idea.
          </h2>
          <p className="mt-6 text-white/60 tracking-[0.3em] text-xs uppercase drop-shadow-sm">
            This is the story of Bombay Bethak.
          </p>
        </motion.div>

        {/* Story overlays — fixed in viewport, fade in/out per stop */}
        <StoryOverlay stop={STOPS[0]} opacity={t1} />
        <StoryOverlay stop={STOPS[1]} opacity={t2} />
        <StoryOverlay stop={STOPS[2]} opacity={t3} />

        {/* Final line */}
        <motion.div style={{ opacity: finalLine }}
          className="absolute bottom-[14%] left-1/2 -translate-x-1/2 text-center z-20 pointer-events-none">
          <p className="font-italic-display text-white text-2xl md:text-4xl drop-shadow-[0_4px_20px_rgba(255,180,80,0.25)]">
            And the story isn't over.
          </p>
        </motion.div>

        {/* Progress HUD */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 px-4 pointer-events-none">
          <div className="font-script text-white/40 text-sm">the journey</div>
          <div className="relative h-[3px] w-44 md:w-64 rounded-full bg-white/15 overflow-hidden">
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-ember" style={{ width: barWidth }} />
            {STOPS.map((s) => (
              <div key={s.key} className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-white/50 bg-black"
                style={{ left: `calc(${s.progress * 100}% - 5px)` }} />
            ))}
          </div>
          <div className="font-italic-display text-white/70 text-xs md:text-sm tracking-widest">{active.name}</div>
        </div>

        {/* Scroll hint */}
        <motion.div style={{ opacity: hintOpacity }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none">
          <span className="text-[9px] tracking-[0.4em] text-white/35 uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/35 to-transparent animate-scroll-hint" />
        </motion.div>

      </div>
    </section>
  )
}
