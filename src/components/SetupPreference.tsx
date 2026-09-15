"use client";

import { useEffect, useState } from "react";

const SETUP_PROGRESS_KEY = "clearcfo_setup_progress_visible";

export default function SetupPreference() {
  const [showSetupProgress, setShowSetupProgress] = useState(true);

  useEffect(() => {
    setShowSetupProgress(window.localStorage.getItem(SETUP_PROGRESS_KEY) !== "hidden");
  }, []);

  function toggle() {
    const next = !showSetupProgress;
    setShowSetupProgress(next);
    if (next) {
      window.localStorage.removeItem(SETUP_PROGRESS_KEY);
    } else {
      window.localStorage.setItem(SETUP_PROGRESS_KEY, "hidden");
    }
    window.dispatchEvent(new Event("clearcfo:setup-progress-changed"));
  }

  return (
    <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">CFO Briefing</p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">Setup guide</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Show the three-step setup guide on your CFO Briefing while your account is being set up. QuickBooks and Excel options remain available either way.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showSetupProgress}
          onClick={toggle}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${showSetupProgress ? "bg-blue-600" : "bg-slate-300"}`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${showSetupProgress ? "translate-x-6" : "translate-x-1"}`} />
          <span className="sr-only">{showSetupProgress ? "Hide setup guide" : "Show setup guide"}</span>
        </button>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-400">
        {showSetupProgress ? "Setup guide is visible." : "Setup guide is hidden."}
      </p>
    </section>
  );
}
