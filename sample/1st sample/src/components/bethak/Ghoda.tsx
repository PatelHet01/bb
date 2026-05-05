import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const Ghoda = () => (
  <section className="relative bg-black py-32 px-6 grain overflow-hidden">
    <div className="max-w-4xl mx-auto text-center">
      <svg viewBox="0 0 200 160" className="w-48 md:w-64 mx-auto text-white animate-breathe" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 130 C 40 110, 50 90, 70 80 L 90 60 C 100 45, 115 38, 130 42 L 145 30 L 152 22 L 158 30 L 152 40 L 165 55 C 175 70, 178 90, 172 110 L 168 130 L 158 130 L 156 110 L 140 110 L 138 130 L 128 130 L 126 105 L 90 100 L 70 130 L 60 130 L 65 110 L 40 130 Z" />
        <path d="M152 30 C 158 22, 168 18, 175 22" />
        <path d="M158 30 C 164 24, 170 22, 176 25" />
        <circle cx="155" cy="35" r="0.8" fill="currentColor" />
      </svg>
      <div className="text-ember text-xs tracking-[0.4em] uppercase mt-8 mb-4">Loyalty</div>
      <h2 className="font-display text-4xl md:text-6xl text-white">
        Earn <span className="text-ember">GHODA</span>.
        <br />Spend <span className="text-ember">GHODA</span>.
      </h2>
      <p className="text-white/60 mt-6 max-w-xl mx-auto">
        Every purchase earns you GHODA coins. Redeem them, bet them, or climb the leaderboard.
        Your loyalty, rewarded your way.
      </p>
      <Link to="/my-bethak">
        <Button className="mt-10 rounded-none bg-white text-black hover:bg-ember hover:text-black px-8 py-6 tracking-[0.3em] text-xs uppercase">
          Join My Bethak
        </Button>
      </Link>
    </div>
  </section>
);
