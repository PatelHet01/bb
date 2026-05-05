import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader } from "@/components/landing/Loader";
import { Smoke } from "@/components/landing/Smoke";
import { Journey } from "@/components/landing/Journey";
import { SignupForm } from "@/components/landing/SignupForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bombay Bethak — Where every sip has a story" },
      { name: "description", content: "From Gurukul to Bhat to Visat — the story of Bombay Bethak. Three corners. One soul." },
      { property: "og:title", content: "Bombay Bethak" },
      { property: "og:description", content: "Three Shops. One Soul. The story of Bombay Bethak." },
    ],
  }),
  component: Index,
});

function TopButtons() {
  return (
    <div className="fixed top-4 right-4 z-40 flex gap-2 md:top-6 md:right-6">
      <Link to="/" className="rounded-full border border-white/40 bg-black/50 backdrop-blur px-4 py-2 text-[10px] tracking-[0.25em] text-white hover:bg-white hover:text-black transition md:px-5 md:py-2.5 md:text-xs">
        MY BETHAK
      </Link>
      <Link to="/" className="rounded-full border border-white/40 bg-black/50 backdrop-blur px-4 py-2 text-[10px] tracking-[0.25em] text-white hover:bg-white hover:text-black transition md:px-5 md:py-2.5 md:text-xs">
        GAMES
      </Link>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative grain min-h-screen w-full overflow-hidden bg-black">
      <Smoke count={20} />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, letterSpacing: "0.5em" }}
          animate={{ opacity: 1, letterSpacing: "0.18em" }}
          transition={{ duration: 1.6, ease: "easeOut", delay: 0.2 }}
          className="font-display text-5xl leading-none text-white sm:text-7xl md:text-[7.5rem]"
        >
          BOMBAY
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.6 }}
          className="font-display text-5xl leading-none text-white sm:text-7xl md:text-[7.5rem]"
          style={{ letterSpacing: "0.18em" }}
        >
          BETHAK
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="mt-8 font-script text-ember text-2xl md:text-4xl"
        >
          where every sip has a story
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[10px] tracking-[0.4em] text-white/50"
        >
          SCROLL
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="h-10 w-px bg-white/40"
          />
        </motion.div>
      </div>
    </section>
  );
}

function Intro() {
  return (
    <section className="relative flex min-h-screen items-center justify-center bg-black px-6 text-center">
      <div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.2 }}
          className="font-display text-3xl text-white md:text-5xl max-w-3xl mx-auto leading-tight"
        >
          It started with one shop. One corner. One idea.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.2, delay: 0.6 }}
          className="mt-6 text-white/50 tracking-[0.3em] text-xs uppercase"
        >
          This is the story of Bombay Bethak.
        </motion.p>
      </div>
    </section>
  );
}

function ThreeShops() {
  const items = [
    { t: "Paan Parlour", d: "The classic. The original." },
    { t: "Smoke Lounge", d: "Every kind. Every price." },
    { t: "BB Cafe", d: "Chai, snacks, and a seat that stays." },
  ];
  return (
    <section className="relative bg-black px-6 py-24 md:py-40">
      <div className="mx-auto grid max-w-6xl gap-12 md:gap-16 md:grid-cols-2 md:items-center">
        <h2 className="font-display text-5xl leading-[0.95] text-white md:text-7xl">
          Three Shops.<br /><span className="font-script text-ember text-6xl md:text-8xl">one soul.</span>
        </h2>
        <ul className="space-y-5">
          {items.map((it) => (
            <li key={it.t} className="rounded-3xl border border-white/15 bg-white/[0.02] px-6 py-5 transition hover:border-ember/60 hover:bg-white/[0.04]">
              <div className="font-display text-2xl text-white">{it.t}</div>
              <div className="mt-1 text-white/60">{it.d}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Ghoda() {
  return (
    <section className="relative bg-black px-6 py-32 text-center">
      <div className="mx-auto max-w-2xl">
        <div className="mx-auto mb-10 w-[220px]" style={{ animation: "breathe 4s ease-in-out infinite" }}>
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
        <h2 className="font-display text-4xl text-white md:text-6xl leading-tight">Earn GHODA. <span className="font-script text-ember text-5xl md:text-7xl">spend ghoda.</span></h2>
        <p className="mx-auto mt-6 max-w-lg text-white/60">
          Every purchase earns you GHODA coins. Redeem them, bet them, or climb the leaderboard. Your loyalty, rewarded your way.
        </p>
        <a href="/my-bethak" className="mt-10 inline-block rounded-full bg-ember px-8 py-3.5 font-display text-sm tracking-[0.25em] text-black hover:bg-white transition">
          JOIN MY BETHAK
        </a>
      </div>
    </section>
  );
}

function Games() {
  const icons = [
    {
      key: "wheel",
      svg: (
        <svg viewBox="0 0 80 80" className="w-full h-auto">
          <g stroke="white" strokeWidth="1.4" fill="none">
            <circle cx="40" cy="40" r="30" />
            <circle cx="40" cy="40" r="3" fill="white" />
            <path d="M40 10 L40 70 M10 40 L70 40 M19 19 L61 61 M61 19 L19 61" />
            <path d="M40 6 L36 14 L44 14 Z" fill="white" />
          </g>
        </svg>
      ),
    },
    {
      key: "slot",
      svg: (
        <svg viewBox="0 0 80 80" className="w-full h-auto">
          <g stroke="white" strokeWidth="1.4" fill="none">
            <rect x="12" y="18" width="56" height="44" rx="3" />
            <path d="M12 30 L68 30 M12 50 L68 50 M30 18 L30 62 M50 18 L50 62" />
            <circle cx="21" cy="40" r="2" fill="white" />
            <circle cx="40" cy="40" r="2" fill="white" />
            <circle cx="59" cy="40" r="2" fill="white" />
            <path d="M40 18 L40 12 M30 12 L50 12" />
          </g>
        </svg>
      ),
    },
    {
      key: "ox",
      svg: (
        <svg viewBox="0 0 80 80" className="w-full h-auto">
          <g stroke="white" strokeWidth="1.4" fill="none">
            <path d="M28 14 L28 66 M52 14 L52 66 M14 28 L66 28 M14 52 L66 52" />
            <circle cx="40" cy="40" r="6" />
            <path d="M16 16 L26 26 M26 16 L16 26" />
            <path d="M54 54 L64 64 M64 54 L54 64" />
          </g>
        </svg>
      ),
    },
  ];
  return (
    <section className="relative bg-black px-6 py-32 text-center">
      <h2 className="font-display text-4xl text-white md:text-6xl leading-tight">Kill Time. <span className="font-script text-ember text-5xl md:text-7xl">win ghoda.</span></h2>
      <p className="mx-auto mt-4 max-w-xl text-white/60">
        Play while you wait. Spin the wheel. Roll the slots. Challenge a friend to O/X.
      </p>
      <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4 md:gap-8">
        {icons.map(i => (
          <div key={i.key} className="flex aspect-square items-center justify-center rounded-3xl border border-white/15 bg-white/[0.02] p-5 hover:border-ember/60 hover:bg-white/[0.04] transition">
            <div className="w-16 md:w-24">{i.svg}</div>
          </div>
        ))}
      </div>
      <a href="/games" className="mt-12 inline-block rounded-full border border-white px-8 py-3.5 font-display text-sm tracking-[0.25em] text-white hover:bg-white hover:text-black transition">
        PLAY NOW
      </a>
      <div className="mt-4 text-[10px] tracking-[0.25em] text-white/40">
        SIGN UP TO SAVE YOUR COINS AND CLIMB THE LEADERBOARD.
      </div>
    </section>
  );
}

function SignupSection() {
  return (
    <section className="relative bg-black px-6 py-32">
      <div className="mx-auto max-w-3xl rounded-[2.5rem] border border-white/15 bg-white/[0.02] px-6 py-12 md:px-12 md:py-16 text-center">
        <h2 className="font-display text-4xl text-white md:text-6xl leading-tight">Make it <span className="font-script text-ember text-5xl md:text-7xl">your bethak.</span></h2>
        <p className="mx-auto mt-5 max-w-xl text-white/60">
          Join to track your Khata, earn GHODA, and never lose your streak.
        </p>
        <SignupForm />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative bg-black px-6 pt-24 pb-6">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
        <div>
          <div className="font-display text-4xl tracking-[0.15em] text-white md:text-6xl">BOMBAY<br/>BETHAK</div>
          <ul className="mt-10 space-y-4 text-sm text-white/60">
            <li><span className="text-white">Gurukul</span> — Near Gurukul Cross Road, Memnagar, Ahmedabad</li>
            <li><span className="text-white">Bhat</span> — Bhat Circle, Gandhinagar Road, Ahmedabad</li>
            <li><span className="text-white">Visat</span> — Visat Circle, Sabarmati, Ahmedabad</li>
          </ul>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <a href="/my-bethak" className="text-xs tracking-[0.3em] uppercase text-white/70 hover:text-white">My Bethak</a>
          <a href="/games" className="text-xs tracking-[0.3em] uppercase text-white/70 hover:text-white">Games</a>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-6xl border-t border-white/15 pt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[11px] text-white/50">
        <div>© Bombay Bethak</div>
        <div className="text-white/80">⚠ Tobacco causes cancer. Smoking is injurious to health.</div>
      </div>
    </footer>
  );
}

function Index() {
  return (
    <>
      <Loader />
      <TopButtons />
      <main className="relative bg-black text-white">
        <Hero />
        <Intro />
        <Journey />
        <ThreeShops />
        <Ghoda />
        <Games />
        <SignupSection />
        <Footer />
      </main>
    </>
  );
}
