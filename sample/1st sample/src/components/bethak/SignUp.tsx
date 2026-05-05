import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const schema = z.object({
  name: z.string().trim().min(2, "Name too short").max(60),
  username: z.string().trim().min(3, "Pick a Bethak name").max(30).regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, _ only"),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile"),
  dob: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick your date of birth"),
});

export const SignUp = () => {
  const [form, setForm] = useState({ name: "", username: "", mobile: "", dob: "" });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      toast({ title: "Check your details", description: r.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast({ title: "Welcome to your Bethak", description: `OTP sent to +91 ${form.mobile}.` });
    }, 700);
  };

  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <section className="relative bg-black py-32 px-6 grain border-y border-white/10">
      <div className="max-w-3xl mx-auto text-center">
        <div className="text-ember text-xs tracking-[0.4em] uppercase mb-4">Join</div>
        <h2 className="font-display text-4xl md:text-6xl text-white">Make it Your Bethak.</h2>
        <p className="text-white/60 mt-5 max-w-lg mx-auto">
          Join to track your Khata, earn GHODA, and never lose your streak.
        </p>

        <form onSubmit={onSubmit} className="mt-12 grid md:grid-cols-2 gap-4 text-left">
          <Input {...field("name")} placeholder="Your Name" maxLength={60}
            className="bg-transparent border-white/20 rounded-none h-14 text-white placeholder:text-white/30 focus-visible:border-ember focus-visible:ring-0" />
          <Input {...field("username")} placeholder="Bethak Name" maxLength={30}
            className="bg-transparent border-white/20 rounded-none h-14 text-white placeholder:text-white/30 focus-visible:border-ember focus-visible:ring-0" />
          <Input {...field("mobile")} placeholder="Mobile Number" maxLength={10} inputMode="numeric"
            className="bg-transparent border-white/20 rounded-none h-14 text-white placeholder:text-white/30 focus-visible:border-ember focus-visible:ring-0" />
          <Input {...field("dob")} type="date"
            className="bg-transparent border-white/20 rounded-none h-14 text-white placeholder:text-white/30 focus-visible:border-ember focus-visible:ring-0" />
          <Button type="submit" disabled={submitting}
            className="md:col-span-2 h-14 rounded-none bg-white text-black hover:bg-ember tracking-[0.3em] text-xs uppercase">
            {submitting ? "Sending OTP..." : "Join Bombay Bethak"}
          </Button>
        </form>

        <p className="text-white/50 text-sm mt-8">
          Already registered?{" "}
          <Link to="/my-bethak" className="text-white underline underline-offset-4 hover:text-ember">
            Enter My Bethak
          </Link>
        </p>
      </div>
    </section>
  );
};
