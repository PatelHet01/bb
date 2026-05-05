import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Wheel = () => (
  <svg viewBox="0 0 80 80" className="w-16 h-16 md:w-20 md:h-20 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="40" cy="40" r="32" />
    <circle cx="40" cy="40" r="3" fill="currentColor" />
    <line x1="40" y1="8" x2="40" y2="72" />
    <line x1="8" y1="40" x2="72" y2="40" />
    <line x1="17" y1="17" x2="63" y2="63" />
    <line x1="63" y1="17" x2="17" y2="63" />
    <path d="M40 4 L36 12 L44 12 Z" fill="currentColor" />
  </svg>
);
const Slot = () => (
  <svg viewBox="0 0 80 80" className="w-16 h-16 md:w-20 md:h-20 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="12" y="14" width="56" height="58" rx="3" />
    <rect x="20" y="26" width="12" height="20" />
    <rect x="34" y="26" width="12" height="20" />
    <rect x="48" y="26" width="12" height="20" />
    <line x1="30" y1="56" x2="50" y2="56" />
    <path d="M64 30 L72 30 L72 50 L64 50" />
  </svg>
);
const OX = () => (
  <svg viewBox="0 0 80 80" className="w-16 h-16 md:w-20 md:h-20 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="30" y1="10" x2="30" y2="70" />
    <line x1="50" y1="10" x2="50" y2="70" />
    <line x1="10" y1="30" x2="70" y2="30" />
    <line x1="10" y1="50" x2="70" y2="50" />
    <circle cx="20" cy="20" r="6" />
    <line x1="56" y1="56" x2="66" y2="66" />
    <line x1="66" y1="56" x2="56" y2="66" />
  </svg>
);

export const Games = () => (
  <section className="relative bg-black py-32 px-6 grain">
    <div className="max-w-5xl mx-auto text-center">
      <div className="text-ember text-xs tracking-[0.4em] uppercase mb-4">Game Centre</div>
      <h2 className="font-display text-4xl md:text-6xl text-white">
        Kill Time. Win <span className="text-ember">GHODA</span>.
      </h2>
      <p className="text-white/60 mt-6 max-w-xl mx-auto">
        Play while you wait. Spin the wheel. Roll the slots. Challenge a friend to O/X.
      </p>
      <div className="mt-16 grid grid-cols-3 gap-6 md:gap-12 max-w-2xl mx-auto">
        {[{ I: Wheel, n: "Wheel" }, { I: Slot, n: "Slots" }, { I: OX, n: "O / X" }].map(({ I, n }) => (
          <div key={n} className="flex flex-col items-center gap-3 border-t border-white/15 pt-8 hover:border-ember transition-colors">
            <I />
            <span className="text-white/70 tracking-[0.3em] text-[10px] md:text-xs uppercase">{n}</span>
          </div>
        ))}
      </div>
      <Link to="/games">
        <Button className="mt-14 rounded-none bg-white text-black hover:bg-ember px-8 py-6 tracking-[0.3em] text-xs uppercase">
          Play Now
        </Button>
      </Link>
      <p className="text-white/40 text-xs mt-6">Sign up to save your coins and climb the leaderboard.</p>
    </div>
  </section>
);
