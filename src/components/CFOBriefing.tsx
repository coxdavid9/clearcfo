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
  return `${value > 0 ? "+" : ""}${formatPercentValue(value)}`;
}

export default function CFOBriefing() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<BriefingData>(demoData);
  const [liveSource, setLiveSource] = useState<"demo" | "upload" | "quickbooks">("demo");
  const [hasValidAnalysis, setHasValidAnalysis] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [expandedMetric, setExpandedMetric] = useState<ExpandedMetric>(null);

  // The headline trend should describe the latest comparable period, not an
  // empty/zero first month in a newly connected QuickBooks history.
  const trendChange = Number.isFinite(data.revenueChange) ? data.revenueChange : Number.NaN;

  const trendPoints = useMemo(() => {
    const values = data.trend.map((value) => Number(value)).filter((value) => Number.isFinite(value));
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
    return data.trend.map((value, index) => {
      const x = data.trend.length === 1 ? width / 2 : left + (index / (data.trend.length - 1)) * (width - left - right);
      const normalized = range === 0 ? 0.5 : (value - min) / range;
      const y = top + (1 - normalized) * (height - top - bottom);
      return { x, y, value };
    });
  }, [data.trend]);

  const trendPolyline = trendPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const trendLabelIndices = useMemo(() => {
    const last = Math.max(0, data.periods.length - 1);
    if (last === 0) return [0];
    return Array.from(new Set([0, Math.round(last / 3), Math.round((last * 2) / 3), last]));
  }, [data.periods.length]);
  const deterministicAnalysis = buildDeterministicExecutiveSummary(data);

  async function loadQuickBooksBriefing() {
    try {
      const cachedBriefing = window.localStorage.getItem("clearcfo_qb_briefing_cache");
      if (cachedBriefing) {
        const cached = JSON.parse(cachedBriefing) as BriefingData;
        if (cached?.companyName && Array.isArray(cached.alerts)) {
          setData(cached);
          setLiveSource("quickbooks");
          setHasValidAnalysis(true);
          setError("");
          cacheAnalysisInput(cached);
          return;
        }
      }

      const statusResponse = await fetch("/api/quickbooks/status", { cache: "no-store" });
      const statusPayload = await statusResponse.json();
      if (!statusResponse.ok || !statusPayload?.connection?.connected) return;

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
      window.localStorage.setItem("clearcfo_qb_initial_sync", "complete");
      window.localStorage.setItem("clearcfo_qb_briefing_cache", JSON.stringify(briefing));
      if (payload.syncedAt) window.localStorage.setItem("clearcfo_qb_last_synced_at", payload.syncedAt);
      cacheAnalysisInput(briefing);
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
        cacheAnalysisInput(briefing);
        return;
      }
      void loadQuickBooksBriefing();
    };

    const handleDisconnect = () => {
      window.localStorage.removeItem("clearcfo_qb_briefing_cache");
      window.localStorage.removeItem("clearcfo_qb_last_synced_at");
      window.localStorage.removeItem("clearcfo_qb_initial_sync");
      window.localStorage.removeItem("clearcfo_analysis_input");
      setLiveSource("demo");
      setHasValidAnalysis(false);
      setError("");
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
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Upload a financial workbook to generate KPIs, trends, exceptions, and prioritized recommendations.</p>
      <button type="button" onClick={() => fileRef.current?.click()} className="mt-7 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">{uploading ? "Analyzing…" : "Upload Financial Data"}</button>
      <p className="mt-3 text-xs text-slate-400">Your real customer dashboard will start here — no fake numbers.</p>
    </div>
  );

  if (!hasValidAnalysis) {
    return (
      <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
        {error && <div className="mx-auto mb-4 w-full max-w-6xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</div>}
        <div className="mx-auto w-full max-w-6xl">{emptyState}</div>
      </div>
    );
  }

  const metrics = [
    { key: "revenue" as const, label: "Revenue", value: currency.format(data.revenue), change: data.revenueChange, tone: data.revenueChange > 0 ? "text-emerald-600" : data.revenueChange < 0 ? "text-red-600" : "text-amber-600", signal: data.revenueChange > 0 ? "bg-emerald-500" : data.revenueChange < 0 ? "bg-red-500" : "bg-amber-400" },
    { key: "margin" as const, label: "Gross Margin", value: formatPercentValue(data.grossMargin), change: data.marginChange, tone: data.marginChange > 0 ? "text-emerald-600" : data.marginChange < 0 ? "text-red-600" : "text-amber-600", signal: data.marginChange > 0 ? "bg-emerald-500" : data.marginChange < 0 ? "bg-red-500" : "bg-amber-400" },
    { key: "cash" as const, label: "Cash Position", value: currency.format(data.cash), change: data.cashChange, tone: data.cashChange > 0 ? "text-emerald-600" : data.cashChange < 0 ? "text-red-600" : "text-amber-600", signal: data.cashChange > 0 ? "bg-emerald-500" : data.cashChange < 0 ? "bg-red-500" : "bg-amber-400" },
    { key: "inventory" as const, label: "Inventory", value: currency.format(data.inventory), change: data.inventoryChange, tone: !Number.isFinite(data.inventoryChange) ? "text-slate-500" : data.inventoryChange > 0 ? "text-amber-600" : data.inventoryChange < 0 ? "text-emerald-600" : "text-slate-500", signal: data.inventoryChange > 0 ? "bg-amber-400" : data.inventoryChange < 0 ? "bg-emerald-500" : "bg-slate-400" },
  ];
  const selectedMetric = expandedMetric ? metrics.find((metric) => metric.key === expandedMetric) : null;

  const renderMetricDetail = (metric: (typeof metrics)[number]) => (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">KPI detail</p><h3 className="mt-1 text-lg font-bold text-slate-900">{metric.label}</h3></div><button type="button" onClick={() => setExpandedMetric(null)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-blue-600">Close</button></div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white bg-white/80 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What changed</p><p className="mt-2 text-sm leading-6 text-slate-700">{Number.isFinite(metric.change) ? `${metric.label} is ${metric.value} and has changed ${formatPercentValue(Math.abs(metric.change))} versus the prior period.` : metric.key === "inventory" && data.inventory !== 0 ? `${metric.label} is ${metric.value}; it increased by ${currency.format(Math.abs(data.inventory))} from the prior period. A percentage comparison is not meaningful because the prior period was zero or unavailable.` : `${metric.label} is ${metric.value}; a percentage comparison is not meaningful because the prior period was zero or unavailable.`}</p></div>
        <div className="rounded-xl border border-white bg-white/80 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Context</p><p className="mt-2 text-sm leading-6 text-slate-700">{metric.key === "revenue" ? "Revenue trend is the clearest measure of top-line momentum." : metric.key === "margin" ? "Gross margin shows how much revenue remains after direct costs." : metric.key === "cash" ? "Cash should be read alongside operating performance and working capital." : "Inventory should be read alongside sales, purchasing, and cash movement."}</p></div>
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
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">Hello, David — here&apos;s what deserves your attention today.</h2>
            <p className="mt-1 text-sm text-slate-500">{liveSource !== "demo" ? data.companyName : "Your financial data"}</p>
          </div>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Financial signals</p>
              <p className="mt-1 text-xs text-slate-500">A quick read on what is improving, changing, or needs attention.</p>
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

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-900">KPI trend — Revenue performance</p><p className="mt-1 text-xs text-slate-500">Trailing {data.trend.length} periods</p></div><div className="text-right"><p className={`text-sm font-bold ${Number.isFinite(trendChange) ? trendChange >= 0 ? "text-emerald-600" : "text-red-600" : "text-slate-500"}`}>{displayChange(trendChange)}</p><p className="text-xs text-slate-400">latest trend</p></div></div>
              <div className="relative mt-5 h-56 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60">
                <svg viewBox="0 0 720 220" className="h-full w-full" role="img" aria-label="Revenue trend over available periods" preserveAspectRatio="none">
                  <line x1="18" y1="22" x2="702" y2="22" stroke="currentColor" className="text-slate-200" strokeWidth="1" /><line x1="18" y1="106" x2="702" y2="106" stroke="currentColor" className="text-slate-200" strokeWidth="1" /><line x1="18" y1="190" x2="702" y2="190" stroke="currentColor" className="text-slate-200" strokeWidth="1" />
                  {trendPolyline && <polyline points={trendPolyline} fill="none" stroke="currentColor" className="text-blue-600" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                  {trendPoints.map((point, index) => <circle key={`${data.periods[index] || index}-${index}`} cx={point.x} cy={point.y} r="4" fill="currentColor" className="text-blue-600"><title>{`${data.periods[index] || "Period"}: ${currency.format(point.value)}`}</title></circle>)}
                </svg>
              </div>
              <div className="mt-2 grid grid-cols-4 text-[10px] font-medium text-slate-400">{trendLabelIndices.map((index) => <span key={`${data.periods[index] || index}-${index}`} className={index === trendLabelIndices[trendLabelIndices.length - 1] ? "text-right" : index === 0 ? "text-left" : "text-center"}>{data.periods[index] || (index === 0 ? "Prior" : "Current")}</span>)}</div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">What needs attention</p><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">{data.attention} {data.attention === 1 ? "alert" : "alerts"}</span></div>
              <div className="mt-4 space-y-3">{data.alerts.slice(0, 3).map((alert, index) => <div key={`${alert}-${index}`} className="w-full rounded-xl border border-amber-100 bg-white/80 p-3 text-left"><p className="text-xs font-semibold text-slate-900">{index === 0 ? "Priority exception" : "Detected variance"}</p><p className="mt-1 text-xs leading-5 text-slate-500">{alert}</p></div>)}{!data.alerts.length && <p className="text-sm text-slate-500">No major exceptions were detected.</p>}</div>
            </div>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">What changed</p><div className="mt-4 space-y-3">{data.alerts.length ? data.alerts.map((alert, index) => <div key={`${alert}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{alert}</div>) : <p className="text-sm text-slate-500">No major exceptions were detected.</p>}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Financial drivers</p><div className="mt-4 space-y-3">{data.drivers.length ? data.drivers.map((driver) => <div key={driver.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{driver.title}</p><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{driver.severity}</span></div><p className="mt-1 text-sm leading-6 text-slate-600">{driver.observation}</p></div>) : <p className="text-sm text-slate-500">No major financial drivers were detected.</p>}</div></div>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Management questions</p><div className="mt-4 space-y-3">{data.drivers.map((driver) => <div key={`q-${driver.id}`} className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"><span className="font-semibold text-slate-900">{driver.category}:</span> {driver.managementQuestion}</div>)}</div></div>

          <div className="mt-10 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">AI Analysis</p><h3 className="mt-2 text-xl font-bold text-slate-900">Turn the signals into a decision.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{deterministicAnalysis}</p></div>
            <a href="/customer/analysis" className="self-start rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700">View AI Analysis →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
