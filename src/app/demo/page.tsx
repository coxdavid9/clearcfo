import type { Metadata } from "next";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import GuidedDemo from "../../components/GuidedDemo";

export const metadata: Metadata = {
  title: "See ClearCFO in Action | Guided Financial Clarity Demo",
  description: "Explore a fictional small business financial example: see what changed, why it matters, and which questions to ask next. No account or financial data required.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <Navbar
        loginHref="/login"
        signupHref="/login?signup=1"
        sessionAware
      />
      <GuidedDemo />
      <Footer />
    </main>
  );
}
