const plans = [
  {
    name: "Core",
    price: "$39",
    description: "For owners who want a clear view of performance and the issues that deserve attention.",
    features: ["KPI dashboard", "Financial drivers", "Financial trends", "ClearCFO recommendations", "Priority insights"],
  },
  {
    name: "Pro",
    price: "$79",
    description: "For businesses that want deeper decision support and more financial planning tools.",
    features: ["Everything in Core", "Deeper financial analysis", "Expanded historical insights", "Priority decision support", "Forecasting", "Priority insights"],
    popular: true,
  },
];

export default function Pricing() {
  return (
    <section className="border-y border-slate-200 bg-slate-50/70 px-5 py-20 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Pricing</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Simple pricing. Serious financial clarity.</h2>
          <p className="mt-4 leading-7 text-slate-600">Two straightforward levels. Start with the visibility you need and move up when you need deeper decision support.</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative flex flex-col rounded-2xl bg-white p-7 shadow-sm ${plan.popular ? "border-2 border-blue-600 shadow-lg shadow-blue-600/10" : "border border-slate-200"}`}>
              {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">MOST POPULAR</div>}
              <h3 className="text-xl font-bold text-slate-900">ClearCFO {plan.name}</h3>
              <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
              <p className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900">
                {plan.price}<span className="text-base font-medium text-slate-500">/mo</span>
              </p>
              <ul className="mt-7 space-y-3 text-sm text-slate-600">
                {plan.features.map((feature) => <li key={feature} className="flex gap-2"><span className="font-bold text-emerald-600">✓</span>{feature}</li>)}
              </ul>
              <a href="#contact" className={`mt-8 rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${plan.popular ? "bg-blue-600 text-white hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md" : "border border-slate-300 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm"}`}>
                Get Started
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
