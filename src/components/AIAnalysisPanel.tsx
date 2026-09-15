"use client";

import { useEffect, useState } from "react";
import type { AIAnalysis, BriefingData } from "../lib/briefing/engine";

const CACHE_KEY = "clearcfo_qb_briefing_cache";
const AI_CACHE_KEY = "clearcfo_qb_ai_analysis_cache";

type Props = { enabled?: boolean };

function normalizePercentageText(value: string): string {
  return value.replace(/(-?\d+)\.0%\b/g, "$1%");
}

function normalizeAnalysis(analysis: AIAnalysis): AIAnalysis {
  return {
    ...analysis,
    executiveSummary: normalizePercentageText(analysis.executiveSummary),
    primaryDriver: normalizePercentageText(analysis.primaryDriver),
    whyItMatters: normalizePercentageText(analysis.whyItMatters),
    managementQuestion: normalizePercentageText(analysis.managementQuestion),
    recommendedAction: normalizePercentageText(analysis.recommendedAction),
    evidence: analysis.evidence.map(normalizePercentageText),
    unknowns: analysis.unknowns?.map(normalizePercentageText),
    actions: analysis.actions.map((action) => ({ ...action, title: normalizePercentageText(action.title), rationale: normalizePercentageText(action.rationale) })),
  };
}

export default function AIAnalysisPanel({ enabled = true }: Props) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const loadCache = () => {
      try {
        const cachedBriefing = window.localStorage.getItem(CACHE_KEY);
        if (cachedBriefing) {
          const parsed = JSON.parse(cachedBriefing) as BriefingData;
          if (parsed?.companyName && Array.isArray(parsed.alerts)) setBriefing(parsed);
        }
        const cachedAnalysis = window.localStorage.getItem(AI_CACHE_KEY);
        if (cachedAnalysis) setAnalysis(normalizeAnalysis(JSON.parse(cachedAnalysis) as AIAnalysis));
      } catch {
        // Ignore malformed local cache and allow a fresh analysis.
      }
    };
    loadCache();
    const handleSync = (event: Event) => {
      const payload = (event as CustomEvent)?.detail;
      const nextBriefing = payload?.briefing as BriefingData | undefined;
      if (nextBriefing?.companyName) {
        setBriefing(nextBriefing);
        setAnalysis(null);
        setError("");
        setExpanded(false);
        window.localStorage.removeItem(AI_CACHE_KEY);
      } else {
        loadCache();
      }
    };
    window.addEventListener("clearcfo:quickbooks-sync", handleSync);
    return () => window.removeEventListener("clearcfo:quickbooks-sync", handleSync);
  }, [enabled]);

  async function generateAnalysis() {
    if (!briefing || loading) return;
    setLoading(true);
    setError("");
    setExpanded(true);
    try {
      const response = await fetch("/api/cfo-analysis-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: briefing.companyName,
          financialSnapshot: {
            revenue: briefing.revenue,
            revenueChange: briefing.revenueChange,
            grossMargin: briefing.grossMargin,
            marginChange: briefing.marginChange,
            cash: briefing.cash,
            cashChange: briefing.cashChange,
            inventory: briefing.inventory,
            inventoryChange: briefing.inventoryChange,
          },
          detectedIssues: briefing.alerts,
          financialDrivers: briefing.drivers,
          driverRelationships: briefing.relationships,
          detailDrivers: briefing.detailDrivers,
          currentRecommendation: briefing.recommendation,
          businessHealth: briefing.health,
          analysisConfidence: briefing.confidence,
          recentRevenueTrend: briefing.trend.slice(-12),
          periods: briefing.periods.slice(-12),
          multiPeriodInsights: briefing.trendInsights,
          knownUnknowns: briefing.unknowns,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "ClearCFO could not generate the AI analysis.");
      if (!payload?.analysis) throw new Error("ClearCFO received an empty AI analysis.");
      const nextAnalysis = normalizeAnalysis(payload.analysis as AIAnalysis);
      setAnalysis(nextAnalysis);
      window.localStorage.setItem(AI_CACHE_KEY, JSON.stringify(nextAnalysis));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ClearCFO could not generate the AI analysis.");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled || !briefing) return null;

  return (
    <section className="mx-auto mt-8 w-full max-w-6xl px-5 pb-8 sm:px-8 sm:pb-12 lg:pb-16" aria-labelledby="ai-analysis-heading">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_80px_-35px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">AI Analysis</p>
            <h2 id="ai-analysis-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-900">What should management do next?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">ClearCFO uses the financial signals above to turn the data into a prioritized management view.</p>
          </div>
          {!analysis ? (
            <button type="button" onClick={() => void generateAnalysis()} disabled={loading} className="self-start rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Analyzing…" : "View AI Analysis"}</button>
          ) : (
            <button type="button" onClick={() => setExpanded((current) => !current)} className="self-start rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-blue-300 hover:bg-slate-50">{expanded ? "Hide AI Analysis" : "View AI Analysis"}</button>
          )}
        </div>

        {loading && <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Analyzing financial signals…</div>}
        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700"><p>{error}</p><button type="button" onClick={() => void generateAnalysis()} disabled={loading} className="mt-3 font-semibold text-red-800 underline underline-offset-2 disabled:opacity-50">Try again</button></div>}

        {analysis && expanded && (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Executive summary</p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.executiveSummary}</p></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Primary driver</p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.primaryDriver}</p></div><div className="rounded-2xl border border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Why it matters</p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.whyItMatters}</p></div></div>
            <div className="rounded-2xl border border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Management question</p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.managementQuestion}</p></div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5"><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Recommended action</p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.recommendedAction}</p></div>
            {analysis.evidence?.length > 0 && <div className="rounded-2xl border border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Evidence</p><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">{analysis.evidence.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul></div>}
            {analysis.actions?.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Priority actions</p><div className="mt-3 space-y-3">{analysis.actions.map((action, index) => <div key={`${action.title}-${index}`} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{action.title}</p><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{action.priority}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{action.rationale}</p></div>)}</div></div>}
            {(analysis.unknowns ?? []).length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Known unknowns</p><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{(analysis.unknowns ?? []).map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul></div>}
          </div>
        )}
      </div>
    </section>
  );
}
