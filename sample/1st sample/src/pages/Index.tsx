import { useEffect, useState } from "react";
import { Loader } from "@/components/bethak/Loader";
import { Hero } from "@/components/bethak/Hero";
import { StoryIntro } from "@/components/bethak/StoryIntro";
import { RoadJourney } from "@/components/bethak/RoadJourney";
import { ThreeShops } from "@/components/bethak/ThreeShops";
import { Ghoda } from "@/components/bethak/Ghoda";
import { Games } from "@/components/bethak/Games";
import { SignUp } from "@/components/bethak/SignUp";
import { Footer } from "@/components/bethak/Footer";

const Index = () => {
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("bb_visited");
  });

  useEffect(() => {
    if (loading) sessionStorage.setItem("bb_visited", "1");
    document.documentElement.classList.add("dark");
  }, [loading]);

  return (
    <main className="bg-black text-white">
      {loading && <Loader onDone={() => setLoading(false)} />}
      <Hero />
      <StoryIntro />
      <RoadJourney />
      <ThreeShops />
      <Ghoda />
      <Games />
      <SignUp />
      <Footer />
    </main>
  );
};

export default Index;
