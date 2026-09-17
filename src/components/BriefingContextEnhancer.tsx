"use client";

import { useEffect } from "react";

type MetricKey = "revenue" | "margin" | "cash" | "inventory";

type BriefingData = {
  revenue: number;
  grossMargin: number;
  cash: number;
  inventory: number;
  revenueChange: number;
  marginChange: number;
  cashChange: number;
  inventoryChange: number;
  alerts?: string[];
  drivers?: Array<{ id: string; category: string; title: string; observation: string; severity: string }>;
};

const metricNames: Record<MetricKey, string> = {
  revenue: "Revenue",
  margin: "Gross Margin",
  cash: "Cash Position",
  inventory: "Inventory",
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function percent(value: number) {
  return Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(1)}%` : "—";
}

function points(value: number) {
  return Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(1)} pts` : "—";
}

function loadData(): BriefingData | null {
  try {
    const raw = window.localStorage.getItem("clearcfo_qb_briefing_cache") || window.localStorage.getItem("clearcfo_analysis_input");
    if (!raw) return null;
    return JSON.parse(raw) as BriefingData;
  } catch {
    return null;
  }
}

function selectedMetric(): MetricKey {
  const selected = document.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
  if (!selected) return "revenue";
  const text = selected.textContent || "";
  return (Object.entries(metricNames) as [MetricKey, string][]).find(([, label]) => text.includes(label))?.[0] || "revenue";
}

function metricCopy(metric: MetricKey, data: BriefingData) {
  const change = {
    revenue: data.revenueChange,
    margin: data.marginChange,
    cash: data.cashChange,
    inventory: data.inventoryChange,
  }[metric];

  const current = {
    revenue: data.revenue,
    margin: data.grossMargin,
    cash: data.cash,
    inventory: data.inventory,
  }[metric];

  const label = metricNames[metric];
  const changeText = metric === "margin" ? points(change) : percent(change);
  const context = {
    revenue: "Revenue is the top-line measure of demand and sales momentum. Read it alongside gross margin and cash to see whether growth is translating into profitable cash generation.",
    margin: "Gross margin shows how much of each revenue dollar remains after direct costs. It is the bridge between sales volume and the profit available to cover operating expenses.",
    cash: "Cash position shows the liquidity currently available to run the business. Read it alongside revenue, expenses, receivables, and inventory because a growing business can still become cash constrained.",
    inventory: "Inventory represents cash committed to goods that have not yet been converted into sales. Read it alongside revenue, COGS, purchasing, and cash to distinguish productive inventory from cash tied up in stock.",
  }[metric];
  const why = {
    revenue: "Revenue growth matters only if the business can keep enough margin and convert that activity into cash.",
    margin: "A small margin movement can have a large effect on profit when it is applied across the full revenue base.",
    cash: "Cash is the buffer that allows the business to pay obligations, absorb surprises, and fund operations without relying on new financing.",
    inventory: "Inventory can support future sales, but excess stock ties up cash and can increase carrying and obsolescence risk.",
  }[metric];

  let whatChanged: string;
  if (metric === "margin") {
    whatChanged = Number.isFinite(change)
      ? `${label} is ${current.toFixed(1)}% and moved ${changeText} versus the prior period.`
      : `${label} is ${current.toFixed(1)}%; a reliable prior-period percentage comparison is not available.`;
  } else if (metric === "inventory" && !Number.isFinite(change)) {
    whatChanged = `${label} is ${money.format(current)}. The prior period was zero or unavailable, so the meaningful change is the amount of inventory now on the balance sheet rather than a percentage rate.`;
  } else {
    whatChanged = Number.isFinite(change)
      ? `${label} is ${money.format(current)} and changed ${changeText} versus the prior period.`
      : `${label} is ${money.format(current)}; a reliable prior-period percentage comparison is not available.`;
  }

  const relevantDrivers = (data.drivers || []).filter((driver) => {
    const text = `${driver.category} ${driver.title} ${driver.observation}`.toLowerCase();
    const terms: Record<MetricKey, string[]> = {
      revenue: ["revenue", "sales", "income"],
      margin: ["margin", "cogs", "cost of goods"],
      cash: ["cash", "receivable", "inventory", "expense", "working capital"],
      inventory: ["inventory", "cogs", "purchas", "stock", "cash"],
    };
    return terms[metric].some((term) => text.includes(term));
  });

  const drivers = relevantDrivers.length
    ? relevantDrivers.map((driver) => driver.observation)
    : [
        metric === "cash"
          ? "No single cash-specific driver was isolated in the current analysis. Review the cash trend with receivables, inventory, and operating expenses before making a liquidity decision."
          : metric === "inventory"
            ? "No single inventory-specific driver was isolated in the current analysis. Review inventory against sales and COGS to determine whether the balance is supporting demand or tying up cash."
            : metric === "margin"
              ? "The current analysis does not isolate an additional margin driver beyond the reported gross-margin movement. Review COGS against revenue for the next period."
              : "The current analysis does not isolate an additional revenue driver beyond the reported change. Review sales activity and gross-margin conversion for the next period.",
      ];

  const alerts = (data.alerts || []).filter((alert) => {
    const text = alert.toLowerCase();
    const terms: Record<MetricKey, string[]> = {
      revenue: ["revenue", "sales", "income"],
      margin: ["margin", "cogs", "cost"],
      cash: ["cash", "receivable", "inventory", "expense"],
      inventory: ["inventory", "stock", "cash", "working capital"],
    };
    return terms[metric].some((term) => text.includes(term));
  });

  const attention = alerts.length
    ? alerts.slice(0, 3)
    : [
        metric === "cash"
          ? Number.isFinite(change) && change < 0 ? `Cash declined ${Math.abs(change).toFixed(1)}% versus the prior period. Review the cash drivers before treating the movement as temporary.` : "No cash-specific exception was detected in the current analysis. Continue watching liquidity against operating needs."
          : metric === "inventory"
            ? Number.isFinite(change) && change > 0 ? `Inventory increased ${change.toFixed(1)}% versus the prior period. Confirm the increase is supported by sales demand and planned purchasing.` : "No inventory-specific exception was detected in the current analysis. Continue comparing stock levels with sales and COGS."
            : metric === "margin"
              ? Number.isFinite(change) && change < 0 ? `Gross margin declined ${Math.abs(change).toFixed(1)} points versus the prior period. Review COGS and pricing/mix before assuming the change is structural.` : "No margin-specific exception was detected in the current analysis. Continue monitoring direct costs against revenue."
              : Number.isFinite(change) && change < 0 ? `Revenue declined ${Math.abs(change).toFixed(1)}% versus the prior period. Review sales activity and the effect on gross profit and cash.` : "No revenue-specific exception was detected in the current analysis. Continue monitoring whether sales growth converts into margin and cash.",
      ];

  return { label, whatChanged, context, why, drivers, attention };
}

function updateText(selector: string, text: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    node.textContent = text;
  });
}

function updateBriefing() {
  const data = loadData();
  if (!data) return;
  const copy = metricCopy(selectedMetric(), data);

  const headings = Array.from(document.querySelectorAll<HTMLParagraphElement>("p"));
  const contextHeading = headings.find((node) => node.textContent?.trim() === "Context");
  if (contextHeading) {
    const value = contextHeading.parentElement?.querySelectorAll<HTMLParagraphElement>("p")[1];
    if (value) value.textContent = copy.context;
  }

  const whyHeading = headings.find((node) => node.textContent?.trim() === "Why it matters");
  if (whyHeading) {
    const value = whyHeading.parentElement?.querySelectorAll<HTMLParagraphElement>("p")[1];
    if (value) value.textContent = copy.why;
  }

  const changedHeadings = headings.filter((node) => node.textContent?.trim() === "What changed");
  changedHeadings.forEach((heading) => {
    const parent = heading.parentElement;
    const value = parent?.querySelectorAll<HTMLParagraphElement>("p")[1];
    if (value) value.textContent = copy.whatChanged;
  });

  const attentionHeading = headings.find((node) => node.textContent?.trim() === "What needs attention");
  const attentionCard = attentionHeading?.parentElement?.parentElement;
  if (attentionCard) {
    const items = Array.from(attentionCard.querySelectorAll<HTMLElement>("div.w-full.rounded-xl"));
    items.slice(0, 3).forEach((item, index) => {
      const text = item.querySelectorAll<HTMLParagraphElement>("p")[1];
      if (text) text.textContent = copy.attention[index] || copy.attention[copy.attention.length - 1];
    });
  }

  const driversHeading = headings.find((node) => node.textContent?.trim() === "Financial drivers");
  const driversCard = driversHeading?.parentElement?.parentElement;
  if (driversCard) {
    const items = Array.from(driversCard.querySelectorAll<HTMLElement>("div.rounded-xl"));
    items.forEach((item, index) => {
      const text = item.querySelectorAll<HTMLParagraphElement>("p")[1];
      if (text && copy.drivers[index]) text.textContent = copy.drivers[index];
    });
  }
}

export default function BriefingContextEnhancer() {
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) updateBriefing();
    };
    const timer = window.setTimeout(run, 350);
    const observer = new MutationObserver(() => run());
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
    window.addEventListener("clearcfo:quickbooks-sync", run);
    window.addEventListener("clearcfo:metric-change", run);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("clearcfo:quickbooks-sync", run);
      window.removeEventListener("clearcfo:metric-change", run);
    };
  }, []);

  return null;
}
