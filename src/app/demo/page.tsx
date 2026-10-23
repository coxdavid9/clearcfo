import type { Metadata } from "next";
import Navbar from "../../components/Navbar";
import CFOBriefing from "../../components/CFOBriefing";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "ClearCFO Demo | Preview the Real CFO Briefing",
  description: "Explore ClearCFO's real CFO Briefing interface with fictional financial data. No account or financial data is required.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar loginHref="/login" signupHref="/login?signup=1" />
      <section className="border-b border-blue-200 bg-blue-50 px-5 py-5 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Preview ClearCFO</p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                This is what your CFO Briefing looks like.
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                You are viewing the same dashboard component our customers use, filled with clearly fictional figures.
                Tap any KPI to switch its chart and breakdown. This page is read-only and never connects to customer accounts.
              </p>
            </div>
            <a href="/contact" className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
              Request a walkthrough →
            </a>
          </div>
        </div>
      </section>
      <CFOBriefing demoMode />
      <div className="border-t border-slate-200 bg-white px-5 py-10 text-center sm:px-8">
        <p className="mx-auto max-w-3xl text-sm leading-6 text-slate-600">
          Sample business and amounts are fictional. No uploaded books, QuickBooks connection, live AI request,
          subscription, or customer records are used for this preview.
        </p>
        <a href="/contact" className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:text-blue-800">
          Talk to ClearCFO about your business →
        </a>
      </div>
      <Footer />
    </main>
  );
}
