"use client";

import { useEffect, useState } from "react";

const ONBOARDING_SEEN_KEY = "clearcfo_setup_onboarding_seen";

export default function SetupGate() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const seen = window.localStorage.getItem(ONBOARDING_SEEN_KEY) === "true";
    setShowOnboarding(!seen);
    setReady(true);
  }, []);

  function dismissOnboarding() {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
    setShowOnboarding(false);
  }

  if (!ready) return null;

  return (
    <>
      {showOnboarding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-5 py-6 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="setup-onboarding-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Welcome to ClearCFO</p>
                <h2 id="setup-onboarding-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Let&apos;s get your CFO Briefing ready</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">There are three simple steps to get started.</p>
              </div>
              <button type="button" onClick={dismissOnboarding} aria-label="Close setup guide" className="rounded-xl border border-slate-200 px-3 py-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800">✕</button>
            </div>

            <ol className="mt-6 space-y-3">
              <li className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">✓</span><div><p className="font-semibold text-slate-900">Create account</p><p className="text-sm text-slate-600">Your secure ClearCFO workspace is ready.</p></div></div>
              </li>
              <li className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">2</span><div><p className="font-semibold text-slate-900">Choose your data source</p><p className="text-sm text-slate-600">Connect QuickBooks Online or upload an Excel workbook.</p></div></div>
              </li>
              <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-500">3</span><div><p className="font-semibold text-slate-900">Review your briefing</p><p className="text-sm text-slate-600">Once your financial data is provided, ClearCFO builds your analysis.</p></div></div>
              </li>
            </ol>

            <button type="button" onClick={dismissOnboarding} className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">Got it — let&apos;s get started</button>
            <p className="mt-3 text-center text-xs text-slate-400">You can find this setup guide anytime in Profile.</p>
          </section>
        </div>
      )}
    </>
  );
}
