"use client";

import { useState } from "react";
import ScrollReveal from "./ScrollReveal";

const plans = [
  {
    name: "Core",
    monthly: 39,
    description: "The essential financial intelligence you need to understand performance and act with confidence.",
    features: [
      "CFO Briefing",
      "KPI dashboard",
      "Financial drivers and trends",
      "ClearCFO recommendations",
      "Excel upload and QuickBooks connection",
    ],
  },
  {
    name: "Pro",
    monthly: 79,
    description: "Deeper financial intelligence for businesses that want ongoing decision support.",
    features: [
      "Everything in Core",
      "Deeper financial analysis",
      "Expanded historical insights",
      "Advanced decision support",
      "Weekly CFO Report",
    ],
    popular: true,
  },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="border-y border-slate-200 bg-slate-50/70 px-5 py-20 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Clear pricing. Serious financial clarity.</h2>
            <p className="mt-4 leading-7 text-slate-600">Start with the financial visibility you need today. Upgrade when your business needs deeper decision support.</p>

            <div className="mt-7 inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="Billing frequency">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${!annual ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${annual ? "bg-blue-600 text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                Annual <span className={annual ? "text-blue-100" : "text-blue-600"}>17% less</span>
              </button>
            </div>
          </div>
        </ScrollReveal>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {plans.map((plan, index) => {
            const price = annual ? Math.round((plan.monthly * 10) / 1) : plan.monthly;
            const period = annual ? "/year" : "/mo";

            return (
              <ScrollReveal key={plan.name} delay={index * 120}>
                <div className={`relative flex h-full flex-col rounded-2xl bg-white p-7 shadow-sm ${plan.popular ? "border-2 border-blue-600 shadow-lg shadow-blue-600/10" : "border border-slate-200"}`}>
                  {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">MOST POPULAR</div>}
                  <h3 className="text-xl font-bold text-slate-900">ClearCFO {plan.name}</h3>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
                  <div className="mt-6 flex items-end gap-2">
                    <p className="text-4xl font-extrabold tracking-tight text-slate-900">
                      ${price}<span className="text-base font-medium text-slate-500">{period}</span>
                    </p>
                    {annual && <span className="mb-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">17% annual discount</span>}
                  </div>
                  {annual && <p className="mt-2 text-xs text-slate-500">Equivalent to ${Math.round(plan.monthly * 0.83)}/month when billed annually.</p>}

                  <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm">
                    <p className="font-semibold text-slate-900">7-day free trial</p>
                    <p className="mt-1 leading-5 text-slate-600">Try the full {plan.name} experience. A payment method is required and billing starts after the trial unless you cancel.</p>
                  </div>

                  <ul className="mt-7 space-y-3 text-sm text-slate-600">
                    {plan.features.map((feature) => <li key={feature} className="flex gap-2"><span className="font-bold text-emerald-600">✓</span><span>{feature}</span></li>)}
                  </ul>
                  <a href="/login?mode=signup" className={`mt-8 rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${plan.popular ? "bg-blue-600 text-white hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md" : "border border-slate-300 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm"}`}>
                    Start 7-day free trial
                  </a>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-slate-500">No long-term commitment. Cancel before the trial ends and you will not be charged. Monthly and annual billing are available.</p>
      </div>
    </section>
  );
}
