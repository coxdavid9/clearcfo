"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import HowItWorks from "../components/HowItWorks";
import Features from "../components/Features";
import Pricing from "../components/Pricing";
import WhyClearCFO from "../components/WhyClearCFO";
import Footer from "../components/Footer";
import Contact from "../components/Contact";
import CFOBriefing from "../components/CFOBriefing";
import TrendDetailOverlay from "../components/TrendDetailOverlay";

export default function Home() {
  const [customerMode, setCustomerMode] = useState(false);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, []);

  if (customerMode) {
    return (
      <main id="customer" className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar
          onLogin={() => setCustomerMode(false)}
          loginLabel="Back to Home"
        />
        <CFOBriefing />
        <TrendDetailOverlay enabled={customerMode} />
      </main>
    );
  }

  return (
    <main id="top" className="min-h-screen bg-white text-slate-900">
      <Navbar onLogin={() => setCustomerMode(true)} loginLabel="Log In" />

      <section id="product" className="scroll-mt-24 bg-gradient-to-b from-blue-50/70 via-white to-white">
        <Hero />
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-y border-slate-200/70 bg-white">
        <HowItWorks />
      </section>

      <section id="what-you-receive" className="scroll-mt-24 bg-slate-50/70">
        <Features />
      </section>

      <WhyClearCFO />

      <section id="pricing" className="scroll-mt-24">
        <Pricing />
      </section>

      <Contact />

      <Footer />
    </main>
  );
}
