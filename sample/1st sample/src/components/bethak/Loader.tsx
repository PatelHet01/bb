import { useEffect, useState } from "react";

export const Loader = ({ onDone }: { onDone: () => void }) => {
  const [visible, setVisible] = useState(true);
  const [text, setText] = useState("");
  const full = "BOMBAY BETHAK";

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setText(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 90);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 600);
    }, 2800);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!visible}
    >
      <svg width="64" height="80" viewBox="0 0 64 80" className="mb-8">
        <path
          d="M32 72 C 12 60, 8 38, 32 8 C 56 38, 52 60, 32 72 Z"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{
            strokeDasharray: 220,
            strokeDashoffset: 220,
            animation: "draw-path 1.6s ease-out 0.2s forwards",
          }}
        />
        <path
          d="M32 60 C 22 52, 22 40, 32 28 C 42 40, 42 52, 32 60 Z"
          fill="white"
          opacity="0"
          style={{ animation: "fade-in-slow 1.2s ease-out 1.6s forwards" }}
        />
      </svg>

      <div className="font-display text-2xl md:text-4xl tracking-[0.25em] text-white relative">
        {text}
        <span className="inline-block w-[2px] h-6 md:h-8 bg-white ml-1 align-middle animate-flicker" />
      </div>

      <div className="absolute inset-x-0 bottom-1/3 flex justify-center pointer-events-none">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute w-2 h-2 rounded-full bg-white/30 blur-sm animate-smoke"
            style={{
              left: `calc(50% + ${(i - 1.5) * 18}px)`,
              animationDelay: `${i * 0.6}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
