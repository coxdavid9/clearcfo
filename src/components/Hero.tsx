import { useState } from "react";

export default function Hero() {
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const steps = [
    ["01", "Upload", "Start with the financial data you already have.", "Bring in the financial workbook you already use. ClearCFO starts with the data you already have rather than requiring a new reporting process."],
    ["02", "Analyze", "ClearCFO identifies trends and exceptions.", "ClearCFO compares periods, surfaces unusual changes, and ranks the financial signals that deserve attention."],
    ["03", "Understand", "See what changed and why it matters.", "Turn a number into context: what changed, what may be driving it, and what management should investigate next."],
    ["04", "Act", "Focus on the decisions worth considering next.", "ClearCFO turns the strongest financial signals into a clear management focus and recommended next step."],
  ] as const;

  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:pb-24 lg:pt-24">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-blue-100/50 blur-3xl" />
      <div className="relative mx-auto max-w-5xl text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
          <span className="h-2 w-2 rounded-full bg-blue-600" /> AI-powered financial intelligence
        </div>
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Your Business Has the Data.<br />
          <span className="text-blue-600">ClearCFO</span> Has the Answers.
        </h1>
        <p className="mx-auto mt-7 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
          ClearCFO turns financial data into clear insights, prioritized actions, and better decisions — without hiring a full-time CFO.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="#how-it-works" className="rounded-xl bg-blue-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">See How It Works →</a>
        </div>
      </div>

      <div className="relative mx-auto mt-14 max-w-6xl sm:mt-16">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.35)] sm:p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ClearCFO intelligence</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">From financial data to a clearer decision.</h2>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {steps.map(([number, title, text, detail]) => {
                const active = activeStep === number;
                const muted = activeStep !== null && !active;
                return (
                  <button
                    key={number}
                    type="button"
                    aria-expanded={active}
                    onClick={() => setActiveStep(active ? null : number)}
                    className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${
                      active
                        ? "border-blue-300 bg-blue-50/60 shadow-lg shadow-blue-900/5 md:-translate-y-1"
                        : muted
                          ? "border-slate-200 opacity-75 hover:opacity-100"
                          : "border-slate-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
                    }`}
                  >
                    <span className="text-xs font-bold text-blue-600">{number}</span>
                    <h3 className="mt-2 text-sm font-bold text-slate-900">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
                    {active && (
                      <p className="mt-3 border-t border-blue-100 pt-3 text-xs leading-5 text-slate-600">{detail}</p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-white p-5 text-left">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Example management insight</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Inventory is growing faster than revenue.</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">Monitor</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">ClearCFO surfaces the issue, explains why it matters, and helps management focus on what to investigate or act on next.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
