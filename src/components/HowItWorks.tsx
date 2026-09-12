import ScrollReveal from "./ScrollReveal";

const steps = [
  {
    title: "CONNECT",
    description: "Connect your financial data.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <path d="M24 68h48c9 0 16-7 16-16 0-8-6-15-14-16-2-12-12-20-24-20-11 0-20 7-23 17-10 1-17 8-17 18 0 10 8 17 18 17Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M38 64V48m0 0-6 6m6-6 6 6M50 64V40m0 0-6 6m6-6 6 6M62 64V45m0 0-6 6m6-6 6 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "UNDERSTAND",
    description: "Get CFO-level insights.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <path d="M48 12c-17 0-30 13-30 30 0 11 5 20 14 26 4 3 6 7 6 12h20c0-5 2-9 6-12 9-6 14-15 14-26 0-17-13-30-30-30Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M36 80h24M39 86h18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <rect x="38" y="45" width="6" height="12" rx="1" fill="#1687C7" />
        <rect x="47" y="35" width="6" height="22" rx="1" fill="#4DBD36" />
        <rect x="56" y="42" width="6" height="15" rx="1" fill="#1687C7" />
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
      <ScrollReveal className="mx-auto max-w-3xl text-center">
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
      </ScrollReveal>

      <div className="mt-14 grid gap-0 md:grid-cols-4">
        {steps.map((step, index) => (
          <ScrollReveal key={step.title} delay={index * 110} y={18}>
            <div
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
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
