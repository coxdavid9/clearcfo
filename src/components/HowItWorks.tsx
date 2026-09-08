const steps = [
  {
    title: "CONNECT",
    description: "Connect your financial data.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <path d="M24 68h48c9 0 16-7 16-16 0-8-6-15-14-16-2-12-12-20-24-20-11 0-20 7-23 17-10 1-17 8-17 18 0 10 8 17 18 17Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M38 64V48m0 0-6 6m6-6 6 6M50 64V40m0 0-6 6m6-6 6 6M62 64V45m0 0-6 6m6-6 6 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M72 24v14m0 0-6-6m6 6 6-6" fill="none" stroke="#4DBD36" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "UNDERSTAND",
    description: "Get CFO-level insights.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <path d="M31 74c-2-7-2-13-1-19-5-5-8-12-8-20 0-15 12-27 27-27 14 0 26 11 26 25 0 8-4 15-10 20-4 3-7 8-7 14v7H31Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M48 29v20m0 0-7-7m7 7 7-7M38 61h22" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="38" y="35" width="5" height="10" rx="1" fill="currentColor" />
        <rect x="46" y="30" width="5" height="15" rx="1" fill="#1687C7" />
        <rect x="54" y="25" width="5" height="20" rx="1" fill="#4DBD36" />
      </svg>
    ),
  },
  {
    title: "IDENTIFY",
    description: "See what's driving profit and performance.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <circle cx="48" cy="43" r="25" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="m66 61 15 15" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        <rect x="34" y="43" width="6" height="13" rx="1" fill="currentColor" />
        <rect x="45" y="35" width="6" height="21" rx="1" fill="#1687C7" />
        <rect x="56" y="39" width="6" height="17" rx="1" fill="#4DBD36" />
      </svg>
    ),
  },
  {
    title: "IMPROVE",
    description: "Make better decisions.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <circle cx="45" cy="49" r="28" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="45" cy="49" r="17" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="45" cy="49" r="7" fill="#4DBD36" />
        <path d="m45 49 31-31m0 0-1 11m1-11-11 1" fill="none" stroke="#4DBD36" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
] as const;

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          How It Works
        </p>

        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          From Financial Data to Clear Decisions.
        </h2>

        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">
          ClearCFO turns your financial data into insights you can actually
          use — without spending hours digging through reports.
        </p>
      </div>

      <div className="mt-14 grid gap-0 md:grid-cols-4">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={`group px-6 py-6 text-center transition-transform duration-300 hover:-translate-y-1 sm:px-8 ${
              index > 0 ? "border-slate-200 md:border-l" : ""
            }`}
          >
            <div className="mx-auto flex h-24 items-center justify-center text-blue-600 transition-transform duration-300 group-hover:scale-105 sm:h-28">
              {step.icon}
            </div>

            <h3 className="mt-4 text-xl font-extrabold tracking-wide text-[#0B2F8A]">
              {step.title}
            </h3>

            <p className="mx-auto mt-3 max-w-[220px] text-base leading-6 text-slate-600">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
