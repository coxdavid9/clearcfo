"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { detectExpenseSpikeRecovery } from "../lib/scenario-detection";
import {
  type BriefingData,
  type AIAnalysis,
  type ExpandedMetric,
  demoData,
  currency,
  formatPercentValue,
  percent,
  formatCurrency,
  analyzeWorkbook,
  scoreAIAction,
  buildDeterministicExecutiveSummary
} from "../lib/briefing/engine";

export default function CFOBriefing() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<BriefingData>(demoData);
  const [liveSource, setLiveSource] = useState<"demo" | "upload" | "quickbooks">("demo");
  const [hasValidAnalysis, setHasValidAnalysis] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [expandedMetric, setExpandedMetric] = useState<ExpandedMetric>(null);
  const showFinancialDetail = true;

  const trendChange = data.trend.length >= 2 && data.trend[0] !== 0
    ? ((data.trend[data.trend.length - 1] - data.trend[0]) / Math.abs(data.trend[0])) * 100
    : 0;

  const trendHeights = useMemo(() => {
    const values = data.trend.filter((value) => Number.isFinite(value));
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    if (range === 0) return values.map(() => 55);
    return data.trend.map((value) => 18 + ((value - min) / range) * 72);
  }, [data.trend]);

  const deterministicAnalysis = buildDeterministicExecutiveSummary(data);

  useEffect(() => {
    if (!showAnalysis) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [showAnalysis]);

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
          setAiError("");
          setAiAnalysis(null);
          return;
        }
      }

      const statusResponse = await fetch("/api/quickbooks/status", { cache: "no-store" });
      const statusPayload = await statusResponse.json();
      if (!statusResponse.ok || !statusPayload?.connection?.connected) return;

      // Only perform the first QuickBooks pull when there is no saved briefing.
      // Returning to the CFO Briefing must use the last successful sync instead
      // of requesting fresh QuickBooks data every time the page mounts.
      const response = await fetch("/api/quickbooks/sync", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.briefing) {
        throw new Error(payload?.error || "ClearCFO could not load your QuickBooks financial data.");
      }

      setData(payload.briefing as BriefingData);
      setLiveSource("quickbooks");
      setHasValidAnalysis(true);
      setError("");
      setAiError("");
      setAiAnalysis(null);
      window.localStorage.setItem("clearcfo_qb_initial_sync", "complete");
      window.localStorage.setItem("clearcfo_qb_briefing_cache", JSON.stringify(payload.briefing));
      if (payload.syncedAt) window.localStorage.setItem("clearcfo_qb_last_synced_at", payload.syncedAt);
      await generateAIAnalysis(payload.briefing as BriefingData);
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
        setAiError("");
        setAiAnalysis(null);
        void generateAIAnalysis(briefing);
        return;
      }
      void loadQuickBooksBriefing();
    };
    const handleDisconnect = () => {
      window.localStorage.removeItem("clearcfo_qb_briefing_cache");
      window.localStorage.removeItem("clearcfo_qb_last_synced_at");
      window.localStorage.removeItem("clearcfo_qb_initial_sync");
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

  const toggleMetric = (metric: ExpandedMetric) => {
    setExpandedMetric((current) => current === metric ? null : metric);
  };

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setHasValidAnalysis(false);
    setError("");
    setAiError("");
    setAiAnalysis(null);
    setShowAnalysis(false);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { cellDates: true });
      const analyzed = analyzeWorkbook(workbook);
      setData(analyzed);
      setLiveSource("upload");
      setHasValidAnalysis(true);
      await generateAIAnalysis(analyzed);
    } catch (err) {
      setHasValidAnalysis(false);
      setError(err instanceof Error ? err.message : "We couldn't read that workbook. Please check the file format and sheet names.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function generateAIAnalysis(inputData: BriefingData = data) {
    setAiLoading(true);
    setAiError("");
    try {
      const response = await fetch("/api/cfo-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: inputData.companyName,
          financialSnapshot: {
            revenue: inputData.revenue,
            revenueChange: inputData.revenueChange,
            grossMargin: inputData.grossMargin,
            marginChange: inputData.marginChange,
            cash: inputData.cash,
            cashChange: inputData.cashChange,
            inventory: inputData.inventory,
            inventoryChange: inputData.inventoryChange,
          },
          detectedIssues: inputData.alerts,
          financialDrivers: inputData.drivers,
          driverRelationships: inputData.relationships,
          detailDrivers: inputData.detailDrivers,
          currentRecommendation: inputData.recommendation,
          businessHealth: inputData.health,
          analysisConfidence: inputData.confidence,
          recentRevenueTrend: inputData.trend.slice(-12),
          periods: inputData.periods.slice(-12),
          multiPeriodInsights: inputData.trendInsights,
          knownUnknowns: inputData.unknowns,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "ClearCFO could not generate the AI analysis.");
      const normalizePercentageText = (value: string): string => value.replace(/(-?\d+)\.0%\b/g, "$1%");
      const analysis = payload.analysis as AIAnalysis;
      setAiAnalysis({
        ...analysis,
        executiveSummary: normalizePercentageText(analysis.executiveSummary),
        primaryDriver: normalizePercentageText(analysis.primaryDriver),
        whyItMatters: normalizePercentageText(analysis.whyItMatters),
        managementQuestion: normalizePercentageText(analysis.managementQuestion),
        recommendedAction: normalizePercentageText(analysis.recommendedAction),
        evidence: analysis.evidence.map(normalizePercentageText),
        unknowns: analysis.unknowns?.map(normalizePercentageText),
        actions: analysis.actions.map((action) => ({ ...action, title: normalizePercentageText(action.title), rationale: normalizePercentageText(action.rationale) })),
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "ClearCFO could not generate the AI analysis.");
    } finally {
      setAiLoading(false);
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
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">{uploading || aiLoading ? "Analyzing…" : "Upload Excel"}</button>
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

        <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Financial signals</p><p className="mt-1 text-xs text-slate-500">A quick read on what is improving, changing, or needs attention.</p></div>
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Positive</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Monitor</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Attention</span></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[{ key: "revenue" as const, label: "Revenue", value: currency.format(data.revenue), change: percent(data.revenueChange), note: "vs. prior period" }, { key: "margin" as const, label: "Gross Margin", value: `${formatPercentValue(data.grossMargin)}%`, change: percent(data.marginChange), note: "vs. prior period" }, { key: "cash" as const, label: "Cash Position", value: currency.format(data.cash), change: percent(data.cashChange), note: "vs. prior period" }, { key: "attention" as const, label: "Needs Attention", value: String(data.attention), change: data.attention > 0 ? "Review" : "Clear", note: "active financial signals" }].map((metric) => (
                <button key={metric.key} type="button" onClick={() => toggleMetric(metric.key)} className={`rounded-2xl border p-5 text-left transition-all duration-200 ${expandedMetric === metric.key ? "border-blue-300 bg-blue-50/40 shadow-md" : "border-slate-200 bg-slate-50 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-sm"}`}>
                  <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{metric.label}</p><span className="text-xs font-semibold text-slate-400">{expandedMetric === metric.key ? "−" : "+"}</span></div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{metric.value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">{metric.change}</p><p className="mt-1 text-[11px] text-slate-400">{metric.note}</p>
                </button>
              ))}
            </div>

            {expandedMetric && <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">{expandedMetric === "revenue" && <><p className="font-semibold text-slate-900">Revenue trend</p><p className="mt-1">Revenue is {percent(data.revenueChange)} versus the prior period.</p></>}{expandedMetric === "margin" && <><p className="font-semibold text-slate-900">Gross margin</p><p className="mt-1">Gross margin is {formatPercentValue(data.grossMargin)}%, {percent(data.marginChange)} versus the prior period.</p></>}{expandedMetric === "cash" && <><p className="font-semibold text-slate-900">Cash position</p><p className="mt-1">Cash is {currency.format(data.cash)}, {percent(data.cashChange)} versus the prior period.</p></>}{expandedMetric === "attention" && <><p className="font-semibold text-slate-900">Active signals</p><p className="mt-1">{data.attention} financial signal{data.attention === 1 ? "" : "s"} currently need review.</p></>}</div>}

            <div className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Trend</p><div className="mt-5 flex h-56 items-end gap-2">{data.trend.map((value, index) => <div key={`${data.periods[index] || index}`} className="flex flex-1 flex-col items-center justify-end gap-2"><div className="w-full rounded-t-xl bg-blue-500/80" style={{ height: `${trendHeights[index] || 18}%` }} /><span className="text-[10px] text-slate-400">{data.periods[index] || ""}</span></div>)}</div><div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>Start</span><span>{percent(trendChange)} across displayed periods</span><span>Latest</span></div></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Recommendation</p><h3 className="mt-2 text-lg font-bold text-slate-900">{data.recommendation}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{data.impactReason}</p>{data.impact > 0 && <p className="mt-4 text-sm font-semibold text-slate-900">Potential impact: {currency.format(data.impact)}</p>}</div>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">What changed</p><div className="mt-4 space-y-3">{data.alerts.length ? data.alerts.map((alert, index) => <div key={`${alert}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{alert}</div>) : <p className="text-sm text-slate-500">No major exceptions were detected.</p>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Financial drivers</p><div className="mt-4 space-y-3">{data.drivers.length ? data.drivers.map((driver) => <div key={driver.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{driver.title}</p><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{driver.severity}</span></div><p className="mt-1 text-sm leading-6 text-slate-600">{driver.observation}</p></div>) : <p className="text-sm text-slate-500">No major financial drivers were detected.</p>}</div></div></div>

            <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Management questions</p><div className="mt-4 space-y-3">{data.drivers.map((driver) => <div key={`q-${driver.id}`} className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"><span className="font-semibold text-slate-900">{driver.category}:</span> {driver.managementQuestion}</div>)}</div></div>

            <div className="mt-10 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">AI Analysis</p><h3 className="mt-2 text-xl font-bold text-slate-900">Turn the signals into a decision.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{deterministicAnalysis}</p></div><button type="button" onClick={() => setShowAnalysis(true)} className="self-start rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700">View AI Analysis</button></div>
        </>
      </div>
      </div>
      {showAnalysis && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onClick={() => setShowAnalysis(false)}><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">AI Analysis</p><h3 className="mt-2 text-2xl font-bold text-slate-900">What should management do next?</h3></div><button type="button" onClick={() => setShowAnalysis(false)} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button></div>{aiLoading && <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Analyzing financial signals…</div>}{aiError && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{aiError}</div>}{aiAnalysis && <div className="mt-6 space-y-5"><div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Executive summary</p><p className="mt-2 text-sm leading-6 text-slate-700">{aiAnalysis.executiveSummary}</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Primary driver</p><p className="mt-2 text-sm leading-6 text-slate-700">{aiAnalysis.primaryDriver}</p></div><div className="rounded-2xl border border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Why it matters</p><p className="mt-2 text-sm leading-6 text-slate-700">{aiAnalysis.whyItMatters}</p></div></div><div className="rounded-2xl border border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Management question</p><p className="mt-2 text-sm leading-6 text-slate-700">{aiAnalysis.managementQuestion}</p></div><div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5"><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Recommended action</p><p className="mt-2 text-sm leading-6 text-slate-700">{aiAnalysis.recommendedAction}</p></div>{aiAnalysis.actions?.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Priority actions</p><div className="mt-3 space-y-3">{aiAnalysis.actions.map((action, index) => <div key={`${action.title}-${index}`} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{action.title}</p><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{action.priority}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{action.rationale}</p></div>)}</div></div>}</div>}</div></div>}
    </div>
  );
}
