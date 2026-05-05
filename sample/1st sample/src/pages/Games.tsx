import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WheelGame } from "@/components/bethak/games/WheelGame";
import { SlotsGame } from "@/components/bethak/games/SlotsGame";
import { OXGame } from "@/components/bethak/games/OXGame";

type GameKey = "wheel" | "slots" | "ox";

const GAMES: { key: GameKey; name: string; tag: string }[] = [
  { key: "wheel", name: "Wheel of Ghoda", tag: "Spin to win" },
  { key: "slots", name: "Bethak Slots", tag: "Match three" },
  { key: "ox", name: "O / X", tag: "Two players" },
];

const Games = () => {
  const [active, setActive] = useState<GameKey>("wheel");
  const [coins, setCoins] = useState(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem("bb_coins") : null;
    return v ? parseInt(v, 10) : 100;
  });

  const updateCoins = (delta: number) => {
    setCoins((c) => {
      const n = Math.max(0, c + delta);
      localStorage.setItem("bb_coins", String(n));
      return n;
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black text-white grain relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-ember/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-white/5 blur-3xl" />

      <header className="relative px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/" className="font-display text-3xl tracking-wide">
          Bombay <span className="text-ember">Bethak</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="rounded-full border border-ember/40 bg-ember/10 backdrop-blur px-5 py-2 text-xs tracking-[0.3em] uppercase">
            Ghoda <span className="text-ember font-semibold ml-2">{coins}</span>
          </div>
          <Link
            to="/"
            className="rounded-full border border-white/15 hover:border-white/40 px-5 py-2 text-xs tracking-[0.3em] uppercase text-white/70 hover:text-white transition-colors"
          >
            ← Back
          </Link>
        </div>
      </header>

      <section className="relative max-w-5xl mx-auto px-6 py-12">
        <div className="text-ember text-xs tracking-[0.4em] uppercase mb-3">Game Centre</div>
        <h1 className="font-display text-5xl md:text-7xl mb-10 leading-tight">
          Pick your <span className="text-ember">poison.</span>
        </h1>

        <div className="grid grid-cols-3 gap-3 md:gap-5 mb-12">
          {GAMES.map((g) => (
            <button
              key={g.key}
              onClick={() => setActive(g.key)}
              className={`text-left rounded-3xl border p-5 md:p-6 transition-all duration-300 ${
                active === g.key
                  ? "border-ember bg-gradient-to-br from-ember/15 to-transparent shadow-[0_0_40px_-10px_hsl(var(--ember)/0.5)] scale-[1.02]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
              }`}
            >
              <div className="font-display text-xl md:text-2xl">{g.name}</div>
              <div className="text-[10px] md:text-xs tracking-[0.3em] uppercase text-white/50 mt-2">
                {g.tag}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-sm p-6 md:p-12 min-h-[480px] flex items-center justify-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          {active === "wheel" && <WheelGame coins={coins} onCoins={updateCoins} />}
          {active === "slots" && <SlotsGame coins={coins} onCoins={updateCoins} />}
          {active === "ox" && <OXGame />}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <p className="text-white/40 text-xs">
            Ghoda is the in-house token. No real money. No payouts.
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setCoins(100);
              localStorage.setItem("bb_coins", "100");
            }}
            className="rounded-full border border-white/15 hover:border-ember text-xs tracking-[0.3em] uppercase text-white/60 hover:text-ember px-5"
          >
            Reset
          </Button>
        </div>
      </section>
    </main>
  );
};

export default Games;
