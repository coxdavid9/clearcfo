import { useEffect, useState } from "react";

type OnboardingStep = "welcome" | "connect" | "building";
type Source = "quickbooks" | "excel";

export default function OnboardingFlow({
  step,
  source,
  error,
  onUpload,
  onBack,
}: {
  step: OnboardingStep;
  source?: Source;
  error?: string;
  onUpload: () => void;
  onBack?: () => void;
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (step !== "building") {
      setStage(0);
      return;
    }
    const timings = source === "quickbooks" ? [2500, 5000, 7500] : [2500, 5000];
    const timers = timings.map((delay, index) => window.setTimeout(() => setStage(index + 1), delay));
    return () => timers.forEach(window.clearTimeout);
  }, [step, source]);

  if (step === "building") {
    const statuses = source === "quickbooks"
      ? ["Connecting to QuickBooks…", "Reading your chart of accounts…", "Analyzing trends and cash flow…", "Writing your takeaway…"]
      : ["Reading your workbook…", "Analyzing trends and cash flow…", "Writing your takeaway…"];
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-600">✦</div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">Building your CFO Briefing…</h2>
        <div className="mx-auto mt-7 h-2 max-w-md overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-600" />
        </div>
        <div className="mx-auto mt-6 max-w-md space-y-2 text-left">
          {statuses.map((status, index) => <p key={status} className={index <= stage ? "text-sm font-medium text-slate-800" : "text-sm text-slate-300"}>{status}</p>)}
        </div>
        {error && <p className="mx-auto mt-6 max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</p>}
      </div>
    );
  }

  if (step === "welcome") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">WELCOME TO CLEARCFO</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Let&apos;s build your CFO Briefing.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Connect your financial data once. ClearCFO turns it into a plain-English briefing — the takeaway, what needs attention, and the numbers behind it.</p>
        <div className="mt-8 space-y-5">
          {[
            ["1", "Connect your data", "QuickBooks or a spreadsheet — your choice."],
            ["2", "We analyze it", "Trends, cash flow, margins, and risks, computed every sync."],
            ["3", "You get the briefing", "One page. Plain English. Ready when you are."],
          ].map(([number, title, copy]) => <div key={number} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">{number}</span><div><p className="font-semibold text-slate-900">{title}</p><p className="mt-1 text-sm text-slate-500">{copy}</p></div></div>)}
        </div>
        <button type="button" onClick={() => { localStorage.setItem("clearcfo_onboarding_seen", "1"); window.dispatchEvent(new CustomEvent("clearcfo:onboarding-connect")); }} className="mt-8 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700">Connect your data →</button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-600">✦</div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">CLEARCFO INTELLIGENCE</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Your CFO Briefing starts with your data.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Connect your financial data to generate KPIs, trends, exceptions, and prioritized recommendations.</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <a href="/api/quickbooks/connect" onClick={() => sessionStorage.setItem("clearcfo_onboarding_syncing", "1")} className="rounded-2xl border border-blue-600 bg-blue-600 p-5 text-left text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700">
          <p className="font-semibold">Connect QuickBooks</p><p className="mt-1 text-sm text-blue-100">Live sync — always up to date.</p>
        </a>
        <button type="button" onClick={onUpload} className="rounded-2xl border border-slate-300 bg-white p-5 text-left text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-slate-50">
          <p className="font-semibold">Upload Financial Data</p><p className="mt-1 text-sm text-slate-500">No QuickBooks? Upload a P&amp;L and balance sheet.</p>
        </button>
      </div>
      {onBack && <button type="button" onClick={onBack} className="mt-6 text-sm font-semibold text-slate-500 hover:text-slate-800">← Back</button>}
      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm leading-6 text-red-800">{error}</div>}
    </div>
  );
}
