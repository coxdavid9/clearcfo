import ScrollReveal from "./ScrollReveal";

const features = [
  {
    title: "Know Your Numbers",
    text: "See the KPIs that matter most — revenue, margins, cash flow, expenses, and trends — in one clear view.",
    icon: "/icons/feature-know-your-numbers.svg",
  },
  {
    title: "AI That Explains",
    text: "Go beyond dashboards. ClearCFO explains what changed, why it changed, and what deserves your attention.",
    icon: "/icons/feature-ai-explains.svg",
  },
  {
    title: "Prioritized Actions",
    text: "Get practical recommendations ranked by financial impact so you know where to spend your time first.",
    icon: "/icons/feature-prioritized-actions.svg",
  },
  {
    title: "Cash Flow Visibility",
    text: "Understand where cash is going, what is tying it up, and where opportunities may be hiding.",
    icon: "/icons/feature-cash-flow.svg",
  },
  {
    title: "Trend & Performance",
    text: "Spot improving and deteriorating trends before they become expensive surprises.",
    icon: "/icons/feature-trend-performance.svg",
  },
  {
    title: "CFO-Level Thinking",
    text: "Get the kind of financial perspective a growing business needs without adding another full-time salary.",
    icon: "/icons/feature-cfo-thinking.svg",
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
                <div className="flex h-24 items-center justify-center transition-transform duration-300 group-hover:scale-105 sm:h-28">
                  <img src={feature.icon} alt="" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24" />
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
