"use client";

import { useEffect, useState } from "react";

type TrendMetric = "Revenue" | "Inventory" | "Operating Expenses" | "Cash";

type SelectedTrend = { metric: TrendMetric; latest: string; prior: string; change: string; direction: string };

function readMetricFromCard(target: Element): SelectedTrend | null {
  const svg = target.closest("svg[aria-label*='historical trend']") as SVGElement | null;
  if (!svg) return null;
  const label = svg.getAttribute("aria-label") ?? "";
  const metric = (label.match(/^(Revenue|Inventory|Operating Expenses|Cash)/)?.[1] ?? null) as TrendMetric | null;
  if (!metric) return null;

  let card: HTMLElement | null = svg.parentElement;
  while (card && card !== document.body) {
    const text = card.textContent ?? "";
    if (text.includes("Latest") && text.includes("Prior") && text.length < 900) break;
    card = card.parentElement;
  }
  if (!card) return null;

  // The chart SVG contains its own values and period labels. Remove it before
  // reading the card's summary values so those labels cannot be concatenated.
  const summary = card.cloneNode(true) as HTMLElement;
  summary.querySelectorAll("svg").forEach((node) => node.remove());
  const text = (summary.textContent ?? "").replace(/\s+/g, " ").trim();

  const latest = text.match(/Latest\s*([+-]?\$?[\d,]+(?:\.\d+)?%?)/)?.[1] ?? "See briefing";
  const prior = text.match(/Prior\s*([+-]?\$?[\d,]+(?:\.\d+)?%?)/)?.[1] ?? "See briefing";
  const changeMatch = text.match(/([+-]\d+(?:\.\d+)?)%/);
  const change = changeMatch ? `${changeMatch[1]}%` : "";
  const direction = metric === "Inventory" ? (text.includes("Building") ? "Building" : "Easing")
    : metric === "Operating Expenses" ? (text.includes("Increasing") ? "Increasing" : "Decreasing")
    : metric === "Cash" ? (text.includes("Strengthening") ? "Strengthening" : "Declining")
    : (text.includes("Growing") ? "Growing" : "Declining");

  return { metric, latest, prior, change, direction };
}

export default function TrendDetailOverlay({ enabled }: { enabled: boolean }) {
  const [selected, setSelected] = useState<SelectedTrend | null>(null);

  useEffect(() => {
    if (!enabled) { setSelected(null); return; }
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const next = readMetricFromCard(target);
      if (next) {
        setSelected(next);
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [enabled]);

  if (!selected) return null;

  const takeaway = selected.metric === "Inventory"
    ? "Validate the inventory build by category, aging, purchases, and demand before changing replenishment decisions."
    : selected.metric === "Cash"
    ? "Reconcile the cash movement to collections, inventory, purchasing, debt, and upcoming payments before drawing a stronger conclusion."
    : selected.metric === "Operating Expenses"
    ? "Review the fastest-growing expense categories and separate recurring costs from discretionary or one-time spending."
    : "Investigate the customer, product, pricing, and volume factors behind the revenue trend before drawing a stronger conclusion.";

  const unknown = selected.metric === "Inventory"
    ? "The briefing does not identify which inventory categories or SKUs are driving the increase."
    : selected.metric === "Cash"
    ? "The available statements do not fully reconcile the cash movement to collections, purchasing, debt, and other cash flows."
    : selected.metric === "Operating Expenses"
    ? "The workbook does not identify which expense categories are recurring versus discretionary."
    : "The workbook does not contain customer, product, pricing, or volume detail to establish the root cause of the revenue trend.";

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button type="button" onClick={() => setSelected(null)} className="text-sm font-semibold text-blue-600 hover:text-blue-800">← Back to Financial Trends</button>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">ClearCFO Financial Detail</span>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Financial detail</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{selected.metric}</h1><p className="mt-2 text-sm text-slate-500">A deeper look at the latest result and the trend behind it.</p></div>
            <div className="sm:text-right"><p className="text-3xl font-bold text-slate-900">{selected.latest}</p><p className={`mt-1 text-sm font-bold ${selected.change.startsWith("-") ? "text-red-600" : "text-emerald-600"}`}>{selected.change} vs. prior · {selected.direction}</p></div>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latest period</p><p className="mt-2 text-xl font-bold text-slate-900">{selected.latest}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Prior period</p><p className="mt-2 text-xl font-bold text-slate-900">{selected.prior}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direction</p><p className="mt-2 text-xl font-bold text-slate-900">{selected.direction}</p></div>
          </div>
          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">What ClearCFO sees</p><p className="mt-2 text-base font-semibold leading-6 text-slate-900">{selected.metric === "Inventory" ? "Inventory is growing faster than revenue, increasing working-capital pressure." : selected.metric === "Cash" ? "Cash movement should be evaluated alongside working capital and operating performance." : selected.metric === "Operating Expenses" ? "Operating expense growth is an important test of operating leverage." : "Revenue is the starting point for judging whether margins, expenses, and working capital are keeping pace."}</p></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Management question</p><p className="mt-2 text-sm leading-6 text-slate-700">{takeaway}</p></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">What ClearCFO does not know yet</p><p className="mt-2 text-sm leading-6 text-slate-600">{unknown}</p></div>
          </div>
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Recommended next step</p><p className="mt-2 text-base font-semibold leading-6 text-slate-900">{takeaway}</p></div>
        </div>
      </main>
    </div>
  );
}
