import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export const StoryIntro = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section ref={ref} className="relative min-h-[80vh] flex items-center justify-center bg-black px-6">
      <motion.div style={{ opacity, y }} className="text-center max-w-3xl">
        <p className="font-display text-3xl md:text-5xl text-white leading-tight">
          It started with one shop.
          <br />
          One corner. One idea.
        </p>
        <p className="mt-10 text-white/50 tracking-[0.3em] uppercase text-xs md:text-sm">
          This is the story of Bombay Bethak.
        </p>
      </motion.div>
    </section>
  );
};
