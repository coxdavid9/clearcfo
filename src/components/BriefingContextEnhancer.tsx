"use client";

import { useEffect } from "react";

type MetricKey = "revenue" | "margin" | "cash" | "inventory";

type Driver = {
  id: string;
  category: string;
  title: string;
  observation: string;
  severity: string;
  managementQuestion?: string;
};

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
  drivers?: Driver[];
};

type LensItem = {
  title: string;
  text: string;
  severity?: string;
};

type LensCopy = {
  context: string;
  why: string;
  whatChanged: string;
  attention: LensItem[];
  drivers: LensItem[];
  questions: string[];
  analysis: string;
};

const metricNames: Record<MetricKey, string> = {
  revenue: "Revenue",
  margin: "Gross Margin",
  cash: "Cash Position",
  inventory: "Inventory",
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function percent(value: number) {
  return Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(1)}%` : "—";
}

function points(value: number) {
  return Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(1)} pts` : "—";
}

function signedPercent(value: number) {
  return Number.isFinite(value) ? percent(value) : "not available";
}

function loadData(): BriefingData | null {
  try {
    const raw =
      window.localStorage.getItem("clearcfo_qb_briefing_cache") ||
      window.localStorage.getItem("clearcfo_analysis_input");
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
  return (
    (Object.entries(metricNames) as [MetricKey, string][]).find(([, label]) => text.includes(label))?.[0] ||
    "revenue"
  );
}

function findDriver(data: BriefingData, ids: string[]): Driver | undefined {
  return (data.drivers || []).find((driver) => ids.includes(driver.id));
}

function inventoryChangeText(data: BriefingData) {
  if (Number.isFinite(data.inventoryChange)) {
    return `Inventory is ${money.format(data.inventory)} and changed ${percent(data.inventoryChange)} versus the prior period.`;
  }
  if (data.inventory !== 0) {
    return `Inventory is now ${money.format(data.inventory)}. The prior period was zero or unavailable, so the amount added to the balance sheet is more meaningful than a percentage rate.`;
  }
  return "Inventory is currently zero; a meaningful prior-period comparison is not available.";
}

function lensCopy(metric: MetricKey, data: BriefingData): LensCopy {
  const revenue = signedPercent(data.revenueChange);
  const margin = points(data.marginChange);
  const cash = signedPercent(data.cashChange);
  const inventory = signedPercent(data.inventoryChange);
  const opexDriver = findDriver(data, ["opex-growth"]);
  const cashDriver = findDriver(data, ["cash-pressure"]);
  const inventoryDriver = findDriver(data, ["inventory-growth"]);
  const marginDriver = findDriver(data, ["margin-baseline", "margin-pressure"]);

  const sharedDrivers = {
    opex: opexDriver?.observation || `Operating expenses changed ${revenue === "not available" ? "relative to the available period" : "versus the prior period"}.`,
    cash: cashDriver?.observation || `Cash changed ${cash} versus the prior period.`,
    inventory: inventoryDriver?.observation || inventoryChangeText(data),
    margin: marginDriver?.observation || `Gross margin changed ${margin} versus the prior period.`,
  };

  if (metric === "revenue") {
    return {
      context:
        "Revenue is the top-line measure of demand and sales momentum. The useful question is whether the sales change is producing enough gross profit and cash to support the business.",
      why:
        "Revenue growth only creates value when it converts into sustainable gross profit and cash generation.",
      whatChanged: `Revenue is ${money.format(data.revenue)} and changed ${revenue} versus the prior period. Gross margin moved ${margin}, while cash changed ${cash}.`,
      attention: [
        { title: "Revenue movement", text: `Revenue changed ${revenue} versus the prior period. Confirm whether the change reflects repeatable sales activity or a one-period spike.`, severity: Number.isFinite(data.revenueChange) && data.revenueChange < 0 ? "High" : "Watch" },
        { title: "Profit conversion", text: `Gross margin moved ${margin}. Revenue growth needs to leave enough gross profit after direct costs.`, severity: Number.isFinite(data.marginChange) && data.marginChange < -2 ? "High" : "Watch" },
        { title: "Cash conversion", text: `Cash changed ${cash}. Stronger sales do not automatically mean stronger liquidity.`, severity: Number.isFinite(data.cashChange) && data.cashChange < -5 ? "High" : "Watch" },
      ],
      drivers: [
        { title: "Revenue performance", text: `Revenue is ${money.format(data.revenue)} and changed ${revenue} from the prior period.`, severity: "Watch" },
        { title: "Gross-margin conversion", text: sharedDrivers.margin, severity: marginDriver?.severity || "Watch" },
        { title: "Cash conversion", text: sharedDrivers.cash, severity: cashDriver?.severity || "Watch" },
      ],
      questions: [
        `Revenue: Is the latest sales change repeatable, and which customers or products explain it?`,
        `Margin: What changed in direct costs or mix as revenue moved?`,
        `Cash: Why did cash move ${cash} while revenue changed ${revenue}?`,
      ],
      analysis: `Revenue is the selected lens: ${money.format(data.revenue)} (${revenue} versus the prior period). The next management question is whether the sales movement is translating into margin and cash.`,
    };
  }

  if (metric === "margin") {
    const marginAttention = Number.isFinite(data.marginChange) && data.marginChange < 0
      ? `Gross margin declined ${Math.abs(data.marginChange).toFixed(1)} points versus the prior period. Review direct costs before assuming the movement is structural.`
      : `Gross margin changed ${margin} versus the prior period. Continue comparing direct costs with revenue.`;
    const cogsText = marginDriver?.observation || "The current analysis does not isolate a separate COGS driver beyond the gross-margin movement.";
    return {
      context:
        "Gross margin shows how much revenue remains after direct costs. It connects sales activity to the profit available to cover operating expenses.",
      why:
        "A small margin movement can materially change profit because the percentage applies across the full revenue base.",
      whatChanged: `Gross margin is ${data.grossMargin.toFixed(1)}% and moved ${margin} versus the prior period. Revenue changed ${revenue}; cash changed ${cash}.`,
      attention: [
        { title: "Margin movement", text: marginAttention, severity: Number.isFinite(data.marginChange) && data.marginChange < -2 ? "High" : "Watch" },
        { title: "Direct-cost explanation", text: cogsText, severity: marginDriver?.severity || "Watch" },
        { title: "Profit-to-cash link", text: `Cash changed ${cash}. A margin decline can pressure cash if the business has to fund the same operating base with less gross profit.`, severity: Number.isFinite(data.cashChange) && data.cashChange < -5 ? "High" : "Watch" },
      ],
      drivers: [
        { title: marginDriver?.title || "Gross-margin movement", text: cogsText, severity: marginDriver?.severity || "Watch" },
        { title: "Revenue base", text: `Revenue changed ${revenue}; the margin movement should be evaluated against the size and mix of sales.`, severity: "Watch" },
        { title: "Cash consequence", text: sharedDrivers.cash, severity: cashDriver?.severity || "Watch" },
      ],
      questions: [
        `Margin: Is the ${margin} movement coming from direct costs, pricing, or product mix?`,
        `Revenue: Which revenue changes occurred in the same period as the margin movement?`,
        `Cash: Is the margin movement beginning to affect operating liquidity?`,
      ],
      analysis: `Gross Margin is the selected lens: ${data.grossMargin.toFixed(1)}% (${margin} versus the prior period). The focus is explaining the direct-cost movement and its effect on profit and cash.`,
    };
  }

  if (metric === "cash") {
    return {
      context:
        "Cash position shows the liquidity currently available to run the business. Read it alongside revenue, operating expenses, receivables, and inventory because a growing business can still become cash constrained.",
      why:
        "Cash is the buffer that allows the business to pay obligations, absorb surprises, and fund operations without relying on new financing.",
      whatChanged: `Cash is ${money.format(data.cash)} and changed ${cash} versus the prior period. Revenue changed ${revenue}; inventory changed ${inventory}.`,
      attention: [
        { title: "Liquidity movement", text: Number.isFinite(data.cashChange) && data.cashChange < 0 ? `Cash declined ${Math.abs(data.cashChange).toFixed(1)}% versus the prior period. Determine whether the decline is temporary or recurring.` : `Cash changed ${cash} versus the prior period. Continue monitoring available liquidity against upcoming obligations.`, severity: Number.isFinite(data.cashChange) && data.cashChange < -5 ? "High" : "Watch" },
        { title: "Operating cash pressure", text: opexDriver?.observation || "The current analysis does not isolate an operating-expense driver. Review expense movement alongside cash. ", severity: opexDriver?.severity || "Watch" },
        { title: "Working-capital pressure", text: inventoryDriver?.observation || `Inventory is ${money.format(data.inventory)} and changed ${inventory}. Review inventory and receivables before treating the cash movement as purely operating spend.`, severity: inventoryDriver?.severity || "Watch" },
      ],
      drivers: [
        { title: "Cash movement", text: sharedDrivers.cash, severity: cashDriver?.severity || "High" },
        { title: "Operating expense pressure", text: sharedDrivers.opex, severity: opexDriver?.severity || "Watch" },
        { title: "Working capital", text: sharedDrivers.inventory, severity: inventoryDriver?.severity || "Watch" },
      ],
      questions: [
        `Cash: What caused cash to change ${cash}, and which part is recurring?`,
        `Expenses: Which operating costs are consuming the most cash right now?`,
        `Working capital: Are inventory or receivables tying up cash as sales move ${revenue}?`,
      ],
      analysis: `Cash Position is the selected lens: ${money.format(data.cash)} (${cash} versus the prior period). The focus is identifying what is consuming or releasing liquidity and whether the movement is sustainable.`,
    };
  }

  return {
    context:
      "Inventory represents cash committed to goods that have not yet been converted into sales. Read it alongside revenue, COGS, purchasing, and cash to distinguish productive inventory from cash tied up in stock.",
    why:
      "Inventory can support future sales, but excess stock ties up cash and can increase carrying and obsolescence risk.",
    whatChanged: `${inventoryChangeText(data)} Revenue changed ${revenue}; cash changed ${cash}.`,
    attention: [
      { title: "Inventory movement", text: Number.isFinite(data.inventoryChange) && data.inventoryChange > 0 ? `Inventory increased ${data.inventoryChange.toFixed(1)}% versus the prior period. Confirm the increase is supported by sales demand and planned purchasing.` : inventoryChangeText(data), severity: Number.isFinite(data.inventoryChange) && data.inventoryChange > 0 ? "Medium" : "Watch" },
      { title: "Cash tied up in stock", text: `Cash changed ${cash}. Inventory increases can absorb liquidity before the related goods are sold.`, severity: Number.isFinite(data.cashChange) && data.cashChange < -5 ? "High" : "Watch" },
      { title: "Sales support", text: `Revenue changed ${revenue}. Compare the inventory movement with sales demand before concluding that the build is excessive.`, severity: "Watch" },
    ],
    drivers: [
      { title: inventoryDriver?.title || "Inventory movement", text: inventoryDriver?.observation || inventoryChangeText(data), severity: inventoryDriver?.severity || "Watch" },
      { title: "Cash tied up in inventory", text: `Cash changed ${cash}; inventory is ${money.format(data.inventory)}. This relationship is important for working-capital management.`, severity: cashDriver?.severity || "Watch" },
      { title: "COGS and inventory conversion", text: marginDriver?.observation || "The current analysis does not isolate a separate COGS driver. Review COGS and recent purchasing against the inventory balance.", severity: marginDriver?.severity || "Watch" },
    ],
    questions: [
      `Inventory: What caused the latest inventory movement, and is it tied to planned sales demand?`,
      `Cash: How much liquidity is currently committed to inventory?`,
      `COGS: Are COGS and inventory moving consistently with the sales level?`,
    ],
    analysis: `Inventory is the selected lens: ${money.format(data.inventory)} (${Number.isFinite(data.inventoryChange) ? inventory : "no meaningful percentage comparison"}). The focus is whether inventory is supporting sales or tying up cash.`,
  };
}

function setText(node: Element | null, text: string) {
  if (node) node.textContent = text;
}

function updateBriefing() {
  const data = loadData();
  if (!data) return;

  const metric = selectedMetric();
  const copy = lensCopy(metric, data);
  const headings = Array.from(document.querySelectorAll<HTMLParagraphElement>("p"));

  // The expanded KPI detail is rendered from the same lens as the lower briefing.
  const detailCard = document.querySelector<HTMLElement>("div.rounded-2xl.border.border-blue-100.bg-blue-50\\/40");
  if (detailCard) {
    const detailColumns = Array.from(detailCard.querySelectorAll<HTMLElement>(".grid > div"));
    const labels = ["What changed", "Context", "Why it matters"];
    const values = [copy.whatChanged, copy.context, copy.why];
    detailColumns.slice(0, 3).forEach((column, index) => {
      const paragraphs = column.querySelectorAll("p");
      setText(paragraphs[1], values[index]);
    });
    setText(detailCard.querySelector("h3"), metricNames[metric]);
  }

  // What needs attention: replace the three cards with metric-specific exceptions.
  const attentionHeading = headings.find((node) => node.textContent?.trim() === "What needs attention");
  const attentionCard = attentionHeading?.parentElement?.parentElement;
  if (attentionCard) {
    const items = Array.from(attentionCard.querySelectorAll<HTMLElement>("div.w-full.rounded-xl"));
    items.slice(0, 3).forEach((item, index) => {
      const lensItem = copy.attention[index];
      if (!lensItem) return;
      const paragraphs = item.querySelectorAll("p");
      setText(paragraphs[0], lensItem.title);
      setText(paragraphs[1], lensItem.text);
    });
    const badge = attentionCard.querySelector("span.rounded-full");
    setText(badge, `${copy.attention.length} ${copy.attention.length === 1 ? "alert" : "alerts"}`);
  }

  // Lower What Changed: make each statement about the selected KPI and its closest relationships.
  const changedHeading = headings.find((node) => node.textContent?.trim() === "What changed");
  const changedCard = changedHeading?.parentElement?.parentElement;
  if (changedCard) {
    const items = Array.from(changedCard.querySelectorAll<HTMLElement>("div.rounded-xl"));
    items.slice(0, 3).forEach((item, index) => {
      setText(item.querySelector("p"), copy.attention[index]?.title || metricNames[metric]);
      setText(item.querySelectorAll("p")[1], index === 0 ? copy.whatChanged : copy.attention[index]?.text || copy.whatChanged);
    });
  }

  // Financial drivers: change both the driver title and observation, not just the observation.
  const driversHeading = headings.find((node) => node.textContent?.trim() === "Financial drivers");
  const driversCard = driversHeading?.parentElement?.parentElement;
  if (driversCard) {
    const items = Array.from(driversCard.querySelectorAll<HTMLElement>("div.rounded-xl"));
    items.slice(0, 3).forEach((item, index) => {
      const lensItem = copy.drivers[index];
      if (!lensItem) return;
      const paragraphs = item.querySelectorAll("p");
      setText(paragraphs[0], lensItem.title);
      setText(paragraphs[1], lensItem.text);
      const severity = item.querySelector("span");
      if (severity) setText(severity, lensItem.severity || "Watch");
    });
  }

  // Management questions should follow the same KPI lens so the page does not switch back to global drivers.
  const questionsHeading = headings.find((node) => node.textContent?.trim() === "Management questions");
  const questionsCard = questionsHeading?.parentElement?.parentElement;
  if (questionsCard) {
    const items = Array.from(questionsCard.querySelectorAll<HTMLElement>("div.rounded-xl"));
    items.slice(0, 3).forEach((item, index) => {
      const question = copy.questions[index];
      if (!question) return;
      setText(item, question);
    });
  }

  // Keep the AI Analysis summary aligned with the selected KPI.
  const analysisLabel = headings.find((node) => node.textContent?.trim() === "AI Analysis");
  const analysisCard = analysisLabel?.parentElement?.parentElement;
  if (analysisCard) {
    const paragraphs = analysisCard.querySelectorAll("p");
    const summary = Array.from(paragraphs).find((paragraph) => paragraph.textContent?.includes("selected lens") || paragraph.className.includes("max-w-2xl"));
    if (summary) setText(summary, copy.analysis);
  }
}

export default function BriefingContextEnhancer() {
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const run = () => {
      if (!cancelled) updateBriefing();
    };

    // CFOBriefing loads QuickBooks asynchronously. Retry briefly so the lens is
    // applied after the real data replaces the initial demo render.
    const retry = window.setInterval(() => {
      run();
      attempts += 1;
      if (attempts >= 24) window.clearInterval(retry);
    }, 250);

    const observer = new MutationObserver(() => run());
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-expanded"],
    });

    window.addEventListener("clearcfo:quickbooks-sync", run);
    window.addEventListener("clearcfo:metric-change", run);

    return () => {
      cancelled = true;
      window.clearInterval(retry);
      observer.disconnect();
      window.removeEventListener("clearcfo:quickbooks-sync", run);
      window.removeEventListener("clearcfo:metric-change", run);
    };
  }, []);

  return null;
}
