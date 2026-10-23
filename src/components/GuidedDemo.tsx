"use client";

import { useState } from "react";
import {
  DEMO_FINANCIALS, DEMO_PERIODS, demoCurrency,
  demoPercentage, grossMargin, moneyChange, percentChange,
  type DemoMoneyKey,
} from "../lib/demo-business";

const steps = [
  { title: "See the numbers", short: "The numbers", eyebrow: "01 / The numbers", intro: "First, see what changed in the business from one month to the next." },
  { title: "Spot the signals", short: "The signals", eyebrow: "02 / What stands out", intro: "ClearCFO brings attention to the changes worth investigating—not just rows of numbers." },
  { title: "Choose what to review", short: "The next move", eyebrow: "03 / What to do next", intro: "Turn those observations into specific questions and practical next steps." },
] as const;

type Kpi = {
  key: DemoMoneyKey | "margin";
  label: string;
  note: string;
  tone: "positive" | "caution" | "negative";
};

const kpis: Kpi[] = [
  { key: "revenue", label: "Revenue", note: "Monthly sales", tone: "positive" },
  { key: "cash", label: "Cash", note: "Month-end balance", tone: "negative" },
  { key: "inventory", label: "Inventory", note: "Month-end balance", tone: "caution" },
  { key: "margin", label: "Gross margin", note: "Of monthly revenue", tone: "negative" },
];

const comparison: Array<{key: DemoMoneyKey; label: string}> = [
  { key: "revenue", label: "Revenue" },
  { key: "inventory", label: "Inventory" },
  { key: "receivables", label: "Accounts receivable" },
  { key: "cash", label: "Cash" },
];

const signals = [
  {
    number: "01", title: "Inventory grew faster than revenue",
    evidence: "Inventory increased by $32,000 (40.0%), while monthly revenue increased by $12,000 (10.0%).",
    question: "Is purchasing aligned with demand, or is stock building up?",
    unknown: "We do not have inventory aging, SKU sales, or purchasing commitments. Rising inventory alone does not prove excess or slow-moving stock.",
    tone: "amber",
  },
  {
    number: "02", title: "Revenue increased while cash fell",
    evidence: "Monthly revenue rose by $12,000, but the month-end cash balance fell by $16,000. Receivables also increased by $15,000.",
    question: "Are collections, payments, or inventory purchases affecting cash?",
    unknown: "These balances do not establish the cause of the cash decline. We would need a cash-flow statement and collection detail.",
    tone: "red",
  },
  {
    number: "03", title: "Gross margin narrowed",
    evidence: "Gross margin fell from 35.0% to 30.0%, a 5-percentage-point decrease even as sales grew.",
    question: "Has product mix, selling price, or the underlying cost structure changed?",
    unknown: "The financial totals don't isolate the driver. We would need product, pricing, and cost-of-goods detail.",
    tone: "blue",
  },
] as const;

const actions = [
  {
    priority: "Start here", title: "Review inventory movement",
    detail: "Compare stock aging, recent purchases, and expected demand before changing reorder quantities.",
    evidence: "Inventory +$32,000 versus revenue +$12,000.",
    reason: "Check whether purchases are getting ahead of sales before assuming that stock is excess.",
  },
  {
    priority: "Next", title: "Examine receivables and cash timing",
    detail: "Review overdue invoices, expected collections, major outgoing payments, and the cash-flow statement.",
    evidence: "Receivables +$15,000 while cash fell $16,000.",
    reason: "Understand the timing behind the movement instead of assuming customers aren't paying.",
  },
  {
    priority: "Then", title: "Investigate the margin change",
    detail: "Compare revenue and cost of goods by product or service, including discounts, input costs, and mix.",
    evidence: "Gross margin declined 5 percentage points.",
    reason: "Pinpoint the driver before deciding whether prices or spending need to change.",
  },
] as const;

function kpiValue(item: Kpi) {
  return item.key === "margin"
    ? grossMargin("current").toFixed(1) + "%"
    : demoCurrency(DEMO_FINANCIALS[item.key].current);
}

function kpiPrior(item: Kpi) {
  return item.key === "margin"
    ? grossMargin("prior").toFixed(1) + "%"
    : demoCurrency(DEMO_FINANCIALS[item.key].prior);
}

function kpiChange(item: Kpi) {
  if (item.key === "margin") {
    return (grossMargin("current") - grossMargin("prior")).toFixed(1) + " pp";
  }
  const difference = moneyChange(item.key);
  return (difference >= 0 ? "+" : "−") + demoPercentage(percentChange(item.key));
}

function toneClass(tone: Kpi["tone"]) {
  return tone === "positive"
    ? "text-emerald-700 bg-emerald-50"
    : tone === "caution"
      ? "text-amber-800 bg-amber-50"
      : "text-rose-700 bg-rose-50";
}

function BarComparison({ metric, label }: { metric: DemoMoneyKey; label: string }) {
  const amounts = DEMO_FINANCIALS[metric];
  const max = Math.max(amounts.prior, amounts.current, 1);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{label}</h4>
        <span className="text-xs font-semibold text-slate-500">
          {moneyChange(metric) >= 0 ? "+" : "−"}{demoCurrency(Math.abs(moneyChange(metric)))}
        </span>
      </div>
      <div className="space-y-2.5">
        {(["prior", "current"] as const).map(period => (
          <div key={period} className="grid grid-cols-[3.5rem_minmax(0,1fr)_5rem] items-center gap-2.5">
            <span className="text-xs font-medium text-slate-500">{period === "prior" ? "Aug" : "Sep"}</span>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${period === "prior" ? "bg-slate-300" : "bg-blue-600"}`}
                style={{ width: `${(100 * amounts[period]) / max}%` }}
              />
            </div>
            <span className="text-right text-xs font-semibold tabular-nums text-slate-700">{demoCurrency(amounts[period])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GuidedDemo() {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const chooseStep = (next: number) => {
    setStep(next);
    document.getElementById("demo-story")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/demo");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <section className="relative overflow-hidden bg-slate-950 px-5 pb-16 pt-16 text-white sm:px-8 sm:pb-20 sm:pt-20">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-200">A guided ClearCFO example</span>
            <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-300">Fictional business data</span>
          </div>
          <div className="mt-9 grid items-end gap-10 lg:grid-cols-[1.35fr_0.65fr]">
            <div>
              <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Sales went up.<br /><span className="text-blue-400">So why did cash fall?</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Imagine you own a growing business. Revenue is improving, but cash is lower and more money is sitting in inventory. Here&apos;s how ClearCFO can help you see the signals and decide what to review.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => chooseStep(0)} className="rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500">
                  Explore the example →
                </button>
                <a href="/contact" className="rounded-xl border border-slate-500 px-6 py-3.5 text-sm font-semibold text-slate-100 hover:border-slate-200">Ask for a walkthrough</a>
              </div>
              <p className="mt-5 text-xs leading-5 text-slate-400">No login, uploads, payment, or QuickBooks connection. This walkthrough does not call an AI model.</p>
            </div>
            <div className="rounded-2xl border border-slate-600/60 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/50">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">In this fictional example</p>
              <p className="mt-5 text-sm font-medium text-slate-300">Revenue changed</p>
              <p className="mt-1 text-3xl font-extrabold text-emerald-300">+{demoPercentage(percentChange("revenue"))}</p>
              <div className="my-5 h-px bg-slate-700" />
              <p className="text-sm font-medium text-slate-300">Cash changed</p>
              <p className="mt-1 text-3xl font-extrabold text-rose-300">−{demoCurrency(Math.abs(moneyChange("cash")))}</p>
              <p className="mt-5 text-sm leading-6 text-slate-400">Both facts can be true. Understanding what to investigate next is the real value.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="demo-story" className="scroll-mt-24 bg-slate-50 px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Walk through the financial story</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">From numbers to a decision</h2>
            </div>
            <button onClick={copyLink} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm hover:border-blue-300" aria-label="Copy demo link">
              {copied ? "Link copied ✓" : "Copy demo link"}
            </button>
          </div>

          <nav aria-label="Demo steps" className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
            {steps.map((item, index) => (
              <button
                key={item.short}
                type="button"
                onClick={() => chooseStep(index)}
                aria-current={step === index ? "step" : undefined}
                className={`min-w-0 rounded-xl border px-2 py-4 text-center transition sm:px-5 sm:text-left ${step === index ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/15" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}
              >
                <span className={`block text-xs font-bold tracking-widest ${step === index ? "text-blue-100" : "text-slate-400"}`}>0{index + 1}</span>
                <span className="mt-1 block text-sm font-bold sm:text-base">{item.short}</span>
              </button>
            ))}
          </nav>

          <div aria-live="polite" className="mt-7 min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{steps[step].eyebrow}</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{steps[step].title}</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{steps[step].intro}</p>

            {step === 0 && (
              <>
                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {kpis.map(kpi => (
                    <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-600">{kpi.label}</p>
                        <span className={`rounded-md px-2 py-1 text-xs font-bold ${toneClass(kpi.tone)}`}>{kpiChange(kpi)}</span>
                      </div>
                      <p className="mt-4 break-words text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">{kpiValue(kpi)}</p>
                      <p className="mt-1 text-xs text-slate-500">{kpi.note} · {DEMO_PERIODS.current}</p>
                      <p className="mt-3 text-xs text-slate-500">Prior: {kpiPrior(kpi)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-2xl bg-blue-50/70 p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-700">See the movement</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Compare monthly sales and month-end balances. The figures are illustrative and not from a real QuickBooks or Excel connection.</p>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {comparison.map(c => <BarComparison key={c.key} metric={c.key} label={c.label} />)}
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <div className="mt-7 grid gap-4 lg:grid-cols-3">
                {signals.map(signal => (
                  <article key={signal.number} className="flex flex-col rounded-2xl border border-slate-200 p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-blue-700">Signal {signal.number}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Worth reviewing</span>
                    </div>
                    <h4 className="mt-4 text-lg font-bold leading-7 text-slate-900">{signal.title}</h4>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{signal.evidence}</p>
                    <div className="mt-5 rounded-xl bg-blue-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-700">The management question</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{signal.question}</p>
                    </div>
                    <div className="mt-5 border-t border-slate-200 pt-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">What we don't know yet</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{signal.unknown}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="mt-7 grid gap-5 lg:grid-cols-[1.6fr_0.7fr]">
                <div className="space-y-4">
                  {actions.map((action, index) => (
                    <article key={action.title} className="flex gap-4 rounded-2xl border border-slate-200 p-5 sm:p-6">
                      <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">{index + 1}</div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">{action.priority}</p>
                        <h4 className="mt-1 text-lg font-bold text-slate-900">{action.title}</h4>
                        <p className="mt-2 text-sm leading-7 text-slate-700">{action.detail}</p>
                        <p className="mt-3 text-xs font-semibold text-slate-700">Evidence: {action.evidence}</p>
                        <p className="mt-1 text-xs leading-6 text-slate-500">{action.reason}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <aside className="self-start rounded-2xl bg-slate-950 p-6 text-white">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-300">The ClearCFO difference</p>
                  <h4 className="mt-3 text-xl font-bold leading-8">Not just another financial report.</h4>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    Know what moved, see why it deserves attention, and leave with a practical list of questions—not unsupported promises of savings.
                  </p>
                  <div className="mt-6 border-t border-white/15 pt-5">
                    <p className="text-xs leading-6 text-slate-400">This is a scripted example, not a live AI-generated recommendation or a claim about any actual business.</p>
                  </div>
                </aside>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
              <span className="text-sm font-medium text-slate-500">Step {step + 1} of {steps.length} · Example only</span>
              {step < steps.length - 1 ? (
                <button onClick={() => chooseStep(step + 1)} className="min-h-11 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                  {step === 0 ? "See what stands out" : "Show the next steps"} →
                </button>
              ) : (
                <button onClick={() => chooseStep(0)} className="min-h-11 rounded-xl border border-blue-300 bg-white px-6 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">Review the example again ↺</button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white px-6 py-10 text-center shadow-sm sm:px-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Ready to see your own business more clearly?</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            You already have the numbers. Let&apos;s talk about what you want them to tell you.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            ClearCFO supports connected QuickBooks data and Excel analysis. Reach out for a walkthrough before connecting your own information.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/contact" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">Request a walkthrough →</a>
            <a href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:border-blue-300">Explore ClearCFO</a>
          </div>
          <p className="mt-5 text-xs text-slate-500">Every figure on this demo page is fictional. No account, payment, AI request, or financial data is used.</p>
        </div>
      </section>
    </>
  );
}
