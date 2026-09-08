export default function Hero() {
  const metrics = [
    ["Revenue", "$933,000", "↓ 6.7%", "border-red-100 bg-red-50/40", "text-red-600"],
    ["Inventory", "$344,000", "↑ 14.7%", "border-amber-100 bg-amber-50/40", "text-amber-600"],
    ["Cash", "$440,000", "↓ 12.0%", "border-red-100 bg-red-50/40", "text-red-600"],
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ClearCFO intelligence</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">What ClearCFO finds.</h2>
                <p className="mt-1 text-sm text-slate-500">A quick read on the financial signals that deserve attention.</p>
              </div>
              <span className="w-fit rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">3 signals need attention</span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {metrics.map(([label, value, change, tone, changeTone]) => (
                <div key={label} className={`rounded-2xl border p-5 text-left ${tone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-600">{label}</p>
                    <span className={`text-xs font-bold ${changeTone}`}>{change}</span>
                  </div>
                  <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
                  <p className="mt-1 text-xs text-slate-500">vs. prior period</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-5 text-left shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">ClearCFO recommendation</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">Review inventory aging, purchasing cadence, and demand support.</h3>
                </div>
                <span className="w-fit shrink-0 rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">Priority</span>
              </div>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                Inventory is growing faster than revenue while cash is declining. ClearCFO surfaces the relationship, explains why it matters, and focuses management on what to investigate next.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">Evidence-based</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">Prioritized</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">Management-ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
