import { useRef, useState } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent, useReducedMotion } from "framer-motion";

const STOPS = [
  {
    key: "gurukul",
    name: "GURUKUL",
    sign: "BOMBAY BETHAK",
    sub: "GURUKUL",
    year: "2021 · Gurukul, Ahmedabad",
    title: "The First Corner",
    body: "One small shop. Paan, smoke, and a place to sit. The first Bethak was born.",
    progress: 0.18,
  },
  {
    key: "bhat",
    name: "BHAT",
    sign: "BB CAFE",
    sub: "BHAT",
    year: "Bhat · The cafe chapter",
    title: "A New Crowd",
    body: "Bombay Bethak grew. A cafe joined the story — BB Cafe. A new corner, a new crowd.",
    progress: 0.5,
  },
  {
    key: "visat",
    name: "VISAT",
    sign: "BOMBAY BETHAK",
    sub: "VISAT",
    year: "Visat · The third Bethak",
    title: "Three Corners. One Soul.",
    body: "Three corners. One story. Yours.",
    progress: 0.84,
  },
];

/* ---------- decorative bits ---------- */

function Stars() {
  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
      {Array.from({ length: 40 }).map((_, i) => {
        const cx = ((i * 173) % 1000) / 10;
        const cy = ((i * 91) % 350) / 10;
        const r = (i % 3) * 0.4 + 0.4;
        return <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r={r} fill="white" opacity={0.15 + (i % 4) * 0.15} />;
      })}
    </svg>
  );
}

function Moon() {
  return (
    <div className="absolute top-[8%] right-[6%] md:right-[4%]">
      <div className="relative h-20 w-20 md:h-28 md:w-28 rounded-full bg-white/85 shadow-[0_0_80px_30px_rgba(255,255,255,0.08)]">
        <div className="absolute top-1 right-1 h-16 md:h-24 w-16 md:w-24 rounded-full bg-black" />
      </div>
    </div>
  );
}

function Shop({ data, index }: { data: (typeof STOPS)[number]; index: number }) {
  return (
    <div className="relative flex flex-col items-center">
      {/* warm glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-48 w-64 rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(255,180,90,0.22),transparent_70%)] blur-xl" />
      <svg viewBox="0 0 260 220" className="relative w-[220px] md:w-[260px] h-auto">
        <defs>
          <radialGradient id={`window-${index}`} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="rgba(255,190,110,0.85)" />
            <stop offset="60%" stopColor="rgba(255,160,80,0.4)" />
            <stop offset="100%" stopColor="rgba(255,140,60,0)" />
          </radialGradient>
        </defs>

        <motion.g
          stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        >
          {/* curvy awning roof */}
          <path d="M30 90 Q130 30 230 90" />
          <path d="M30 90 Q130 60 230 90" strokeDasharray="4 6" />
          {/* shop body w/ rounded corners */}
          <path d="M40 90 L40 180 Q40 200 60 200 L200 200 Q220 200 220 180 L220 90" />
          {/* doorway arch */}
          <path d="M105 200 L105 150 Q105 130 130 130 Q155 130 155 150 L155 200" />
          {/* window arch */}
          <path d="M55 175 L55 115 Q55 100 70 100 L92 100 Q107 100 107 115 L107 175 Z" fill={`url(#window-${index})`} />
          <path d="M168 175 L168 115 Q168 100 183 100 L205 100 Q220 100 220 115 L220 175 Z" fill={`url(#window-${index})`} />
          {/* ground line */}
          <path d="M20 200 Q130 210 240 200" />
          {/* chimney curl smoke */}
          <path d="M70 30 Q80 20 75 10 Q70 0 80 -8" opacity="0.4" />
        </motion.g>

        {/* signboard */}
        <g>
          <rect x="55" y="68" width="150" height="22" rx="11" fill="black" stroke="white" strokeWidth="1.2" />
          <text x="130" y="83" textAnchor="middle" fill="white" fontSize="9.5"
            style={{ fontFamily: "Fraunces, serif", letterSpacing: "0.2em", fontWeight: 700 }}>
            {data.sign}
          </text>
        </g>

        {/* hanging bulb */}
        <g>
          <line x1="130" y1="90" x2="130" y2="112" stroke="white" strokeWidth="0.8" />
          <circle cx="130" cy="116" r="3.5" fill="rgba(255,190,110,1)">
            <animate attributeName="opacity" values="1;0.7;1;0.85;1" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    </div>
  );
}

function Man() {
  return (
    <div className="relative" style={{ animation: "walk 0.6s ease-in-out infinite" }}>
      <svg viewBox="0 0 60 110" className="w-[44px] md:w-[58px] h-auto drop-shadow-[0_0_10px_rgba(255,190,110,0.25)]">
        <g stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* head */}
          <circle cx="30" cy="14" r="7" />
          {/* curvy kurta body */}
          <path d="M18 30 Q30 22 42 30 L44 60 Q30 66 16 60 Z" fill="rgba(255,255,255,0.05)" />
          {/* arms */}
          <path d="M18 32 Q10 46 14 56" />
          <path d="M42 32 Q50 44 46 54" />
          {/* legs */}
          <path d="M24 60 Q22 78 20 92" />
          <path d="M36 60 Q40 78 42 92" />
          <path d="M16 92 Q20 96 24 92" />
          <path d="M38 92 Q42 96 46 92" />
        </g>
      </svg>
      {/* dust */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-8 rounded-full bg-white/15 blur-[2px]" />
    </div>
  );
}

function StreetProp({ x, type, y = 0 }: { x: number; type: "lamp" | "tree" | "cup" | "bench" | "bike"; y?: number }) {
  const stroke = { stroke: "white", strokeWidth: 1.4, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <div className="absolute" style={{ left: `${x}%`, bottom: `calc(36% + ${y}px)` }}>
      <svg viewBox="0 0 60 100" className="w-[44px] md:w-[60px] h-auto opacity-80">
        {type === "lamp" && (
          <g {...stroke}>
            <path d="M30 100 L30 20 Q30 12 38 12 L48 12" />
            <circle cx="50" cy="16" r="5" fill="rgba(255,190,110,0.85)" stroke="rgba(255,190,110,1)" />
            <circle cx="50" cy="16" r="14" fill="rgba(255,190,110,0.12)" stroke="none" />
            <path d="M22 100 L38 100" />
          </g>
        )}
        {type === "tree" && (
          <g {...stroke}>
            <path d="M30 100 L30 60" />
            <path d="M14 60 Q30 20 46 60 Q38 64 30 60 Q22 64 14 60 Z" />
          </g>
        )}
        {type === "cup" && (
          <g {...stroke}>
            <path d="M18 96 Q30 100 42 96 L40 78 Q30 82 20 78 Z" />
            <path d="M40 84 Q48 84 48 92 Q48 96 42 96" />
            <path d="M22 74 Q26 70 24 66 M30 74 Q34 70 32 66" opacity="0.5" />
          </g>
        )}
        {type === "bench" && (
          <g {...stroke}>
            <path d="M10 90 Q30 86 50 90" />
            <path d="M10 90 L10 98 M50 90 L50 98 M22 90 L22 98 M38 90 L38 98" />
            <path d="M14 86 Q30 82 46 86" />
          </g>
        )}
        {type === "bike" && (
          <g {...stroke}>
            <circle cx="18" cy="84" r="8" />
            <circle cx="44" cy="84" r="8" />
            <path d="M18 84 L30 64 L44 84 M30 64 L36 56 L44 56" />
          </g>
        )}
      </svg>
    </div>
  );
}

/* ---------- main ---------- */

export function Journey() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // World is 320% wide on mobile, 360% on desktop — slightly different to keep nice sight lines
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-72%"]);
  const [progress, setProgress] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setProgress(v));

  // active stop label
  const active = STOPS.reduce((acc, s) => (progress >= s.progress - 0.08 ? s : acc), STOPS[0]);

  return (
    <section
      ref={ref}
      className="relative bg-black"
      style={{ height: reduce ? "auto" : "520vh" }}
      aria-label="The Bombay Bethak journey"
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        {/* sky */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(40,30,20,0.6),transparent_60%),linear-gradient(to_bottom,#0a0807,#000)]" />
        <Stars />
        <Moon />

        {/* moving world — same horizontal scroll on mobile + desktop */}
        <motion.div style={{ x }} className="absolute inset-y-0 left-0 h-full w-[360%] md:w-[360%]">
          <Road progress={progress} />
        </motion.div>

        {/* HUD */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 px-4">
          <div className="text-[10px] tracking-[0.4em] text-white/50 font-script text-base">the journey</div>
          <div className="relative h-[3px] w-44 md:w-64 rounded-full bg-white/15 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-ember"
              style={{ width: `${progress * 100}%` }}
            />
            {STOPS.map((s) => (
              <div key={s.key} className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-white/60 bg-black"
                style={{ left: `calc(${s.progress * 100}% - 5px)` }} />
            ))}
          </div>
          <div className="font-italic-display text-white/80 text-sm md:text-base">{active.name}</div>
        </div>

        {/* hint to scroll */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 text-[10px] tracking-[0.4em] text-white/40">
          KEEP SCROLLING →
        </div>
      </div>
    </section>
  );
}

function Road({ progress }: { progress: number }) {
  // Place the man so he stays roughly centered on the viewport.
  // World is 360% wide. To keep man centered, his "left" within world = progress * (worldWidth - viewport)
  // World width = 360% of viewport, x animates from 0 to -72% of world = -259.2vw of viewport.
  // For simplicity place man at progress along the world (0..100%) — visually he tracks scroll nicely.
  const manLeft = `${4 + progress * 92}%`;

  return (
    <div className="relative h-full w-full">
      {/* curvy road as a single SVG path — full width of world */}
      <svg
        viewBox="0 0 3600 1000"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="roadEdge" x1="0" x2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
        </defs>
        {/* subtle ground */}
        <path d="M0 720 Q900 700 1800 730 Q2700 760 3600 720 L3600 1000 L0 1000 Z" fill="rgba(255,255,255,0.015)" />
        {/* road body */}
        <path
          d="M0 740 Q450 700 900 740 Q1350 780 1800 730 Q2250 680 2700 730 Q3150 770 3600 720"
          stroke="url(#roadEdge)"
          strokeWidth="3"
          fill="none"
        />
        {/* dashed centerline */}
        <path
          d="M0 760 Q450 720 900 760 Q1350 800 1800 750 Q2250 700 2700 750 Q3150 790 3600 740"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="2"
          strokeDasharray="14 22"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      {/* street props scattered along the road */}
      <StreetProp x={6} type="lamp" />
      <StreetProp x={14} type="cup" />
      <StreetProp x={22} type="bench" />
      <StreetProp x={32} type="lamp" />
      <StreetProp x={40} type="tree" />
      <StreetProp x={56} type="bike" />
      <StreetProp x={64} type="lamp" />
      <StreetProp x={72} type="tree" />
      <StreetProp x={80} type="cup" />
      <StreetProp x={92} type="lamp" />

      {/* Stops */}
      {STOPS.map((s, idx) => (
        <div
          key={s.key}
          className="absolute flex flex-col items-center"
          style={{ left: `${s.progress * 92 + 4}%`, bottom: "30%", transform: "translateX(-50%)" }}
        >
          <Shop data={s} index={idx} />
          {/* story card */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="mt-4 w-[260px] md:w-[320px] rounded-3xl border border-white/15 bg-white/[0.03] backdrop-blur-sm px-5 py-4 text-center"
          >
            <div className="text-[10px] tracking-[0.3em] uppercase text-ember">{s.year}</div>
            <div className="mt-1 font-italic-display text-white text-lg md:text-xl">{s.title}</div>
            <div className="mt-2 text-white/65 text-[12px] md:text-sm leading-relaxed">{s.body}</div>
          </motion.div>
        </div>
      ))}

      {/* Walking man */}
      <div className="absolute" style={{ left: manLeft, bottom: "32%", transform: "translateX(-50%)" }}>
        <Man />
      </div>

      {/* End line */}
      <div
        className="absolute font-italic-display text-ember text-2xl md:text-3xl text-right"
        style={{ left: "98%", bottom: "55%", transform: "translateX(-100%)", maxWidth: "260px" }}
      >
        And the story<br />isn't over.
      </div>
    </div>
  );
}
