"use client";

import { useEffect } from "react";

type MetricKey = "revenue" | "margin" | "cash" | "inventory";
type Driver = { id: string; category: string; title: string; observation: string; severity: string; managementQuestion?: string };
type BriefingData = { revenue: number; grossMargin: number; cash: number; inventory: number; revenueChange: number; marginChange: number; cashChange: number; inventoryChange: number; alerts?: string[]; drivers?: Driver[] };
type LensItem = { title: string; text: string; severity?: string };
type LensCopy = { context: string; why: string; whatChanged: string; attention: LensItem[]; drivers: LensItem[]; questions: string[]; analysis: string };

const names: Record<MetricKey, string> = { revenue: "Revenue", margin: "Gross Margin", cash: "Cash Position", inventory: "Inventory" };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (v: number) => Number.isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "—";
const pts = (v: number) => Number.isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)} pts` : "—";

function data(): BriefingData | null {
  try {
    const raw = window.localStorage.getItem("clearcfo_qb_briefing_cache") || window.localStorage.getItem("clearcfo_analysis_input");
    return raw ? JSON.parse(raw) as BriefingData : null;
  } catch { return null; }
}
function selected(): MetricKey {
  const button = document.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
  const text = button?.textContent || "";
  return (Object.entries(names) as [MetricKey, string][]).find(([, label]) => text.includes(label))?.[0] || "revenue";
}
function driver(d: BriefingData, ids: string[]) { return (d.drivers || []).find((x) => ids.includes(x.id)); }
function inventoryText(d: BriefingData) {
  if (Number.isFinite(d.inventoryChange)) return `Inventory is ${money.format(d.inventory)} and changed ${pct(d.inventoryChange)} versus the prior period.`;
  if (d.inventory !== 0) return `Inventory is now ${money.format(d.inventory)}. The prior period was zero or unavailable, so the amount added to the balance sheet is more meaningful than a percentage rate.`;
  return "Inventory is currently zero; a meaningful prior-period comparison is not available.";
}

function lens(metric: MetricKey, d: BriefingData): LensCopy {
  const r = pct(d.revenueChange), m = pts(d.marginChange), c = pct(d.cashChange), i = pct(d.inventoryChange);
  const opex = driver(d, ["opex-growth"]), cash = driver(d, ["cash-pressure"]), inv = driver(d, ["inventory-growth"]), margin = driver(d, ["margin-baseline", "margin-pressure"]);
  const cashText = cash?.observation || `Cash changed ${c} versus the prior period.`;
  const invText = inv?.observation || inventoryText(d);
  const marginText = margin?.observation || `Gross margin changed ${m} versus the prior period.`;
  const opexText = opex?.observation || "The current analysis does not isolate an operating-expense driver; review expense movement alongside the selected KPI.";

  if (metric === "revenue") return {
    context: "Revenue is the top-line measure of demand and sales momentum. The useful question is whether the sales change is producing enough gross profit and cash to support the business.",
    why: "Revenue growth only creates value when it converts into sustainable gross profit and cash generation.",
    whatChanged: `Revenue is ${money.format(d.revenue)} and changed ${r} versus the prior period. Gross margin moved ${m}, while cash changed ${c}.`,
    attention: [
      { title: "Revenue movement", text: `Revenue changed ${r} versus the prior period. Confirm whether the change reflects repeatable sales activity or a one-period spike.`, severity: d.revenueChange < 0 ? "High" : "Watch" },
      { title: "Profit conversion", text: `Gross margin moved ${m}. Revenue growth needs to leave enough gross profit after direct costs.`, severity: d.marginChange < -2 ? "High" : "Watch" },
      { title: "Cash conversion", text: `Cash changed ${c}. Stronger sales do not automatically mean stronger liquidity.`, severity: d.cashChange < -5 ? "High" : "Watch" },
    ],
    drivers: [
      { title: "Revenue performance", text: `Revenue is ${money.format(d.revenue)} and changed ${r} from the prior period.`, severity: "Watch" },
      { title: "Gross-margin conversion", text: marginText, severity: margin?.severity || "Watch" },
      { title: "Cash conversion", text: cashText, severity: cash?.severity || "Watch" },
    ],
    questions: ["Revenue: Is the latest sales change repeatable, and which customers or products explain it?", "Margin: What changed in direct costs or mix as revenue moved?", `Cash: Why did cash move ${c} while revenue changed ${r}?`],
    analysis: `Revenue is the selected lens: ${money.format(d.revenue)} (${r} versus the prior period). The next management question is whether the sales movement is translating into margin and cash.`,
  };

  if (metric === "margin") return {
    context: "Gross margin shows how much revenue remains after direct costs. It connects sales activity to the profit available to cover operating expenses.",
    why: "A small margin movement can materially change profit because the percentage applies across the full revenue base.",
    whatChanged: `Gross margin is ${d.grossMargin.toFixed(1)}% and moved ${m} versus the prior period. Revenue changed ${r}; cash changed ${c}.`,
    attention: [
      { title: "Margin movement", text: d.marginChange < 0 ? `Gross margin declined ${Math.abs(d.marginChange).toFixed(1)} points versus the prior period. Review direct costs before assuming the movement is structural.` : `Gross margin changed ${m} versus the prior period. Continue comparing direct costs with revenue.`, severity: d.marginChange < -2 ? "High" : "Watch" },
      { title: "Direct-cost explanation", text: marginText, severity: margin?.severity || "Watch" },
      { title: "Profit-to-cash link", text: `Cash changed ${c}. A margin decline can pressure cash if the business has to fund the same operating base with less gross profit.`, severity: d.cashChange < -5 ? "High" : "Watch" },
    ],
    drivers: [
      { title: margin?.title || "Gross-margin movement", text: marginText, severity: margin?.severity || "Watch" },
      { title: "Revenue base", text: `Revenue changed ${r}; evaluate the margin movement against the size and mix of sales.`, severity: "Watch" },
      { title: "Cash consequence", text: cashText, severity: cash?.severity || "Watch" },
    ],
    questions: [`Margin: Is the ${m} movement coming from direct costs, pricing, or product mix?`, "Revenue: Which revenue changes occurred in the same period as the margin movement?", "Cash: Is the margin movement beginning to affect operating liquidity?"],
    analysis: `Gross Margin is the selected lens: ${d.grossMargin.toFixed(1)}% (${m} versus the prior period). The focus is explaining the direct-cost movement and its effect on profit and cash.`,
  };

  if (metric === "cash") return {
    context: "Cash position shows the liquidity currently available to run the business. Read it alongside revenue, operating expenses, receivables, and inventory because a growing business can still become cash constrained.",
    why: "Cash is the buffer that allows the business to pay obligations, absorb surprises, and fund operations without relying on new financing.",
    whatChanged: `Cash is ${money.format(d.cash)} and changed ${c} versus the prior period. Revenue changed ${r}; inventory changed ${i}.`,
    attention: [
      { title: "Liquidity movement", text: d.cashChange < 0 ? `Cash declined ${Math.abs(d.cashChange).toFixed(1)}% versus the prior period. Determine whether the decline is temporary or recurring.` : `Cash changed ${c} versus the prior period. Continue monitoring liquidity against upcoming obligations.`, severity: d.cashChange < -5 ? "High" : "Watch" },
      { title: "Operating cash pressure", text: opex?.observation || "The current analysis does not isolate an operating-expense driver. Review expense movement alongside cash.", severity: opex?.severity || "Watch" },
      { title: "Working-capital pressure", text: inv?.observation || `Inventory is ${money.format(d.inventory)} and changed ${i}. Review inventory and receivables before treating the cash movement as purely operating spend.`, severity: inv?.severity || "Watch" },
    ],
    drivers: [
      { title: "Cash movement", text: cashText, severity: cash?.severity || "High" },
      { title: "Operating expense pressure", text: opexText, severity: opex?.severity || "Watch" },
      { title: "Working capital", text: invText, severity: inv?.severity || "Watch" },
    ],
    questions: [`Cash: What caused cash to change ${c}, and which part is recurring?`, "Expenses: Which operating costs are consuming the most cash right now?", `Working capital: Are inventory or receivables tying up cash as sales move ${r}?`],
    analysis: `Cash Position is the selected lens: ${money.format(d.cash)} (${c} versus the prior period). The focus is identifying what is consuming or releasing liquidity and whether the movement is sustainable.`,
  };

  return {
    context: "Inventory represents cash committed to goods that have not yet been converted into sales. Read it alongside revenue, COGS, purchasing, and cash to distinguish productive inventory from cash tied up in stock.",
    why: "Inventory can support future sales, but excess stock ties up cash and can increase carrying and obsolescence risk.",
    whatChanged: `${inventoryText(d)} Revenue changed ${r}; cash changed ${c}.`,
    attention: [
      { title: "Inventory movement", text: d.inventoryChange > 0 ? `Inventory increased ${d.inventoryChange.toFixed(1)}% versus the prior period. Confirm the increase is supported by sales demand and planned purchasing.` : inventoryText(d), severity: d.inventoryChange > 0 ? "Medium" : "Watch" },
      { title: "Cash tied up in stock", text: `Cash changed ${c}. Inventory increases can absorb liquidity before the related goods are sold.`, severity: d.cashChange < -5 ? "High" : "Watch" },
      { title: "Sales support", text: `Revenue changed ${r}. Compare the inventory movement with sales demand before concluding that the build is excessive.`, severity: "Watch" },
    ],
    drivers: [
      { title: inv?.title || "Inventory movement", text: inv?.observation || inventoryText(d), severity: inv?.severity || "Watch" },
      { title: "Cash tied up in inventory", text: `Cash changed ${c}; inventory is ${money.format(d.inventory)}. This relationship is important for working-capital management.`, severity: cash?.severity || "Watch" },
      { title: "COGS and inventory conversion", text: margin?.observation || "The current analysis does not isolate a separate COGS driver. Review COGS and recent purchasing against the inventory balance.", severity: margin?.severity || "Watch" },
    ],
    questions: ["Inventory: What caused the latest inventory movement, and is it tied to planned sales demand?", "Cash: How much liquidity is currently committed to inventory?", "COGS: Are COGS and inventory moving consistently with the sales level?"],
    analysis: `Inventory is the selected lens: ${money.format(d.inventory)} (${Number.isFinite(d.inventoryChange) ? i : "no meaningful percentage comparison"}). The focus is whether inventory is supporting sales or tying up cash.`,
  };
}

function setText(node: Element | null, text: string) { if (node) node.textContent = text; }
function update() {
  const d = data(); if (!d) return;
  const metric = selected(); const copy = lens(metric, d);
  const headings = Array.from(document.querySelectorAll<HTMLParagraphElement>("p"));

  const detailLabel = headings.find((n) => n.textContent?.trim() === "KPI detail");
  const detailCard = detailLabel?.parentElement?.parentElement;
  if (detailCard) {
    const cols = Array.from(detailCard.querySelectorAll<HTMLElement>(".grid > div"));
    [copy.whatChanged, copy.context, copy.why].forEach((text, i) => setText(cols[i]?.querySelectorAll("p")[1] || null, text));
    setText(detailCard.querySelector("h3"), names[metric]);
  }

  const attention = headings.find((n) => n.textContent?.trim() === "What needs attention")?.parentElement?.parentElement;
  if (attention) {
    const items = Array.from(attention.querySelectorAll<HTMLElement>("div.w-full.rounded-xl"));
    items.slice(0, 3).forEach((item, i) => { const x = copy.attention[i]; if (!x) return; const p = item.querySelectorAll("p"); setText(p[0], x.title); setText(p[1], x.text); });
    setText(attention.querySelector("span.rounded-full"), `${copy.attention.length} alerts`);
  }

  const changed = headings.filter((n) => n.textContent?.trim() === "What changed").at(-1)?.parentElement?.parentElement;
  if (changed && changed !== detailCard) {
    const items = Array.from(changed.querySelectorAll<HTMLElement>("div.rounded-xl"));
    items.slice(0, 3).forEach((item, i) => { const x = copy.attention[i]; if (!x) return; const p = item.querySelectorAll("p"); if (p.length > 1) { setText(p[0], x.title); setText(p[1], i === 0 ? copy.whatChanged : x.text); } else setText(item, i === 0 ? copy.whatChanged : x.text); });
  }

  const driversCard = headings.find((n) => n.textContent?.trim() === "Financial drivers")?.parentElement?.parentElement;
  if (driversCard) {
    const items = Array.from(driversCard.querySelectorAll<HTMLElement>("div.rounded-xl"));
    items.slice(0, 3).forEach((item, i) => { const x = copy.drivers[i]; if (!x) return; const p = item.querySelectorAll("p"); setText(p[0], x.title); setText(p[1], x.text); setText(item.querySelector("span"), x.severity || "Watch"); });
  }

  const questionsCard = headings.find((n) => n.textContent?.trim() === "Management questions")?.parentElement?.parentElement;
  if (questionsCard) Array.from(questionsCard.querySelectorAll<HTMLElement>("div.rounded-xl")).slice(0, 3).forEach((item, i) => { if (copy.questions[i]) setText(item, copy.questions[i]); });

  const analysisCard = headings.find((n) => n.textContent?.trim() === "AI Analysis")?.parentElement?.parentElement;
  if (analysisCard) { const summary = Array.from(analysisCard.querySelectorAll<HTMLParagraphElement>("p")).find((p) => p.className.includes("max-w-2xl")); setText(summary || null, copy.analysis); }
}

export default function BriefingContextEnhancer() {
  useEffect(() => {
    let cancelled = false; let attempts = 0;
    const run = () => { if (!cancelled) update(); };
    const retry = window.setInterval(() => { run(); if (++attempts >= 24) window.clearInterval(retry); }, 250);
    const observer = new MutationObserver(run);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-expanded"] });
    window.addEventListener("clearcfo:quickbooks-sync", run);
    window.addEventListener("clearcfo:metric-change", run);
    return () => { cancelled = true; window.clearInterval(retry); observer.disconnect(); window.removeEventListener("clearcfo:quickbooks-sync", run); window.removeEventListener("clearcfo:metric-change", run); };
  }, []);
  return null;
}
