import ScrollReveal from "./ScrollReveal";

const features = [
  {
    title: "Know Your Numbers",
    text: "See the KPIs that matter most — revenue, margins, cash flow, expenses, and trends — in one clear view.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <rect x="16" y="18" width="64" height="58" rx="8" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M27 66V48m14 18V37m14 29V43m14 23V30" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M24 82h48" fill="none" stroke="#4DBD36" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "AI That Explains",
    text: "Go beyond dashboards. ClearCFO explains what changed, why it changed, and what deserves your attention.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <path d="M48 12c-17 0-30 13-30 30 0 11 5 20 14 26 4 3 6 7 6 12h20c0-5 2-9 6-12 9-6 14-15 14-26 0-17-13-30-30-30Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M36 80h24M39 86h18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M38 48h7m-3.5-3.5v7m11-10 7 7m-7 0 7-7" fill="none" stroke="#1687C7" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Prioritized Actions",
    text: "Get practical recommendations ranked by financial impact so you know where to spend your time first.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <circle cx="48" cy="48" r="31" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="48" cy="48" r="20" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="48" cy="48" r="9" fill="#4DBD36" />
        <path d="M48 48 76 20m0 0-1 10m1-10-10 1" fill="none" stroke="#4DBD36" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Cash Flow Visibility",
    text: "Understand where cash is going, what is tying it up, and where opportunities may be hiding.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <rect x="14" y="25" width="68" height="46" rx="7" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M14 38h68" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="63" cy="54" r="9" fill="none" stroke="#1687C7" strokeWidth="4" />
        <path d="M58 54h10" stroke="#1687C7" strokeWidth="4" strokeLinecap="round" />
        <path d="M25 82h46" fill="none" stroke="#4DBD36" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Trend & Performance",
    text: "Spot improving and deteriorating trends before they become expensive surprises.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <path d="M15 73h66M21 65 38 49l12 9 25-29" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m64 29 11 0 0 11" fill="none" stroke="#4DBD36" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="38" cy="49" r="4" fill="#1687C7" />
        <circle cx="50" cy="58" r="4" fill="#1687C7" />
      </svg>
    ),
  },
  {
    title: "CFO-Level Thinking",
    text: "Get the kind of financial perspective a growing business needs without adding another full-time salary.",
    icon: (
      <svg viewBox="0 0 96 96" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24">
        <path d="M48 15c-7 0-12 5-12 12v8c-7 4-12 11-12 20 0 13 11 24 24 24s24-11 24-24c0-9-5-16-12-20v-8c0-7-5-12-12-12Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M38 47c3-5 7-7 11-7 5 0 9 2 11 7M39 58h18M42 66h12" fill="none" stroke="#1687C7" strokeWidth="4" strokeLinecap="round" />
        <path d="M48 27v9" stroke="#4DBD36" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">What You Receive</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">What ClearCFO gives you.</h2>
          <p className="mt-4 leading-7 text-slate-600">A clear view of the numbers, the changes that matter, and the actions worth considering next.</p>
        </ScrollReveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <ScrollReveal key={feature.title} delay={index * 90} y={18}>
              <div className="group h-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
                <div className="flex h-24 items-center justify-start text-blue-600 transition-transform duration-300 group-hover:scale-105 sm:h-28">
                  {feature.icon}
                </div>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{feature.title}</h3>
                <p className="mt-3 leading-6 text-slate-600">{feature.text}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
