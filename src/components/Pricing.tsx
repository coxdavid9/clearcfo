import ScrollReveal from "./ScrollReveal";

const plans = [
  {
    name: "Core",
    price: "$39",
    description: "For owners who want to truly understand their numbers.",
    features: [
      "CFO briefing in plain English",
      "Revenue & margin analysis",
      "Expense analysis",
      "Cash & working capital",
      "Customer & vendor movers",
      "AI recommendations with dollar impact",
    ],
  },
  {
    name: "Pro",
    price: "$79",
    description: "For owners who want ClearCFO working for them every week — not just when they log in.",
    features: [
      "Everything in Core",
      "Weekly CFO report by email",
      "Automatic syncing, always current",
      "Proactive alerts before issues grow",
      "Custom alerts on your own thresholds",
      "Up to 5 businesses in one login",
      "Budget vs. actuals",
    ],
    popular: true,
  },
];

export default function Pricing() {
  return (
    <section className="border-y border-slate-200 bg-slate-50/70 px-5 py-20 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Simple pricing. Serious financial clarity.</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Understand what is happening in your business with Core, or let ClearCFO work for you every week with Pro.
            </p>
            <p className="mt-4 font-semibold text-blue-700">7-day free trial · Credit card required</p>
          </div>
        </ScrollReveal>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {plans.map((plan, index) => (
            <ScrollReveal key={plan.name} delay={index * 120}>
              <div className={`relative flex h-full flex-col rounded-2xl bg-white p-7 shadow-sm ${plan.popular ? "border-2 border-blue-600 shadow-lg shadow-blue-600/10" : "border border-slate-200"}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                    MOST POPULAR
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-xl font-bold text-slate-900">ClearCFO {plan.name}</h3>
                  <p className="shrink-0 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                    {plan.price}<span className="text-base font-medium text-slate-500">/mo</span>
                  </p>
                </div>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
                <ul className="mt-7 space-y-3 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="font-bold text-emerald-600">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/signup"
                  className={`mt-8 rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${plan.popular ? "bg-blue-600 text-white hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md" : "border border-slate-300 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm"}`}
                >
                  Get Started
                </a>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
