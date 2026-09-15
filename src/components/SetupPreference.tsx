"use client";

import { useEffect, useState } from "react";

const SETUP_PROGRESS_KEY = "clearcfo_setup_progress_visible";

const steps = [
  [1, "Create account", "Your ClearCFO workspace is ready."],
  [2, "Choose your data source", "Connect QuickBooks Online or upload an Excel workbook."],
  [3, "Review your briefing", "Once your financial data is provided, ClearCFO builds your analysis."],
] as const;

export default function SetupPreference() {
  const [showOnBriefing, setShowOnBriefing] = useState(false);

  useEffect(() => {
    setShowOnBriefing(window.localStorage.getItem(SETUP_PROGRESS_KEY) !== "hidden");
  }, []);

  function toggleBriefingGuide() {
    const next = !showOnBriefing;
    setShowOnBriefing(next);
    if (next) window.localStorage.removeItem(SETUP_PROGRESS_KEY);
    else window.localStorage.setItem(SETUP_PROGRESS_KEY, "hidden");
    window.dispatchEvent(new Event("clearcfo:setup-progress-changed"));
  }

  return (
    <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">CFO Briefing</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Setup guide</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Your complete three-step setup guide. It lives here after the initial welcome popup.</p>
      </div>

      <div className="grid gap-3 px-5 py-5 sm:px-7 sm:py-6">
        {steps.map(([number, title, detail], index) => {
          const complete = index < 1;
          const current = index === 1;
          return (
            <div key={number} className={`rounded-2xl border p-4 ${complete ? "border-emerald-200 bg-emerald-50/70" : current ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${complete ? "bg-emerald-600 text-white" : current ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {complete ? "✓" : number}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="mt-0.5 text-sm leading-5 text-slate-600">{detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 px-5 py-4 sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Show setup guide on CFO Briefing</p>
            <p className="mt-0.5 text-xs text-slate-500">QuickBooks and Excel options are never hidden by this setting.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showOnBriefing}
            onClick={toggleBriefingGuide}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${showOnBriefing ? "bg-blue-600" : "bg-slate-300"}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${showOnBriefing ? "translate-x-6" : "translate-x-1"}`} />
            <span className="sr-only">{showOnBriefing ? "Hide setup guide on CFO Briefing" : "Show setup guide on CFO Briefing"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
