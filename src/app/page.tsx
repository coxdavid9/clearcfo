"use client";

import { useLayoutEffect } from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import HowItWorks from "../components/HowItWorks";
import Features from "../components/Features";
import Pricing from "../components/Pricing";
import WhyClearCFO from "../components/WhyClearCFO";
import Footer from "../components/Footer";
import Contact from "../components/Contact";

export default function Home() {
  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    const resetScroll = () => window.scrollTo(0, 0);
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);

    return () => {
      window.cancelAnimationFrame(frame);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  return (
    <main id="top" className="min-h-screen bg-white text-slate-900">
      <Navbar loginHref="/login" loginLabel="Log In" signupHref="/login?mode=signup" signupLabel="Sign Up" sessionAware />
      <section id="product" className="scroll-mt-24 bg-gradient-to-b from-blue-50/70 via-white to-white"><Hero /></section>
      <section id="how-it-works" className="scroll-mt-24 border-y border-slate-200/70 bg-white"><HowItWorks /></section>
      <section id="what-you-receive" className="scroll-mt-24 bg-slate-50/70"><Features /></section>
      <WhyClearCFO />
      <section id="pricing" className="scroll-mt-24"><Pricing /></section>
      <Contact />
      <Footer />
    </main>
  );
}
