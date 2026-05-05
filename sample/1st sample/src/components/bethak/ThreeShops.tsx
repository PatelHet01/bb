export const ThreeShops = () => (
  <section className="relative bg-black py-32 px-6 md:px-12 grain">
    <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-start">
      <div>
        <div className="text-ember text-xs tracking-[0.4em] uppercase mb-4">What is Bombay Bethak</div>
        <h2 className="font-display text-5xl md:text-7xl leading-[0.95] text-white">
          Three Shops.
          <br />
          One <span className="text-ember">Soul</span>.
        </h2>
      </div>
      <div className="space-y-10 pt-4">
        {[
          { t: "Paan Parlour", d: "The classic. The original." },
          { t: "Smoke Lounge", d: "Every kind. Every price." },
          { t: "BB Cafe", d: "Chai, snacks, and a seat that stays." },
        ].map((v, i) => (
          <div key={v.t} className="border-t border-white/15 pt-6">
            <div className="flex items-baseline gap-4">
              <span className="font-display text-white/30 text-sm">0{i + 1}</span>
              <h3 className="font-display text-2xl md:text-3xl text-white">{v.t}</h3>
            </div>
            <p className="text-white/55 mt-2 ml-8">{v.d}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
