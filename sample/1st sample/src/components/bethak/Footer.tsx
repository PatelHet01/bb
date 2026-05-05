import { Link } from "react-router-dom";

export const Footer = () => (
  <footer className="relative bg-black text-white px-6 md:px-12 pt-24 pb-6">
    <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16">
      <div>
        <div className="font-display text-4xl md:text-6xl leading-none">
          BOMBAY
          <br />
          <span className="text-ember">BETHAK</span>
        </div>
        <div className="mt-10 space-y-6 text-sm">
          {[
            { n: "Gurukul", a: "Near Gurukul Road, Memnagar, Ahmedabad" },
            { n: "Bhat", a: "Bhat Circle, Gandhinagar Highway, Ahmedabad" },
            { n: "Visat", a: "Visat Circle, Sabarmati, Ahmedabad" },
          ].map((b) => (
            <div key={b.n} className="border-t border-white/15 pt-4">
              <div className="text-ember tracking-[0.3em] text-xs uppercase">{b.n}</div>
              <div className="text-white/60 mt-1">{b.a}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="md:text-right">
        <div className="text-white/40 text-xs tracking-[0.3em] uppercase mb-4">Visit</div>
        <ul className="space-y-3 text-lg font-display">
          <li><Link to="/my-bethak" className="hover:text-ember transition-colors">My Bethak</Link></li>
          <li><Link to="/games" className="hover:text-ember transition-colors">Games</Link></li>
        </ul>
      </div>
    </div>

    <div className="max-w-6xl mx-auto mt-20 pt-6 border-t border-white/15 flex flex-col md:flex-row gap-3 justify-between text-xs text-white/60">
      <div>© {new Date().getFullYear()} Bombay Bethak</div>
      <div className="text-white">⚠️ Tobacco causes cancer. Smoking is injurious to health.</div>
    </div>
  </footer>
);
