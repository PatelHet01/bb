import { useState } from "react";
import { Button } from "@/components/ui/button";

const SYMBOLS = ["♠", "♥", "♦", "♣", "★", "☾"];

const pick = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

export const SlotsGame = ({
  coins,
  onCoins,
}: {
  coins: number;
  onCoins: (delta: number) => void;
}) => {
  const [reels, setReels] = useState(["♠", "♥", "♦"]);
  const [spinning, setSpinning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const spin = () => {
    if (spinning || coins < 15) return;
    onCoins(-15);
    setSpinning(true);
    setMsg(null);

    let ticks = 0;
    const iv = setInterval(() => {
      setReels([pick(), pick(), pick()]);
      ticks++;
      if (ticks > 18) {
        clearInterval(iv);
        const final = [pick(), pick(), pick()];
        setReels(final);
        setSpinning(false);
        if (final[0] === final[1] && final[1] === final[2]) {
          onCoins(150);
          setMsg("JACKPOT — +150 Ghoda");
        } else if (final[0] === final[1] || final[1] === final[2] || final[0] === final[2]) {
          onCoins(30);
          setMsg("Pair — +30 Ghoda");
        } else {
          setMsg("No match");
        }
      }
    }, 80);
  };

  return (
    <div className="flex flex-col items-center gap-10 w-full">
      <div className="rounded-3xl border border-white/20 bg-gradient-to-b from-zinc-900 to-black p-6 md:p-8 flex gap-3 md:gap-5 shadow-[inset_0_2px_20px_rgba(0,0,0,0.8)]">
        {reels.map((r, i) => (
          <div
            key={i}
            className="w-20 h-28 md:w-24 md:h-32 rounded-2xl border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.02] flex items-center justify-center font-display text-5xl md:text-6xl shadow-inner"
            style={{ color: spinning ? "hsl(var(--ember))" : "#fff" }}
          >
            {r}
          </div>
        ))}
      </div>

      <div className="text-center min-h-[2rem]">
        {msg && <div className="font-display text-2xl text-ember">{msg}</div>}
      </div>

      <Button
        onClick={spin}
        disabled={spinning || coins < 15}
        className="rounded-full bg-gradient-to-r from-white to-white/90 text-black hover:from-ember hover:to-ember px-10 py-6 tracking-[0.3em] text-xs uppercase disabled:opacity-40 shadow-[0_10px_40px_-10px_rgba(255,255,255,0.4)] hover:shadow-[0_10px_40px_-10px_hsl(var(--ember)/0.6)] transition-all"
      >
        {spinning ? "Rolling…" : "Roll (15 Ghoda)"}
      </Button>
    </div>
  );
};
