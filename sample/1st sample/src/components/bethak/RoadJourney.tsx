import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
import { useRef } from "react";

const Shopfront = ({ location, year }: { location: string; year: string }) => (
  <div className="relative flex flex-col items-center">
    {/* Ground glow */}
    <div className="absolute -bottom-6 w-56 h-10 rounded-full bg-ember/30 blur-3xl animate-flicker" />
    {/* Hanging lantern */}
    <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
      <span className="w-px h-6 bg-white/30" />
      <span className="w-3 h-3 rounded-full bg-ember/80 shadow-[0_0_20px_6px_hsl(32_96%_56%/0.6)] animate-flicker" />
    </div>
    <svg width="240" height="220" viewBox="0 0 240 220" className="text-white">
      <defs>
        <linearGradient id="winGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(32 96% 65%)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="hsl(32 96% 45%)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* Awning stripes */}
      <motion.path d="M10 70 L120 24 L230 70 Z"
        fill="black" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1 }}
      />
      {[0,1,2,3,4].map(i => (
        <line key={i} x1={20 + i*45} y1={70 - i*8} x2={45 + i*45} y2={70 - i*8} stroke="white" strokeWidth="0.5" opacity="0.4" />
      ))}
      {/* Walls */}
      <motion.path d="M22 70 L22 200 L218 200 L218 70"
        fill="none" stroke="currentColor" strokeWidth="2"
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 }}
      />
      {/* Brick lines */}
      <line x1="22" y1="120" x2="218" y2="120" stroke="white" strokeWidth="0.5" opacity="0.15" />
      <line x1="22" y1="160" x2="218" y2="160" stroke="white" strokeWidth="0.5" opacity="0.15" />
      {/* Window glow */}
      <rect x="42" y="100" width="68" height="70" fill="url(#winGlow)" />
      <line x1="76" y1="100" x2="76" y2="170" stroke="white" strokeWidth="1" opacity="0.6" />
      <line x1="42" y1="135" x2="110" y2="135" stroke="white" strokeWidth="1" opacity="0.6" />
      <motion.rect x="42" y="100" width="68" height="70"
        fill="none" stroke="currentColor" strokeWidth="1.5"
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.8 }}
      />
      {/* Door */}
      <motion.rect x="140" y="115" width="55" height="85" rx="2"
        fill="hsl(32 96% 56% / 0.12)" stroke="currentColor" strokeWidth="1.5"
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.8 }}
      />
      <circle cx="187" cy="158" r="1.5" fill="hsl(32 96% 56%)" />
      {/* Signboard */}
      <rect x="28" y="76" width="184" height="22" fill="black" stroke="white" strokeWidth="1" />
      <text x="120" y="91" textAnchor="middle" fill="white" fontSize="10" fontFamily="Inter" letterSpacing="3">
        BOMBAY BETHAK
      </text>
      {/* Chimney smoke */}
      <circle cx="180" cy="50" r="3" fill="white" opacity="0.3" className="animate-flicker" />
      <circle cx="186" cy="40" r="2" fill="white" opacity="0.2" className="animate-flicker" />
    </svg>
    <div className="mt-5 text-center">
      <div className="inline-block px-4 py-1 rounded-full border border-ember/40 bg-ember/5">
        <span className="text-ember font-display text-2xl md:text-3xl tracking-wide">{location}</span>
      </div>
      <div className="text-white/50 text-[10px] tracking-[0.3em] uppercase mt-2">{year}</div>
    </div>
  </div>
);

const Walker = ({ progress }: { progress: MotionValue<number> }) => {
  const bob = useTransform(progress, (v) => Math.sin(v * 60) * 2);
  return (
    <motion.div style={{ y: bob }} className="relative">
      <svg width="60" height="100" viewBox="0 0 60 100" className="text-white drop-shadow-[0_4px_12px_rgba(255,180,80,0.35)]">
        <circle cx="30" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M18 24 L42 24 L46 60 L14 60 Z" fill="black" stroke="currentColor" strokeWidth="1.5" />
        <line x1="18" y1="30" x2="10" y2="50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="42" y1="30" x2="50" y2="48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <motion.line x1="24" y1="60" x2="20" y2="92" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          animate={{ x2: [20, 28, 20] }} transition={{ duration: 0.6, repeat: Infinity }} />
        <motion.line x1="36" y1="60" x2="40" y2="92" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          animate={{ x2: [40, 32, 40] }} transition={{ duration: 0.6, repeat: Infinity }} />
        <path d="M22 8 L38 8 L36 4 L24 4 Z" fill="currentColor" />
      </svg>
      {/* Footstep glow */}
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full bg-ember/40 blur-md" />
    </motion.div>
  );
};

export const RoadJourney = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-75%"]);
  // Parallax background layers
  const xMountains = useTransform(scrollYProgress, [0, 1], ["0%", "-25%"]);
  const xHills = useTransform(scrollYProgress, [0, 1], ["0%", "-45%"]);

  const t1 = useTransform(scrollYProgress, [0.15, 0.22, 0.32, 0.4], [0, 1, 1, 0]);
  const t2 = useTransform(scrollYProgress, [0.42, 0.5, 0.62, 0.7], [0, 1, 1, 0]);
  const t3 = useTransform(scrollYProgress, [0.75, 0.83, 0.95, 1], [0, 1, 1, 0]);
  const finalLine = useTransform(scrollYProgress, [0.92, 0.98], [0, 1]);

  // Progress bar width
  const barWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const dot1 = useTransform(scrollYProgress, [0.15, 0.22], ["hsl(0 0% 100% / 0.3)", "hsl(32 96% 56%)"]);
  const dot2 = useTransform(scrollYProgress, [0.45, 0.52], ["hsl(0 0% 100% / 0.3)", "hsl(32 96% 56%)"]);
  const dot3 = useTransform(scrollYProgress, [0.78, 0.85], ["hsl(0 0% 100% / 0.3)", "hsl(32 96% 56%)"]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  return (
    <section ref={ref} className="relative bg-black" style={{ height: "500vh" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden grain">
        {/* Sky gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a14] via-black to-[#1a0e05]" />

        {/* Moon */}
        <div className="absolute top-[8%] right-[12%] w-20 h-20 md:w-28 md:h-28 rounded-full bg-white/90 shadow-[0_0_80px_20px_rgba(255,255,255,0.15)] animate-breathe" />
        <div className="absolute top-[8%] right-[12%] w-20 h-20 md:w-28 md:h-28 rounded-full bg-black/30 [transform:translate(20%,-10%)]" />

        {/* Stars */}
        <div className="absolute inset-0">
          {Array.from({ length: 80 }).map((_, i) => (
            <span key={i} className="absolute rounded-full bg-white animate-flicker"
              style={{
                left: `${(i * 53) % 100}%`,
                top: `${(i * 31) % 55}%`,
                width: i % 7 === 0 ? 2 : 1,
                height: i % 7 === 0 ? 2 : 1,
                opacity: 0.2 + ((i * 7) % 6) / 10,
                animationDelay: `${(i % 5) * 0.4}s`,
              }} />
          ))}
        </div>

        {/* Parallax mountains (far) */}
        <motion.div style={{ x: xMountains }} className="absolute bottom-[28%] left-0" >
          <svg width="2400" height="200" viewBox="0 0 2400 200" preserveAspectRatio="none" className="opacity-30">
            <path d="M0 200 L200 80 L400 140 L600 60 L820 130 L1040 70 L1260 120 L1480 50 L1700 130 L1920 80 L2140 140 L2400 90 L2400 200 Z" fill="#1a1a22" stroke="#2a2a35" strokeWidth="1" />
          </svg>
        </motion.div>
        {/* Parallax hills (near) */}
        <motion.div style={{ x: xHills }} className="absolute bottom-[24%] left-0">
          <svg width="2400" height="160" viewBox="0 0 2400 160" preserveAspectRatio="none" className="opacity-50">
            <path d="M0 160 L300 80 L580 120 L880 70 L1180 110 L1480 60 L1780 110 L2080 75 L2400 105 L2400 160 Z" fill="#0d0d12" />
          </svg>
        </motion.div>

        {/* Fog layer */}
        <div className="absolute bottom-[20%] left-0 right-0 h-24 bg-gradient-to-t from-white/[0.04] to-transparent pointer-events-none" />

        {/* Horizontal world */}
        <motion.div style={{ x }} className="absolute inset-y-0 left-0">
          <div className="relative h-screen" style={{ width: "400vw" }}>
            {/* Road glow */}
            <div className="absolute bottom-[19%] left-0 right-0 h-12 bg-gradient-to-t from-ember/10 to-transparent" />
            {/* Road lines */}
            <div className="absolute bottom-[20%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            <div className="absolute bottom-[20%] left-0 right-0 h-px bg-white/10" style={{ transform: "translateY(10px)" }} />
            {/* Road dashes */}
            <div className="absolute bottom-[19%] left-0 right-0 flex gap-8 md:gap-12 opacity-40">
              {Array.from({ length: 80 }).map((_, i) => (
                <span key={i} className="h-px w-6 md:w-10 bg-ember/60" />
              ))}
            </div>

            {/* Streetlights */}
            {[8, 28, 48, 68].map((p, i) => (
              <div key={i} className="absolute bottom-[20%]" style={{ left: `${p}%` }}>
                <svg width="40" height="120" viewBox="0 0 40 120" className="text-white/60 w-7 h-24 md:w-10 md:h-32">
                  <line x1="20" y1="120" x2="20" y2="20" stroke="currentColor" strokeWidth="1" />
                  <line x1="20" y1="20" x2="35" y2="20" stroke="currentColor" strokeWidth="1" />
                  <circle cx="35" cy="22" r="3" fill="hsl(32 96% 56%)" className="animate-flicker" />
                  <circle cx="35" cy="22" r="8" fill="hsl(32 96% 56% / 0.2)" className="animate-flicker" />
                </svg>
                {/* Light cone */}
                <div className="absolute top-0 left-[60%] w-16 h-20 bg-gradient-to-b from-ember/15 to-transparent rounded-full blur-md" />
              </div>
            ))}

            {/* Trees */}
            {[18, 38, 58].map((p, i) => (
              <div key={i} className="absolute bottom-[20%]" style={{ left: `${p}%` }}>
                <svg width="60" height="80" viewBox="0 0 60 80" className="text-white/30 w-12 h-16 md:w-16 md:h-20">
                  <line x1="30" y1="80" x2="30" y2="40" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="30" cy="30" r="18" fill="black" stroke="currentColor" strokeWidth="1" />
                  <circle cx="22" cy="26" r="10" fill="black" stroke="currentColor" strokeWidth="0.8" />
                  <circle cx="38" cy="26" r="10" fill="black" stroke="currentColor" strokeWidth="0.8" />
                </svg>
              </div>
            ))}

            {/* Birds */}
            <svg className="absolute top-[15%] left-[30%] w-10 opacity-40" viewBox="0 0 40 20">
              <path d="M2 10 Q8 2 14 10 Q20 2 26 10" fill="none" stroke="white" strokeWidth="1" />
            </svg>
            <svg className="absolute top-[20%] left-[55%] w-8 opacity-30" viewBox="0 0 40 20">
              <path d="M2 10 Q8 2 14 10 Q20 2 26 10" fill="none" stroke="white" strokeWidth="1" />
            </svg>

            {/* Stops */}
            <div className="absolute bottom-[22%] scale-75 md:scale-100 origin-bottom" style={{ left: "22%" }}>
              <Shopfront location="GURUKUL" year="The first corner" />
            </div>
            <div className="absolute bottom-[22%] scale-75 md:scale-100 origin-bottom" style={{ left: "50%" }}>
              <Shopfront location="BHAT" year="The cafe chapter" />
            </div>
            {/* Cafe table */}
            <div className="absolute bottom-[20%] hidden md:block" style={{ left: "47%" }}>
              <svg width="40" height="50" viewBox="0 0 40 50" className="text-white/50">
                <rect x="10" y="20" width="20" height="2" fill="currentColor" />
                <line x1="12" y1="22" x2="12" y2="40" stroke="currentColor" strokeWidth="1" />
                <line x1="28" y1="22" x2="28" y2="40" stroke="currentColor" strokeWidth="1" />
                <circle cx="20" cy="16" r="3" fill="none" stroke="currentColor" strokeWidth="1" />
                <line x1="20" y1="13" x2="20" y2="8" stroke="hsl(32 96% 56%)" strokeWidth="0.8" className="animate-flicker" />
              </svg>
            </div>
            <div className="absolute bottom-[22%] scale-75 md:scale-100 origin-bottom" style={{ left: "78%" }}>
              <Shopfront location="VISAT" year="The third Bethak" />
            </div>
          </div>
        </motion.div>

        {/* Walker */}
        <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 z-10 scale-75 md:scale-100 origin-bottom">
          <Walker progress={scrollYProgress} />
        </div>

        {/* Story overlays */}
        {[
          { t: t1, label: "Stop One", title: "Gurukul, Ahmedabad.", desc: "One small shop. Paan, smoke, and a place to sit. The first Bethak was born." },
          { t: t2, label: "Stop Two", title: "Bhat. The cafe chapter.", desc: "Bombay Bethak grew. A cafe joined the story — BB Cafe. A new corner, a new crowd." },
          { t: t3, label: "Stop Three", title: "Visat. The third Bethak.", desc: "Three corners. One story. Yours." },
        ].map((s, i) => (
          <motion.div key={i} style={{ opacity: s.t }} className="absolute top-[8%] md:top-[12%] left-1/2 -translate-x-1/2 text-center w-[92%] max-w-xl px-4 z-20">
            <div className="inline-block">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="h-px w-8 bg-ember/60" />
                <span className="text-ember text-[10px] md:text-xs tracking-[0.5em] uppercase">{s.label}</span>
                <span className="h-px w-8 bg-ember/60" />
              </div>
              <h3 className="font-display text-3xl md:text-6xl text-white leading-tight drop-shadow-[0_4px_20px_rgba(255,180,80,0.25)]">{s.title}</h3>
              <p className="text-white/70 mt-3 md:mt-4 text-xs md:text-base max-w-md mx-auto leading-relaxed">{s.desc}</p>
            </div>
          </motion.div>
        ))}

        <motion.div style={{ opacity: finalLine }} className="absolute bottom-[10%] left-1/2 -translate-x-1/2 text-center px-4 z-20">
          <p className="font-display italic text-white text-2xl md:text-4xl drop-shadow-[0_4px_20px_rgba(255,180,80,0.3)]">
            And the story isn't over.
          </p>
        </motion.div>

        {/* Top progress bar with stop names */}
        <div className="absolute top-5 md:top-8 left-1/2 -translate-x-1/2 w-[88%] max-w-md z-30">
          <div className="flex justify-between text-[9px] md:text-[10px] tracking-[0.3em] uppercase text-white/50 mb-2">
            <span>Gurukul</span>
            <span>Bhat</span>
            <span>Visat</span>
          </div>
          <div className="relative h-px bg-white/15 rounded-full overflow-hidden">
            <motion.div style={{ width: barWidth }} className="absolute inset-y-0 left-0 bg-gradient-to-r from-ember/60 via-ember to-ember/60 shadow-[0_0_10px_hsl(32_96%_56%)]" />
          </div>
          <div className="flex justify-between mt-1.5">
            {[dot1, dot2, dot3].map((c, i) => (
              <motion.span key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <motion.div
          style={{ opacity: hintOpacity }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center z-20"
        >
          <div className="text-white/40 text-[10px] tracking-[0.4em] uppercase mb-2">Scroll</div>
          <div className="w-px h-8 bg-gradient-to-b from-white/40 to-transparent mx-auto animate-scroll-hint" />
        </motion.div>
      </div>
    </section>
  );
};
