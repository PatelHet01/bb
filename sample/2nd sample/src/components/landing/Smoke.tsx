export function Smoke({ count = 18, className = "" }: { count?: number; className?: string }) {
  const particles = Array.from({ length: count });
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {particles.map((_, i) => {
        const left = (i * 53) % 100;
        const delay = (i * 0.7) % 8;
        const dur = 8 + ((i * 1.3) % 6);
        const size = 80 + ((i * 17) % 140);
        const dx = ((i % 2 === 0 ? 1 : -1) * (20 + (i % 5) * 10)) + "px";
        return (
          <span
            key={i}
            style={{
              left: `${left}%`,
              bottom: "-10%",
              width: size,
              height: size,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
              ["--dx" as any]: dx,
            }}
            className="absolute rounded-full bg-white/[0.04] blur-2xl animate-[drift_linear_infinite]"
          />
        );
      })}
    </div>
  );
}
