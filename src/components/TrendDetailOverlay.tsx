"use client";

import { useEffect, useState } from "react";

type TrendMetric = "Revenue" | "Inventory" | "Operating Expenses" | "Cash";
type Signal = { metric: TrendMetric; latest: string; prior: string; change: string; direction: string };
type Selected = Signal & { chartMarkup: string; labels: string[] };

const METRICS: TrendMetric[] = ["Revenue", "Inventory", "Operating Expenses", "Cash"];

function metricFromSvg(svg: SVGElement): TrendMetric | null {
  const label = svg.getAttribute("aria-label") ?? "";
  return METRICS.find((m) => label.startsWith(m)) ?? null;
}

function findCard(svg: SVGElement): HTMLElement | null {
  let card: HTMLElement | null = svg.parentElement;
  while (card && card !== document.body) {
    const copy = card.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("svg").forEach((n) => n.remove());
    const text = (copy.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.includes("Latest") && text.includes("Prior") && text.length < 900) return card;
    card = card.parentElement;
  }
  return null;
}

function summary(card: HTMLElement, metric: TrendMetric): Signal {
  const copy = card.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("svg").forEach((n) => n.remove());
  const text = (copy.textContent ?? "").replace(/\s+/g, " ").trim();
  const latest = text.match(/Latest\s*([+-]?\$?[\d,]+(?:\.\d+)?%?)/)?.[1] ?? "See briefing";
  const prior = text.match(/Prior\s*([+-]?\$?[\d,]+(?:\.\d+)?%?)/)?.[1] ?? "See briefing";
  const match = text.match(/([+-]\d+(?:\.\d+)?)%/);
  const change = match ? `${match[1]}%` : "";
  const direction = metric === "Inventory" ? (text.includes("Building") ? "Building" : "Easing")
    : metric === "Operating Expenses" ? (text.includes("Increasing") ? "Increasing" : "Decreasing")
    : metric === "Cash" ? (text.includes("Strengthening") ? "Strengthening" : "Declining")
    : (text.includes("Growing") ? "Growing" : "Declining");
  return { metric, latest, prior, change, direction };
}

function readSelected(target: Element): Selected | null {
  const svg = target.closest("svg[role='img'][aria-label*='historical trend']") as SVGElement | null;
  if (!svg) return null;
  const metric = metricFromSvg(svg);
  if (!metric) return null;
  const card = findCard(svg);
  if (!card) return null;
  const copy = svg.cloneNode(true) as SVGElement;
  copy.setAttribute("width", "100%");
  copy.setAttribute("height", "360");
  copy.setAttribute("viewBox", copy.getAttribute("viewBox") || "0 0 520 190");
  copy.removeAttribute("aria-label");
  copy.querySelectorAll("text").forEach((n) => {
    const y = Number(n.getAttribute("y"));
    if (Number.isFinite(y) && y > 145) n.setAttribute("font-size", "12");
  });
  const labels = Array.from(svg.querySelectorAll("text"))
    .filter((n) => Number(n.getAttribute("y")) > 145)
    .map((n) => n.textContent?.trim() || "")
    .filter(Boolean);
  return { ...summary(card, metric), chartMarkup: copy.outerHTML, labels };
}

function allSignals(exclude: TrendMetric) {
  return METRICS.filter((metric) => metric !== exclude).map((metric) => {
    const svg = document.querySelector(`svg[role="img"][aria-label^="${metric}"][aria-label*="historical trend"]`) as SVGElement | null;
    const card = svg ? findCard(svg) : null;
    return svg && card ? summary(card, metric) : null;
  }).filter((s): s is Signal => Boolean(s));
}

function copyFor(metric: TrendMetric) {
  if (metric === "Inventory") return {
    sees: "Inventory is a working-capital signal that is most useful when compared with the sales base and the pace of change.",
    question: "What categories, SKUs, purchases, or demand changes explain the inventory movement?",
    unknown: "The briefing does not identify the categories, SKUs, aging, or demand detail behind the inventory balance.",
    next: "Validate the inventory movement by category and aging, then reconcile the change to purchases, COGS, and demand."
  };
  if (metric === "Cash") return {
    sees: "Cash reflects operating, working-capital, and financing movements, so the trend should be read alongside the other financial signals.",
    question: "What operating or financing movements explain the change in cash?",
    unknown: "The available statements do not fully reconcile cash to collections, purchasing, working capital, debt, and other cash flows.",
    next: "Reconcile the period-over-period cash movement to collections, inventory, purchasing, debt, and other major cash flows."
  };
  if (metric === "Operating Expenses") return {
    sees: "Operating expense growth is a test of operating leverage, particularly when expense growth differs from revenue growth.",
    question: "Which expense categories are driving the change, and which are recurring versus one-time?",
    unknown: "The workbook does not provide enough category detail to separate recurring, discretionary, and one-time expense movement.",
    next: "Rank the fastest-growing expense categories and separate recurring costs from discretionary or one-time spending."
  };
  return {
    sees: "Revenue establishes the sales base against which margins, expenses, inventory, and cash can be evaluated.",
    question: "What customer, product, pricing, or volume factors explain the revenue movement?",
    unknown: "The workbook does not contain customer, product, pricing, or volume detail needed to establish the root cause of the trend.",
    next: "Break the revenue movement into volume, price, mix, customer, or product drivers before drawing a stronger conclusion."
  };
}

export default function TrendDetailOverlay({ enabled }: { enabled: boolean }) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    if (!enabled) { setSelected(null); return; }
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const next = readSelected(target);
      if (!next) return;
      setSelected(next);
      setSignals(allSignals(next.metric));
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [enabled]);

  if (!selected) return null;
  const copy = copyFor(selected.metric);
  const positive = !selected.change.startsWith("-");

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-50">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button type="button" onClick={() => setSelected(null)} className="text-sm font-semibold text-blue-600 hover:text-blue-800">← Back to Financial Trends</button>
          <span className="hidden text-xs font-bold uppercase tracking-[0.16em] text-slate-400 sm:block">ClearCFO Financial Detail</span>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Financial detail</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{selected.metric}</h1><p className="mt-2 text-sm text-slate-500">The latest result, six-period trend, related signals, and the management question behind it.</p></div>
            <div className="sm:text-right"><p className="text-3xl font-bold text-slate-900">{selected.latest}</p><p className={`mt-1 text-sm font-bold ${positive ? "text-emerald-600" : "text-red-600"}`}>{selected.change || "Change not available"} vs. prior · {selected.direction}</p></div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latest period</p><p className="mt-2 text-xl font-bold text-slate-900">{selected.latest}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Prior period</p><p className="mt-2 text-xl font-bold text-slate-900">{selected.prior}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direction</p><p className="mt-2 text-xl font-bold text-slate-900">{selected.direction}</p></div>
          </div>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Six-period trend</p><p className="mt-1 text-sm text-slate-500">A larger view of the same underlying trend shown in the briefing.</p></div><span className="hidden text-xs font-semibold text-slate-400 sm:block">{selected.labels.length || 6} periods</span></div>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5"><div className="[&>svg]:h-[320px] [&>svg]:w-full [&>svg]:max-w-none" dangerouslySetInnerHTML={{ __html: selected.chartMarkup }} /></div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">What changed</p><p className="mt-2 text-base font-semibold leading-6 text-slate-900">{selected.metric} is {selected.direction.toLowerCase()} at {selected.latest}, compared with {selected.prior} in the prior period ({selected.change || "change not available"}).</p></div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Related financial signals</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{signals.map((s) => <div key={s.metric} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-800">{s.metric}</p><span className="text-xs font-bold text-slate-500">{s.change || "—"}</span></div><p className="mt-2 text-lg font-bold text-slate-900">{s.latest}</p><p className="mt-1 text-xs text-slate-500">{s.direction} · prior {s.prior}</p></div>)}</div></div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">What ClearCFO sees</p><p className="mt-2 text-base font-semibold leading-6 text-slate-900">{copy.sees}</p></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Management question</p><p className="mt-2 text-base font-semibold leading-6 text-slate-900">{copy.question}</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">What ClearCFO does not know yet</p><p className="mt-2 text-sm leading-6 text-slate-600">{copy.unknown}</p></div></div>
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Recommended next step</p><p className="mt-2 text-base font-semibold leading-6 text-slate-900">{copy.next}</p></div>
        </section>
      </main>
    </div>
  );
}
