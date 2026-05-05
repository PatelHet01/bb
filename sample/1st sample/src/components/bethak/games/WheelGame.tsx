import { useState } from "react";
import { Button } from "@/components/ui/button";

const SLICES = [
  { label: "+50", value: 50 },
  { label: "0", value: 0 },
  { label: "+10", value: 10 },
  { label: "-20", value: -20 },
  { label: "+100", value: 100 },
  { label: "+5", value: 5 },
  { label: "-10", value: -10 },
  { label: "+25", value: 25 },
];

const SLICE_DEG = 360 / SLICES.length;

export const WheelGame = ({
  coins,
  onCoins,
}: {
  coins: number;
  onCoins: (delta: number) => void;
}) => {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const spin = () => {
    if (spinning || coins < 10) return;
    setSpinning(true);
    setResult(null);
    onCoins(-10);
    const idx = Math.floor(Math.random() * SLICES.length);
    const target = 360 * 6 + (360 - idx * SLICE_DEG - SLICE_DEG / 2);
    const newAngle = angle + target;
    setAngle(newAngle);
    setTimeout(() => {
      const slice = SLICES[idx];
      if (slice.value !== 0) onCoins(slice.value);
      setResult(slice.label === "0" ? "No luck" : `${slice.label} Ghoda`);
      setSpinning(false);
    }, 4200);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      <div className="relative w-72 h-72 md:w-80 md:h-80">
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 z-10"
          style={{
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            borderTop: "16px solid hsl(var(--ember))",
          }}
        />
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.2, 1)" : "none",
          }}
        >
          {SLICES.map((s, i) => {
            const start = i * SLICE_DEG;
            const end = start + SLICE_DEG;
            const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
            const x1 = 100 + 95 * Math.cos(toRad(start));
            const y1 = 100 + 95 * Math.sin(toRad(start));
            const x2 = 100 + 95 * Math.cos(toRad(end));
            const y2 = 100 + 95 * Math.sin(toRad(end));
            const mid = start + SLICE_DEG / 2;
            const tx = 100 + 60 * Math.cos(toRad(mid));
            const ty = 100 + 60 * Math.sin(toRad(mid));
            const fill = i % 2 === 0 ? "#000" : "#111";
            return (
              <g key={i}>
                <path
                  d={`M100 100 L${x1} ${y1} A95 95 0 0 1 ${x2} ${y2} Z`}
                  fill={fill}
                  stroke="#fff"
                  strokeWidth="0.6"
                />
                <text
                  x={tx}
                  y={ty}
                  fill="#fff"
                  fontSize="11"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${mid} ${tx} ${ty})`}
                  fontFamily="Inter, sans-serif"
                  fontWeight="600"
                >
                  {s.label}
                </text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="10" fill="hsl(var(--ember))" />
        </svg>
      </div>

      <div className="text-center min-h-[2rem]">
        {result && <div className="font-display text-3xl text-ember">{result}</div>}
      </div>

      <Button
        onClick={spin}
        disabled={spinning || coins < 10}
        className="rounded-full bg-gradient-to-r from-white to-white/90 text-black hover:from-ember hover:to-ember hover:text-black px-10 py-6 tracking-[0.3em] text-xs uppercase disabled:opacity-40 shadow-[0_10px_40px_-10px_rgba(255,255,255,0.4)] hover:shadow-[0_10px_40px_-10px_hsl(var(--ember)/0.6)] transition-all"
      >
        {spinning ? "Spinning…" : "Spin (10 Ghoda)"}
      </Button>
    </div>
  );
};
