"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  type BriefingData,
  type ExpandedMetric,
  demoData,
  currency,
  formatPercentValue,
  percent,
  analyzeWorkbook,
  buildDeterministicExecutiveSummary,
} from "../lib/briefing/engine";
import {
  evictQuickBooksCache,
  isQuickBooksCacheUsable,
  saveQuickBooksBriefingCache,
} from "../lib/company-scoped-cache";

function cacheAnalysisInput(briefing: BriefingData) {
  try {
    window.localStorage.setItem("clearcfo_analysis_input", JSON.stringify(briefing));
  } catch {
    // Keep the briefing usable if browser storage is unavailable.
  }
}

function displayChange(value: number, metricKey?: string, currentValue?: number): string {
  if (!Number.isFinite(value)) {
    if (metricKey === "inventory" && typeof currentValue === "number" && Number.isFinite(currentValue) && currentValue !== 0) {
      return `${currentValue > 0 ? "+" : "−"}${currency.format(Math.abs(currentValue))}`;
    }
    return "—";
  }
  if (metricKey === "margin") {
    return `${value > 0 ? "+" : ""}${Number(value.toFixed(1))} pts`;
  }
  return `${value > 0 ? "+" : ""}${formatPercentValue(value)}`;
}

function formatTrendValue(metricKey: string, value: number): string {
  return metricKey === "margin" ? `${value.toFixed(1)}%` : currency.format(value);
}

export default function CFOBriefing() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<BriefingData>(demoData);
  const [liveSource, setLiveSource] = useState<"demo" | "upload" | "quickbooks">("demo");
  const [hasValidAnalysis, setHasValidAnalysis] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [lastSyncedLabel, setLastSyncedLabel] = useState("");
  const [expandedMetric, setExpandedMetric] = useState<ExpandedMetric>(null);

  const marginBaseline = data.drivers.some((driver) => driver.id === "margin-baseline");
  const activeMetricKey = expandedMetric ?? "revenue";
  const activeMetric = useMemo(() => {
    const metricLabels: Record<string, string> = {
      revenue: "Revenue",
      margin: "Gross Margin",
      cash: "Cash Position",
      inventory: "Inventory",
    };
    const label = metricLabels[activeMetricKey] || "Revenue";
    return data.trendSeries?.find((series) => series.name === label) || {
      name: "Revenue",
      values: data.trend,
      periods: data.periods,
    };
  }, [activeMetricKey, data.trendSeries, data.trend, data.periods]);

  const trendValues = activeMetric.values || [];
  const trendPeriods = activeMetric.periods || [];
  const activeMetricDefinition = useMemo(() => {
    const metricsByKey = {
      revenue: { change: data.revenueChange, current: data.revenue },
      margin: { change: data.marginChange, current: data.grossMargin },
      cash: { change: data.cashChange, current: data.cash },
      inventory: { change: data.inventoryChange, current: data.inventory },
    } as const;
    return metricsByKey[activeMetricKey as keyof typeof metricsByKey] || metricsByKey.revenue;
  }, [activeMetricKey, data.revenueChange, data.marginChange, data.cashChange, data.inventoryChange, data.revenue, data.grossMargin, data.cash, data.inventory]);
  const trendChange = activeMetricDefinition.change;

  const trendPoints = useMemo(() => {
    const values = trendValues.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    if (!values.length) return [];
    const width = 720;
    const height = 220;
    const left = 18;
    const right = 18;
    const top = 22;
    const bottom = 30;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    return trendValues.map((value, index) => {
      const x = trendValues.length === 1 ? width / 2 : left + (index / (trendValues.length - 1)) * (width - left - right);
      const normalized = range === 0 ? 0.5 : (value - min) / range;
      const y = top + (1 - normalized) * (height - top - bottom);
      return { x, y, value };
    });
  }, [trendValues]);

  const trendPolyline = trendPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const trendLabelIndices = useMemo(() => {
    const last = Math.max(0, trendPeriods.length - 1);
    if (last === 0) return [0];
    return Array.from(new Set([0, Math.round(last / 3), Math.round((last * 2) / 3), last]));
  }, [trendPeriods.length]);
  const deterministicManagementQuestions = useMemo(() => {
    const questions: Array<{ category: string; question: string }> = [];
    const priorFromChange = (current: number, change: number): number | null => {
      if (!Number.isFinite(current) || !Number.isFinite(change) || change === -100) return null;
      const prior = current / (1 + change / 100);
      return Number.isFinite(prior) ? prior : null;
    };
    const changeDescription = (current: number, change: number): string => {
      const prior = priorFromChange(current, change);
      if (prior === null) return "the prior-period comparison is unavailable";
      const delta = current - prior;
      const percentText = formatPercentValue(Math.abs(change));
      if (Math.abs(change) >= 100 || Math.abs(prior) < 1000) {
        return `${delta >= 0 ? "up" : "down"} ${currency.format(Math.abs(delta))} (${percentText}) from ${currency.format(prior)}`;
      }
      return `${delta >= 0 ? "up" : "down"} ${percentText}`;
    };
    if (Number.isFinite(data.revenueChange)) {
      questions.push({
        category: "Revenue",
        question: `Revenue is ${currency.format(data.revenue)} and moved ${changeDescription(data.revenue, data.revenueChange)} versus the prior period. What changed in customer volume, pricing, or mix to produce that movement?`,
      });
    }
    if (Number.isFinite(data.operatingExpense) && Number.isFinite(data.previousOperatingExpense)) {
      const currentExpense = data.operatingExpense ?? 0;
      const previousExpense = data.previousOperatingExpense ?? 0;
      const delta = currentExpense - previousExpense;
      questions.push({
        category: "Expenses",
        question: `Operating expenses moved from ${currency.format(previousExpense)} to ${currency.format(currentExpense)} (${delta >= 0 ? "+" : ""}${currency.format(delta)}). Which expense accounts make up that dollar movement, and which costs are recurring?`,
      });
    } else if (Number.isFinite(data.revenueChange)) {
      questions.push({
        category: "Expenses",
        question: "Which expense accounts are responsible for the largest change in operating costs, and which increases are recurring versus one-time?",
      });
    }
    if (Number.isFinite(data.cashChange) && data.cashChange < 0) {
      questions.push({
        category: "Cash",
        question: `Cash is ${currency.format(data.cash)} and moved ${changeDescription(data.cash, data.cashChange)} versus the prior period. How much of the change came from receivables, inventory, payables, debt, capital spending, or owner distributions?`,
      });
    }
    if (Number.isFinite(data.marginChange) && data.marginChange < -2) {
      questions.push({
        category: "Margin",
        question: `Gross margin declined ${Math.abs(data.marginChange).toFixed(1)} percentage points. Was the movement driven by pricing, product mix, or direct-cost changes?`,
      });
    }
    if (Number.isFinite(data.inventoryChange) && data.inventoryChange !== 0) {
      questions.push({
        category: "Inventory",
        question: `Inventory is ${currency.format(data.inventory)} and moved ${changeDescription(data.inventory, data.inventoryChange)} versus the prior period. Is inventory moving in line with sales, and are any items becoming slow-moving?`,
      });
    }
    return questions.slice(0, 5);
  }, [data.revenue, data.revenueChange, data.operatingExpense, data.previousOperatingExpense, data.cash, data.cashChange, data.marginChange, data.inventory, data.inventoryChange]);

  const deterministicAnalysis = buildDeterministicExecutiveSummary(data);

  function formatSyncedAt(raw: string | null): string {
    try {
      const time = raw ? new Date(raw).getTime() : NaN;
      return Number.isFinite(time) ? new Date(time).toLocaleString() : "";
    } catch {
      return "";
    }
  }

  async function loadQuickBooksBriefing() {
    try {
      const cachedBriefing = window.localStorage.getItem("clearcfo_qb_briefing_cache");
      let cached: BriefingData | null = null;
      let cachedSyncedAt: string | null = null;
      try {
        if (cachedBriefing) cached = JSON.parse(cachedBriefing) as BriefingData;
        cachedSyncedAt = window.localStorage.getItem("clearcfo_qb_last_synced_at");
      } catch {
        cached = null;
        cachedSyncedAt = null;
      }

      let serverBriefing: BriefingData | null = null;
      let serverSyncedAt: string | null = null;
      try {
        const latestResponse = await fetch("/api/briefing/latest", { cache: "no-store" });
        if (latestResponse.ok) {
          const latestPayload = await latestResponse.json();
          if (latestPayload?.briefing?.companyName && Array.isArray(latestPayload.briefing.trend)) {
            serverBriefing = latestPayload.briefing as BriefingData;
            serverSyncedAt = typeof latestPayload.syncedAt === "string" ? latestPayload.syncedAt : null;
          }
        }
      } catch {
        // Server storage is optional; preserve the existing local-cache fallback.
      }

      const serverTime = serverSyncedAt ? new Date(serverSyncedAt).getTime() : NaN;
      const cachedTime = cachedSyncedAt ? new Date(cachedSyncedAt).getTime() : NaN;
      const useServerBriefing = Boolean(serverBriefing) && (
        !cached ||
        !Number.isFinite(cachedTime) ||
        (Number.isFinite(serverTime) && serverTime > cachedTime)
      );
      if (useServerBriefing && serverBriefing) {
        cached = serverBriefing;
        cachedSyncedAt = serverSyncedAt;
      }

      let statusPayload: any = null;
      let statusOk = false;
      try {
        const statusResponse = await fetch("/api/quickbooks/status", { cache: "no-store" });
        statusOk = statusResponse.ok;
        statusPayload = await statusResponse.json();
      } catch {
        // A transient non-JSON status response must not error the whole page:
        // fall through to the cached briefing below.
      }
      // Multi-company isolation: the cached briefing belongs to exactly one
      // business. isQuickBooksCacheUsable evicts the other business's caches
      // on a definite mismatch; when the company cannot be verified (e.g.
      // offline) it keeps the legacy stale-cache fallback.
      const activeCompanyId = statusPayload?.activeCompanyId || statusPayload?.connection?.companyId || null;
      const selectedServerBriefing = useServerBriefing && Boolean(serverBriefing);
      if (!isQuickBooksCacheUsable(activeCompanyId)) {
        cached = selectedServerBriefing ? serverBriefing : null;
      }
      if (selectedServerBriefing && cached && activeCompanyId) {
        saveQuickBooksBriefingCache(cached, activeCompanyId);
        if (serverSyncedAt) window.localStorage.setItem("clearcfo_qb_last_synced_at", serverSyncedAt);
      }
      if (!statusOk || !statusPayload?.connection?.connected) {
        if (cached?.companyName && Array.isArray(cached.alerts)) {
          setData(cached);
          setLiveSource("quickbooks");
          setHasValidAnalysis(true);
          cacheAnalysisInput(cached);
          setLastSyncedLabel(formatSyncedAt(cachedSyncedAt));
        }
        return;
      }

      try {
        const response = await fetch("/api/quickbooks/sync", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload?.briefing) {
          throw new Error(payload?.error || "ClearCFO could not load your QuickBooks financial data.");
        }

        const briefing = payload.briefing as BriefingData;
        setData(briefing);
        setLiveSource("quickbooks");
        setHasValidAnalysis(true);
        setError("");
        setSyncNotice("");
        setLastSyncedLabel(formatSyncedAt(payload.syncedAt || null));
        window.localStorage.setItem("clearcfo_qb_initial_sync", "complete");
        saveQuickBooksBriefingCache(briefing, payload.companyId);
        if (payload.syncedAt) window.localStorage.setItem("clearcfo_qb_last_synced_at", payload.syncedAt);
        cacheAnalysisInput(briefing);
      } catch (syncErr) {
        if (cached?.companyName && Array.isArray(cached.alerts)) {
          setData(cached);
          setLiveSource("quickbooks");
          setHasValidAnalysis(true);
          cacheAnalysisInput(cached);
          const staleLabel = formatSyncedAt(window.localStorage.getItem("clearcfo_qb_last_synced_at"));
          setLastSyncedLabel(staleLabel);
          setSyncNotice(staleLabel ? `Couldn't refresh your QuickBooks data — showing your last synced briefing from ${staleLabel}.` : "Couldn't refresh your QuickBooks data — showing your last synced briefing.");
          return;
        }
        throw syncErr;
      }
    } catch (err) {
      setHasValidAnalysis(false);
      setError(err instanceof Error ? err.message : "ClearCFO could not load your QuickBooks financial data.");
    }
  }

  useEffect(() => {
    void loadQuickBooksBriefing();

    const handleSync = (event: Event) => {
      const payload = (event as CustomEvent)?.detail;
      if (payload?.briefing) {
        const briefing = payload.briefing as BriefingData;
        setData(briefing);
        setLiveSource("quickbooks");
        setHasValidAnalysis(true);
        setError("");
        setSyncNotice("");
        setLastSyncedLabel(formatSyncedAt(window.localStorage.getItem("clearcfo_qb_last_synced_at")));
        cacheAnalysisInput(briefing);
        return;
      }
      void loadQuickBooksBriefing();
    };

    const handleDisconnect = () => {
      evictQuickBooksCache();
      setLiveSource("demo");
      setHasValidAnalysis(false);
      setError("");
      setSyncNotice("");
      setLastSyncedLabel("");
    };

    window.addEventListener("clearcfo:quickbooks-sync", handleSync);
    window.addEventListener("clearcfo:quickbooks-disconnected", handleDisconnect);
    return () => {
      window.removeEventListener("clearcfo:quickbooks-sync", handleSync);
      window.removeEventListener("clearcfo:quickbooks-disconnected", handleDisconnect);
    };
  }, []);

  const toggleMetric = (metric: ExpandedMetric) => setExpandedMetric((current) => current === metric ? null : metric);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setHasValidAnalysis(false);
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { cellDates: true });
      const analyzed = analyzeWorkbook(workbook);
      setData(analyzed);
      setLiveSource("upload");
      setHasValidAnalysis(true);
      setSyncNotice("");
      setLastSyncedLabel("");
      cacheAnalysisInput(analyzed);
    } catch (err) {
      setHasValidAnalysis(false);
      setError(err instanceof Error ? err.message : "We couldn't read that workbook. Please check the file format and sheet names.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const emptyState = (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-600">✦</div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ClearCFO Intelligence</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Your CFO Briefing starts with your data.</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Connect QuickBooks or upload a financial workbook to generate KPIs, trends, exceptions, and prioritized recommendations.</p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a href="/api/quickbooks/connect" className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">Connect QuickBooks</a>
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">{uploading ? "Analyzing…" : "Upload Financial Data"}</button>
      </div>
      <p className="mt-3 text-xs text-slate-400">Your real customer dashboard will start here — no fake numbers.</p>
    </div>
  );

  const metrics = [
    { key: "revenue" as const, label: "Revenue", value: currency.format(data.revenue), change: data.revenueChange, tone: data.revenueChange > 0 ? "text-emerald-600" : data.revenueChange < 0 ? "text-red-600" : "text-amber-600", signal: data.revenueChange > 0 ? "bg-emerald-500" : data.revenueChange < 0 ? "bg-red-500" : "bg-amber-400" },
    { key: "margin" as const, label: "Gross Margin", value: formatPercentValue(data.grossMargin), change: data.marginChange, tone: marginBaseline ? "text-amber-600" : data.marginChange > 0 ? "text-emerald-600" : data.marginChange < 0 ? "text-red-600" : "text-amber-600", signal: marginBaseline ? "bg-amber-400" : data.marginChange > 0 ? "bg-emerald-500" : data.marginChange < 0 ? "bg-red-500" : "bg-amber-400" },
    { key: "cash" as const, label: "Cash Position", value: currency.format(data.cash), change: data.cashChange, tone: data.cashChange > 0 ? "text-emerald-600" : data.cashChange < 0 ? "text-red-600" : "text-amber-600", signal: data.cashChange > 0 ? "bg-emerald-500" : data.cashChange < 0 ? "bg-red-500" : "bg-amber-400" },
    { key: "inventory" as const, label: "Inventory", value: currency.format(data.inventory), change: data.inventoryChange, tone: !Number.isFinite(data.inventoryChange) ? "text-slate-500" : data.inventoryChange > 0 ? "text-amber-600" : data.inventoryChange < 0 ? "text-emerald-600" : "text-slate-500", signal: data.inventoryChange > 0 ? "bg-amber-400" : data.inventoryChange < 0 ? "bg-emerald-500" : "bg-slate-400" },
  ];
  const selectedMetric = expandedMetric ? metrics.find((metric) => metric.key === expandedMetric) : null;
  const mtd = data.mtdComparison;
  const mtdMetrics = mtd
    ? [
        { label: "Revenue", comparison: mtd.revenue, goodWhenUp: true },
        { label: "Gross Profit", comparison: mtd.grossProfit, goodWhenUp: true },
        { label: "Operating Expenses", comparison: mtd.operatingExpense, goodWhenUp: false },
        { label: "Net Income", comparison: mtd.netIncome, goodWhenUp: true },
      ]
    : [];
  const attentionDrivers = useMemo(() => {
    const keywordMap: Record<string, string[]> = {
      revenue: ["revenue", "sales", "top-line"],
      margin: ["margin", "cogs", "gross profit", "direct cost", "pricing", "product mix"],
      cash: ["cash", "liquidity", "working capital", "cash flow"],
      inventory: ["inventory", "stock", "working capital"]
    };
    const keywords = keywordMap[activeMetricKey] || keywordMap.revenue;
    const matches = data.drivers.filter((driver) => {
      const text = `${driver.category} ${driver.title} ${driver.observation} ${driver.evidence.join(" ")}`.toLowerCase();
      return keywords.some((keyword) => text.includes(keyword));
    });
    return matches.slice(0, 3);
  }, [activeMetricKey, data.drivers]);
  const whatChangedItems = useMemo(() => {
    const current = activeMetricDefinition.current;
    const change = activeMetricDefinition.change;
    const valueText = activeMetricKey === "margin" ? formatPercentValue(current) : currency.format(current);

    if (activeMetricKey === "revenue") {
      const items = [
        Number.isFinite(change)
          ? `Revenue moved from the prior period to ${valueText}, a ${change >= 0 ? "increase" : "decrease"} of ${formatPercentValue(Math.abs(change))}.`
          : `Revenue is ${valueText}; the prior-period comparison is unavailable.`,
      ];
      if (Number.isFinite(data.marginChange) && data.marginChange !== 0) {
        items.push(`Gross margin moved ${data.marginChange >= 0 ? "up" : "down"} ${Math.abs(data.marginChange).toFixed(1)} percentage points.`);
      }
      if (Number.isFinite(data.cashChange) && data.cashChange !== 0) {
        items.push(`Cash moved ${data.cashChange >= 0 ? "up" : "down"} ${formatPercentValue(Math.abs(data.cashChange))}.`);
      }
      return items.slice(0, 3);
    }

    if (activeMetricKey === "margin") {
      const grossProfit = data.revenue * data.grossMargin / 100;
      const previousRevenue = Number.isFinite(data.revenueChange) && data.revenueChange !== -100
        ? data.revenue / (1 + data.revenueChange / 100)
        : NaN;
      const previousMargin = Number.isFinite(data.marginChange) ? data.grossMargin - data.marginChange : NaN;
      const previousGrossProfit = Number.isFinite(previousRevenue) && Number.isFinite(previousMargin)
        ? previousRevenue * previousMargin / 100
        : NaN;
      const cogs = data.revenue - grossProfit;
      const previousCogs = Number.isFinite(previousGrossProfit) ? previousRevenue - previousGrossProfit : NaN;
      const items = [
        Number.isFinite(change)
          ? `Gross margin is ${valueText}, ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)} percentage points versus the prior period.`
          : `Gross margin is ${valueText}; the prior-period comparison is unavailable.`,
      ];
      if (Number.isFinite(cogs) && Number.isFinite(previousCogs)) {
        items.push(`COGS was ${currency.format(cogs)} this period versus ${currency.format(previousCogs)} in the prior period.`);
      }
      if (Number.isFinite(data.revenueChange) && data.revenueChange !== 0) {
        items.push(`Revenue ${data.revenueChange >= 0 ? "increased" : "decreased"} ${formatPercentValue(Math.abs(data.revenueChange))} during the same period.`);
      }
      return items.slice(0, 3);
    }

    if (activeMetricKey === "cash") {
      const items = [
        Number.isFinite(change)
          ? `Cash Position is ${valueText}, ${change >= 0 ? "up" : "down"} ${formatPercentValue(Math.abs(change))} versus the prior period.`
          : `Cash Position is ${valueText}; the prior-period comparison is unavailable.`,
      ];
      if (Number.isFinite(data.inventoryChange) && data.inventoryChange !== 0) {
        items.push(`Inventory ${data.inventoryChange >= 0 ? "increased" : "decreased"} ${formatPercentValue(Math.abs(data.inventoryChange))}.`);
      }
      if (Number.isFinite(data.revenueChange) && data.revenueChange !== 0) {
        items.push(`Revenue ${data.revenueChange >= 0 ? "increased" : "decreased"} ${formatPercentValue(Math.abs(data.revenueChange))}.`);
      }
      return items.slice(0, 3);
    }

    const items = [
      Number.isFinite(change)
        ? `Inventory is ${valueText}, ${change >= 0 ? "up" : "down"} ${formatPercentValue(Math.abs(change))} versus the prior period.`
        : `Inventory is ${valueText}; the prior-period comparison is unavailable.`,
    ];
    if (Number.isFinite(data.revenueChange) && data.revenueChange !== 0) {
      items.push(`Revenue ${data.revenueChange >= 0 ? "increased" : "decreased"} ${formatPercentValue(Math.abs(data.revenueChange))}.`);
    }
    if (Number.isFinite(data.cashChange) && data.cashChange !== 0) {
      items.push(`Cash ${data.cashChange >= 0 ? "increased" : "decreased"} ${formatPercentValue(Math.abs(data.cashChange))}.`);
    }
    return items.slice(0, 3);
  }, [activeMetricKey, activeMetricDefinition.current, activeMetricDefinition.change, data.revenue, data.grossMargin, data.revenueChange, data.marginChange, data.cashChange, data.inventoryChange]);

  const financialDrivers = useMemo(() => {
    const current = activeMetricDefinition.current;
    const change = activeMetricDefinition.change;
    const currentText = activeMetricKey === "margin" ? formatPercentValue(current) : currency.format(current);
    const priorFromChange = (currentValue: number, changeValue: number): number | null => {
      if (!Number.isFinite(currentValue) || !Number.isFinite(changeValue) || changeValue === -100) return null;
      const prior = currentValue / (1 + changeValue / 100);
      return Number.isFinite(prior) ? prior : null;
    };
    const observedChange = (currentValue: number, changeValue: number): string => {
      const prior = priorFromChange(currentValue, changeValue);
      if (prior === null) return "the prior-period comparison is unavailable";
      const delta = currentValue - prior;
      if (activeMetricKey === "margin") return `${changeValue >= 0 ? "up" : "down"} ${Math.abs(changeValue).toFixed(1)} percentage points`;
      if (Math.abs(changeValue) >= 100 || Math.abs(prior) < 1000) return `${delta >= 0 ? "up" : "down"} ${currency.format(Math.abs(delta))} (${formatPercentValue(Math.abs(changeValue))}) from ${currency.format(prior)}`;
      return `${changeValue >= 0 ? "up" : "down"} ${formatPercentValue(Math.abs(changeValue))}`;
    };
    const categoryMap: Record<string, string> = { revenue: "Revenue", margin: "Margin", cash: "Cash", inventory: "Inventory" };
    const category = categoryMap[activeMetricKey] || "Revenue";
    const observedDrivers = data.drivers.filter((driver) => driver.category === category);
    const detailed = observedDrivers.filter((driver) =>
      ["revenue-customer-mix", "margin-pressure", "receivables-concentration", "inventory-detail"].includes(driver.id) ||
      driver.id === "expense-detail" || driver.id === "vendor-spend"
    );
    const primaryObserved = detailed[0];
    const fallback: Record<string, Array<{ title: string; observation: string; estimatedImpact?: number }>> = {
      revenue: [
        { title: "Sales volume", observation: `Revenue is ${currentText} and ${observedChange(current, change)}. Review units or customer activity to determine whether the movement is volume-driven.` },
        { title: "Pricing & mix", observation: "Compare revenue movement with pricing changes and product or customer mix to separate price effects from changes in sales activity." },
        { title: "Customer concentration", observation: "Check whether a small number of customers are driving the change. Concentrated revenue movement can make the trend less durable than the headline KPI suggests." },
      ],
      margin: [
        { title: "Pricing", observation: `Gross margin is ${currentText} and ${observedChange(current, change)}. Review whether selling prices are keeping pace with direct costs.` },
        { title: "Direct costs", observation: "Review COGS for supplier price increases, labor changes, freight, or other direct-cost movements that may be compressing margin." },
        { title: "Product mix", observation: "Determine whether the sales mix shifted toward higher- or lower-margin products, services, or customers. Mix can move gross margin even when revenue is stable." },
      ],
      cash: [
        { title: "Collections", observation: `Cash is ${currentText} and ${observedChange(current, change)}. Review receivables aging and collection timing to understand the operating cash movement.` },
        { title: "Working capital", observation: "Look at receivables, payables, and inventory together. Working capital can absorb cash even while the income statement remains profitable." },
        { title: "Debt & capital spending", observation: "Separate operating cash movement from debt payments, owner distributions, and capital purchases to identify what is driving available liquidity." },
      ],
      inventory: [
        { title: "Sales velocity", observation: `Inventory is ${currentText} and ${observedChange(current, change)}. Compare inventory growth with sales growth to see whether stock is building faster than demand.` },
        { title: "Purchasing", observation: "Review purchasing levels, order timing, and supplier commitments. Inventory can rise from planned buying or purchases made ahead of expected demand." },
        { title: "Slow-moving stock", observation: "Identify aging or slow-moving inventory that may be tying up cash and increasing the risk of markdowns, write-downs, or obsolete stock." },
      ],
    };
    const base = fallback[activeMetricKey] || fallback.revenue;
    if (!primaryObserved) return base.map((item) => ({ ...item, severity: "Medium" as const }));
    const observed = {
      title: primaryObserved.title,
      observation: primaryObserved.observation + (primaryObserved.evidence.length ? ` Evidence: ${primaryObserved.evidence.slice(0, 2).join("; ")}.` : ""),
      severity: primaryObserved.severity === "High" ? "High" as const : "Medium" as const,
      estimatedImpact: primaryObserved.estimatedImpact,
    };
    return [observed, ...base.filter((item) => item.title !== observed.title).slice(0, 2)];
  }, [activeMetricKey, activeMetricDefinition.current, activeMetricDefinition.change, data.drivers]);

  if (!hasValidAnalysis) {
    return (
      <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
        {error && <div className="mx-auto mb-4 w-full max-w-6xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</div>}
        <div className="mx-auto w-full max-w-6xl">{emptyState}</div>
      </div>
    );
  }

  const renderMetricDetail = (metric: (typeof metrics)[number]) => (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">KPI detail</p><h3 className="mt-1 text-lg font-bold text-slate-900">{metric.label}</h3></div><button type="button" onClick={() => setExpandedMetric(null)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-blue-600">Close</button></div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white bg-white/80 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What changed</p><p className="mt-2 text-sm leading-6 text-slate-700">{metric.key === "margin" && marginBaseline ? data.drivers.find((driver) => driver.id === "margin-baseline")?.observation : Number.isFinite(metric.change) ? `${metric.label} is ${metric.value} and ${metric.change >= 0 ? "increased" : "decreased"} ${metric.key === "margin" ? `${Number(Math.abs(metric.change).toFixed(1))} percentage points` : `${formatPercentValue(Math.abs(metric.change))}`} versus the prior period.` : `${metric.label} is ${metric.value}; the prior-period comparison is unavailable, so ClearCFO is not estimating the direction or size of the change.`}</p></div>
        <div className="rounded-xl border border-white bg-white/80 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Context</p><p className="mt-2 text-sm leading-6 text-slate-700">{metric.key === "revenue" ? "Revenue trend is the clearest measure of top-line momentum." : metric.key === "margin" ? "Gross margin shows how much revenue remains after direct costs." : metric.key === "cash" ? "Cash is the company's immediately available liquidity. It funds payroll, bills, debt payments, and unexpected needs, so the balance should be viewed alongside profitability and working-capital movements." : "Inventory represents cash tied up in goods that have not yet been sold. A rising inventory balance can be reasonable when sales are growing, but it can also signal slower-moving stock or purchasing ahead of demand."}</p></div>
        <div className="rounded-xl border border-white bg-white/80 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Why it matters</p><p className="mt-2 text-sm leading-6 text-slate-700">{metric.key === "revenue" ? "Growth needs to translate into sustainable gross profit and cash generation." : metric.key === "margin" ? "Small margin changes can materially affect profit as revenue scales." : metric.key === "cash" ? "Cash availability affects the company's ability to absorb surprises and fund operations." : "Inventory tied up in the business can affect liquidity and working capital efficiency."}</p></div>
      </div>
    </div>
  );

  return (
    <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_25px_80px_-35px_rgba(15,23,42,0.35)]">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
        <div className="border-b border-slate-200 bg-white px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs text-white">✦</span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ClearCFO Intelligence</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Financial briefing</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{liveSource === "quickbooks" ? "QuickBooks financial data" : liveSource === "upload" ? `Last analyzed: ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Demo financial data"}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">{uploading ? "Analyzing…" : "Upload Excel"}</button>
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${data.health === "strong" ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : data.health === "watch" ? "border border-amber-100 bg-amber-50 text-amber-700" : "border border-red-100 bg-red-50 text-red-700"}`}>
                <span className={`h-2 w-2 rounded-full ${data.health === "strong" ? "bg-emerald-500" : data.health === "watch" ? "bg-amber-500" : "bg-red-500"}`} />Business health: {data.health}
              </div>
            </div>
          </div>
        </div>

        <div className="p-7 sm:p-10">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Today&apos;s CFO Briefing</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">Here&apos;s what deserves your attention today.</h2>
            <p className="mt-1 text-sm text-slate-500">{liveSource !== "demo" ? data.companyName : "Your financial data"}{liveSource === "quickbooks" && lastSyncedLabel ? ` · Last synced ${lastSyncedLabel}` : ""}</p>
          </div>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {syncNotice && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{syncNotice}</div>}

          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Financial signals</p>
              <p className="mt-1 text-xs text-slate-500">Click a KPI to make it the main trend.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Positive</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Monitor</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Attention</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => {
              const isExpanded = expandedMetric === metric.key;
              return (
                <div key={metric.key} className="min-w-0">
                  <button type="button" onClick={() => toggleMetric(metric.key)} aria-expanded={isExpanded} className={`relative min-h-[132px] w-full rounded-2xl border p-5 text-left shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${isExpanded ? "z-10 border-blue-300 bg-blue-50/70 shadow-lg shadow-blue-900/10 md:-translate-y-1 md:scale-[1.02]" : expandedMetric ? "border-slate-200 bg-white opacity-65 hover:opacity-100" : "border-slate-200 bg-white hover:-translate-y-1 hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/5"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${metric.signal}`} aria-hidden="true" /><p className="text-xs font-medium text-slate-500 sm:text-sm">{metric.label}</p></div>
                      <span className="text-sm font-semibold text-slate-400">{isExpanded ? "Selected" : "View detail"}</span>
                    </div>
                    <p className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{metric.value}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold sm:text-sm"><span className={metric.tone}>{displayChange(metric.change, metric.key, metric.key === "inventory" ? data.inventory : undefined)}</span><span className="font-normal text-slate-400">vs. prior period</span></div>
                  </button>
                  {isExpanded && <div className="mt-4 md:hidden">{renderMetricDetail(metric)}</div>}
                </div>
              );
            })}
          </div>

          {selectedMetric && <div className="mt-6 hidden md:block">{renderMetricDetail(selectedMetric)}</div>}

          {mtd && mtdMetrics.length > 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Month to date</p>
                  <p className="mt-1 text-xs text-slate-500">{mtd.currentLabel} vs {mtd.previousLabel} · same days, prior month</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {mtdMetrics.map((item) => {
                  const change = item.comparison.change;
                  const positive = change > 0;
                  const negative = change < 0;
                  const good = item.goodWhenUp ? positive : negative;
                  const bad = item.goodWhenUp ? negative : positive;
                  const tone = !Number.isFinite(change) ? "text-slate-400" : good ? "text-emerald-600" : bad ? "text-red-600" : "text-slate-500";
                  return (
                    <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <p className="text-xs font-medium text-slate-500">{item.label}</p>
                      <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{currency.format(item.comparison.current)}</p>
                      <p className="mt-1 text-xs font-semibold"><span className={tone}>{displayChange(change)}</span> <span className="font-normal text-slate-400">vs {mtd.previousLabel}</span></p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-900">KPI trend — {activeMetric.name}</p><p className="mt-1 text-xs text-slate-500">Trailing {trendValues.length} periods</p></div><div className="text-right"><p className={`text-sm font-bold ${Number.isFinite(trendChange) ? trendChange >= 0 ? "text-emerald-600" : "text-red-600" : "text-slate-500"}`}>{displayChange(trendChange, activeMetricKey, activeMetricDefinition.current)}</p><p className="text-xs text-slate-400">latest trend</p></div></div>
              <div className="relative mt-5 h-56 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60">
                <svg viewBox="0 0 720 220" className="h-full w-full" role="img" aria-label={`${activeMetric.name} trend over available periods`} preserveAspectRatio="none">
                  <line x1="18" y1="22" x2="702" y2="22" stroke="currentColor" className="text-slate-200" strokeWidth="1" /><line x1="18" y1="106" x2="702" y2="106" stroke="currentColor" className="text-slate-200" strokeWidth="1" /><line x1="18" y1="190" x2="702" y2="190" stroke="currentColor" className="text-slate-200" strokeWidth="1" />
                  {trendPolyline && <polyline points={trendPolyline} fill="none" stroke="currentColor" className={activeMetricKey === "cash" ? "text-emerald-600" : activeMetricKey === "inventory" ? "text-violet-600" : activeMetricKey === "margin" ? "text-indigo-600" : "text-blue-600"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                  {trendPoints.map((point, index) => <circle key={`${trendPeriods[index] || index}-${index}`} cx={point.x} cy={point.y} r="4" fill="currentColor" className={activeMetricKey === "cash" ? "text-emerald-600" : activeMetricKey === "inventory" ? "text-violet-600" : activeMetricKey === "margin" ? "text-indigo-600" : "text-blue-600"}><title>{`${trendPeriods[index] || "Period"}: ${formatTrendValue(activeMetricKey, point.value)}`}</title></circle>)}
                </svg>
              </div>
              <div className="mt-2 grid grid-cols-4 text-[10px] font-medium text-slate-400">{trendLabelIndices.map((index) => <span key={`${trendPeriods[index] || index}-${index}`} className={index === trendLabelIndices[trendLabelIndices.length - 1] ? "text-right" : index === 0 ? "text-left" : "text-center"}>{trendPeriods[index] || (index === 0 ? "Prior" : "Current")}</span>)}</div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">What needs attention</p><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">{attentionDrivers.length} {attentionDrivers.length === 1 ? "item" : "items"}</span></div>
              <p className="mt-1 text-xs text-slate-500">Focused on {activeMetric.name}.</p>
              <div className="mt-4 space-y-3">
                {attentionDrivers.length ? attentionDrivers.map((driver) => <div key={driver.id} className="w-full rounded-xl border border-amber-100 bg-white/80 p-3 text-left">
                  <div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-slate-900">{driver.title}</p><span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide ${driver.severity === "High" ? "text-red-600" : driver.severity === "Medium" ? "text-amber-600" : "text-slate-400"}`}>{driver.severity}</span></div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{driver.observation}</p>
                </div>) : <p className="text-sm text-slate-500">No specific issues were detected for {activeMetric.name.toLowerCase()}.</p>}
              </div>
            </div>
          </div>

          {data.ratios && data.ratios.length > 0 && (
            <div className="mt-10">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Financial ratios</p>
                <p className="mt-1 text-xs text-slate-500">Balance-sheet health for the latest synced period.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.ratios.map((ratio) => (
                    <div key={ratio.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ratio.health === "strong" ? "bg-emerald-500" : ratio.health === "watch" ? "bg-amber-500" : "bg-red-500"}`} aria-hidden="true" />
                        <p className="text-xs font-semibold text-slate-500">{ratio.label}</p>
                      </div>
                      <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{ratio.value}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{ratio.interpretation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {data.detailDrivers && data.detailDrivers.some((item) => item.category) && (
            <div className="mt-10">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">What moved</p>
                <p className="mt-1 text-xs text-slate-500">The largest period-over-period movers behind the headline numbers.</p>
                {(["Revenue", "Operating Expense"] as const).map((group) => {
                  const items = data.detailDrivers.filter((item) => item.category === group).slice(0, 5);
                  if (!items.length) return null;
                  return (
                    <div key={group} className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{group} movers</p>
                      <div className="mt-2 space-y-2">
                        {items.map((item) => (
                          <div key={group + "-" + item.name} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                            <p className="text-sm">
                              <span className="text-slate-500">{currency.format(Math.round(item.previous))} → </span>
                              <span className="font-bold text-slate-900">{currency.format(Math.round(item.current))}</span>
                              <span className={item.change >= 0 ? "ml-2 font-semibold text-emerald-600" : "ml-2 font-semibold text-red-600"}>{item.change >= 0 ? "+" : "−"}{currency.format(Math.abs(Math.round(item.change)))}{item.previous !== 0 ? " (" + formatPercentValue(item.percentChange) + ")" : ""}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-10">            <div className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Financial drivers</p><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600">{activeMetric.name}</span></div><p className="mt-1 text-xs text-slate-500">Business factors that can move {activeMetric.name.toLowerCase()}.</p><div className="mt-4 space-y-3">{financialDrivers.map((driver) => <div key={driver.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{driver.title}</p></div><p className="mt-1 text-sm leading-6 text-slate-600">{driver.observation}</p>{driver.estimatedImpact !== undefined && <p className="mt-2 text-xs font-bold text-blue-700">Est. impact: {currency.format(Math.round(driver.estimatedImpact))}</p>}</div>)}</div></div>
          </div>

          {data.cashFlow && (
            <div className="mt-10">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Cash flow</p>
                <p className="mt-1 text-xs text-slate-500">From net income to cash: working-capital changes for the latest period.</p>
                <div className="mt-4 space-y-2">
                  {data.cashFlow.lines.map((line) => (
                    <div key={line.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{line.label}</p>
                      <p className={line.value >= 0 ? "text-sm font-bold text-emerald-600" : "text-sm font-bold text-red-600"}>{line.value >= 0 ? "+" : "−"}{currency.format(Math.abs(Math.round(line.value)))}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-600 px-4 py-3">
                    <p className="text-sm font-bold text-white">Net cash from operations</p>
                    <p className="text-sm font-bold text-white">{data.cashFlow.operatingCashFlow >= 0 ? "+" : "−"}{currency.format(Math.abs(Math.round(data.cashFlow.operatingCashFlow)))}</p>
                  </div>
                </div>
                {data.cashFlow.cashChange !== null && (
                  <p className="mt-3 text-xs text-slate-500">Reported change in cash: {data.cashFlow.cashChange >= 0 ? "+" : "−"}{currency.format(Math.abs(Math.round(data.cashFlow.cashChange)))}.</p>
                )}
              </div>
            </div>
          )}
          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Management questions</p><p className="mt-1 text-xs text-slate-500">{liveSource === "upload" ? "Questions generated from your uploaded financial data." : "Questions generated from the financial data ClearCFO received from QuickBooks."}</p><div className="mt-4 space-y-3">{(data.managementQuestions?.length ? data.managementQuestions : deterministicManagementQuestions).map((item, index) => <div key={`mq-${item.category}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"><span className="font-semibold text-slate-900">{item.category}:</span> {item.question}</div>)}</div></div>

          <div className="mt-10 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">AI Analysis</p><h3 className="mt-2 text-xl font-bold text-slate-900">Turn the signals into a decision.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{deterministicAnalysis}</p></div>
            <a href="/customer/analysis" className="self-start rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700">View AI Analysis →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
