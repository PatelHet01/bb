import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-black grain">
      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-5 md:px-10 py-5">
        <div className="font-display text-sm tracking-[0.3em] text-white/70">B • B</div>
        <nav className="flex gap-2 md:gap-3">
          <Link to="/my-bethak">
            <Button variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white hover:text-black rounded-none px-4 md:px-5 text-xs md:text-sm tracking-widest uppercase">
              My Bethak
            </Button>
          </Link>
          <Link to="/games">
            <Button variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white hover:text-black rounded-none px-4 md:px-5 text-xs md:text-sm tracking-widest uppercase">
              Games
            </Button>
          </Link>
        </nav>
      </header>

      {/* Smoke particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-white/15 blur-md animate-smoke"
            style={{
              left: `${(i * 7 + 5) % 100}%`,
              animationDelay: `${(i * 0.5) % 6}s`,
              animationDuration: `${6 + (i % 4)}s`,
            }}
          />
        ))}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)" }} />

      {/* Centered title */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="text-[10px] md:text-xs tracking-[0.5em] text-white/50 uppercase mb-6 animate-fade-in">Est. Ahmedabad</div>
        <h1 className="font-display font-black text-white leading-[0.95] text-5xl sm:text-7xl md:text-8xl lg:text-[9rem] tracking-tight animate-fade-in">
          BOMBAY
          <br />
          <span className="text-ember">BETHAK</span>
        </h1>
        <p className="mt-8 md:mt-10 text-white/70 italic font-display text-lg md:text-2xl animate-fade-in-slow">
          Where every sip has a story.
        </p>
        <div className="mt-3 h-px w-24 bg-white/30" />
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 inset-x-0 flex flex-col items-center text-white/60 z-10">
        <span className="text-[10px] tracking-[0.4em] uppercase mb-3">Scroll</span>
        <span className="block h-10 w-px bg-white/40 animate-scroll-hint" />
      </div>
    </section>
  );
};
