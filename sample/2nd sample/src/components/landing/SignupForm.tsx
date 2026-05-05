import { motion } from "framer-motion";
import { useState } from "react";

export function SignupForm() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
      className="mx-auto mt-10 grid w-full max-w-xl gap-4"
    >
      {submitted ? (
        <div className="text-center font-display text-2xl text-ember">
          Welcome to your Bethak.
        </div>
      ) : (
        <>
          <Field label="Name" name="name" />
          <Field label="Bethak Name" name="username" placeholder="your public game name" />
          <Field label="Mobile Number" name="mobile" type="tel" maxLength={10} pattern="[0-9]{10}" />
          <Field label="Date of Birth" name="dob" type="date" />
          <button
            type="submit"
            className="mt-2 rounded-full bg-ember px-6 py-3.5 font-display text-base tracking-widest text-black transition hover:bg-white"
          >
            JOIN BOMBAY BETHAK
          </button>
          <a href="/my-bethak" className="mt-2 text-center text-xs uppercase tracking-[0.3em] text-white/50 hover:text-white">
            Already registered? Enter My Bethak →
          </a>
        </>
      )}
    </form>
  );
}

function Field({ label, name, type = "text", ...rest }: any) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.3em] text-white/50">{label}</span>
      <input
        name={name}
        type={type}
        required
        {...rest}
        className="w-full rounded-full border border-white/20 bg-white/[0.03] px-5 py-3 text-white outline-none placeholder:text-white/30 focus:border-ember focus:bg-white/[0.06] transition"
      />
    </label>
  );
}
