import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const KEY = "bb_loader_seen_v1";

export function Loader() {
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = sessionStorage.getItem(KEY);
    if (seen) {
      setShow(false);
      return;
    }
    setShow(true);
    const t = setTimeout(() => {
      sessionStorage.setItem(KEY, "1");
      setShow(false);
    }, 2800);
    return () => clearTimeout(t);
  }, []);

  const text = "BOMBAY BETHAK";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black"
        >
          <svg width="64" height="80" viewBox="0 0 64 80" fill="none" className="mb-8">
            <motion.path
              d="M32 6 C 22 22, 18 32, 26 44 C 14 42, 12 56, 24 66 C 16 70, 20 78, 32 78 C 44 78, 48 70, 40 66 C 52 56, 50 42, 38 44 C 46 32, 42 22, 32 6 Z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.6, ease: "easeInOut" }}
            />
            <motion.circle
              cx="32" cy="60" r="3" fill="var(--ember)"
              initial={{ opacity: 0 }} animate={{ opacity: [0,1,0.7,1] }}
              transition={{ delay: 1.2, duration: 1.6 }}
            />
          </svg>

          <div className="font-display text-2xl md:text-4xl tracking-[0.25em] text-white">
            {text.split("").map((ch, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.06, duration: 0.3 }}
              >
                {ch === " " ? "\u00A0" : ch}
              </motion.span>
            ))}
          </div>

          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "120px" }}
            transition={{ delay: 0.4, duration: 2.2 }}
            className="mt-6 h-px bg-white/30"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
