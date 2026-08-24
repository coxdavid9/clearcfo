const features = [
  {
    icon: "📊",
    title: "Know Your Numbers",
    text: "See the KPIs that matter most — revenue, margins, cash flow, expenses, and trends — in one clear view.",
  },
  {
    icon: "🤖",
    title: "AI That Explains",
    text: "Go beyond dashboards. ClearCFO explains what changed, why it changed, and what deserves your attention.",
  },
  {
    icon: "🎯",
    title: "Prioritized Actions",
    text: "Get practical recommendations ranked by financial impact so you know where to spend your time first.",
  },
  {
    icon: "💵",
    title: "Cash Flow Visibility",
    text: "Understand where cash is going, what is tying it up, and where opportunities may be hiding.",
  },
  {
    icon: "📈",
    title: "Trend & Performance",
    text: "Spot improving and deteriorating trends before they become expensive surprises.",
  },
  {
    icon: "🧠",
    title: "CFO-Level Thinking",
    text: "Get the kind of financial perspective a growing business needs without adding another full-time salary.",
  },
];

export default function Features() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">What You Receive</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">What ClearCFO gives you.</h2>
          <p className="mt-4 leading-7 text-slate-600">A clear view of the numbers, the changes that matter, and the actions worth considering next.</p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl transition-all duration-300 group-hover:bg-blue-100 group-hover:scale-105">{feature.icon}</div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{feature.title}</h3>
              <p className="mt-3 leading-6 text-slate-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
