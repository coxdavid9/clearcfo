"use client";

import { useEffect, useState } from "react";
import { type AIAnalysis, type BriefingData, demoData } from "../lib/briefing/engine";

const ANALYSIS_CACHE_KEY = "clearcfo_ai_analysis_cache_v2";

function normalizePercentageText(value: string) {
  return value.replace(/(-?\d+(?:\.\d+)?)%%/g, "$1%").replace(/(-?\d+)\.0%\b/g, "$1%");
}

function normalizeAnalysis(analysis: AIAnalysis): AIAnalysis {
  const text = (value: string) => normalizePercentageText(value);
  return { ...analysis, executiveSummary: text(analysis.executiveSummary), primaryDriver: text(analysis.primaryDriver), whyItMatters: text(analysis.whyItMatters), managementQuestion: text(analysis.managementQuestion), recommendedAction: text(analysis.recommendedAction), evidence: analysis.evidence.map(text), unknowns: analysis.unknowns?.map(text), actions: analysis.actions.map((action) => ({ ...action, title: text(action.title), rationale: text(action.rationale) })) };
}

function splitRecommendedActions(value: string) {
  const normalized = normalizePercentageText(value).replace(/\r/g, "").trim();
  const matches = [...normalized.matchAll(/(?:^|\n|\s)(\d+)[.)]\s*/g)];
  if (matches.length < 2) return [normalized];
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
    const text = normalized.slice(start, end).trim();
    return text ? `${match[1]}. ${text}` : "";
  }).filter(Boolean);
}

function priorityBadge(priority: string) {
  const normalized = priority.toLowerCase();
  if (normalized === "high") return "border-red-200 bg-red-50 text-red-700";
  if (normalized === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function analysisFingerprint(input: BriefingData) {
  return JSON.stringify({
    companyName: input.companyName,
    revenue: input.revenue,
    revenueChange: input.revenueChange,
    grossMargin: input.grossMargin,
    marginChange: input.marginChange,
    cash: input.cash,
    cashChange: input.cashChange,
    inventory: input.inventory,
    inventoryChange: input.inventoryChange,
    trend: input.trend.slice(-12),
    periods: input.periods.slice(-12),
  });
}

export default function CFOAnalysisPage() {
  const [data, setData] = useState<BriefingData>(demoData);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        let briefing: BriefingData | null = null;
        const stored = window.localStorage.getItem("clearcfo_analysis_input") || window.localStorage.getItem("clearcfo_qb_briefing_cache");
        if (stored) {
          const parsed = JSON.parse(stored) as BriefingData;
          if (parsed?.companyName && Array.isArray(parsed.alerts)) briefing = parsed;
        }
        if (!briefing) {
          const statusResponse = await fetch("/api/quickbooks/status", { cache: "no-store" });
          const statusPayload = await statusResponse.json();
          if (statusResponse.ok && statusPayload?.connection?.connected) {
            const response = await fetch("/api/quickbooks/sync", { cache: "no-store" });
            const payload = await response.json();
            if (response.ok && payload?.briefing) briefing = payload.briefing as BriefingData;
          }
        }
        const input = briefing || demoData;
        const fingerprint = analysisFingerprint(input);
        if (!cancelled) setData(input);

        const cachedRaw = window.localStorage.getItem(ANALYSIS_CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as { fingerprint?: string; analysis?: AIAnalysis };
            if (cached.fingerprint === fingerprint && cached.analysis) {
              if (!cancelled) { setAnalysis(normalizeAnalysis(cached.analysis)); setLoading(false); }
              return;
            }
          } catch { window.localStorage.removeItem(ANALYSIS_CACHE_KEY); }
        }

        const response = await fetch("/api/cfo-analysis", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: input.companyName, financialSnapshot: { revenue: input.revenue, revenueChange: input.revenueChange, grossMargin: input.grossMargin, marginChange: input.marginChange, cash: input.cash, cashChange: input.cashChange, inventory: input.inventory, inventoryChange: input.inventoryChange }, detectedIssues: input.alerts, financialDrivers: input.drivers, driverRelationships: input.relationships, detailDrivers: input.detailDrivers, currentRecommendation: input.recommendation, businessHealth: input.health, analysisConfidence: input.confidence, recentRevenueTrend: input.trend.slice(-12), periods: input.periods.slice(-12), multiPeriodInsights: input.trendInsights, knownUnknowns: input.unknowns }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "ClearCFO could not generate the AI analysis.");
        const normalized = normalizeAnalysis(payload.analysis as AIAnalysis);
        window.localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify({ fingerprint, analysis: normalized }));
        if (!cancelled) setAnalysis(normalized);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "ClearCFO could not generate the AI analysis.");
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const recommendedActions = analysis ? splitRecommendedActions(analysis.recommendedAction) : [];
  const actions = analysis?.actions ?? [];
  const displayRecommendedActions = recommendedActions.length >= 2
    ? recommendedActions
    : (actions.length >= 3
      ? actions.slice(0, 3).map((action) => `${action.title}: ${action.rationale}`)
      : recommendedActions);

  return (
    <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16"><div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-center justify-between gap-4"><a href="/customer/briefing" className="text-sm font-semibold text-blue-600 hover:text-blue-700">← Back to CFO Briefing</a><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">AI Analysis</span></div>
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_25px_80px_-35px_rgba(15,23,42,0.35)] sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">AI Analysis</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">What should management do next?</h1><p className="mt-2 text-sm text-slate-500">{data.companyName} · Analysis based on the financial signals currently loaded in ClearCFO.</p>
        {loading && <div className="mt-8 rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">Loading analysis…</div>}{error && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">{error}</div>}
        {analysis && <div className="mt-8 space-y-5">
          <div className="rounded-2xl bg-slate-50 p-6"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Executive summary</p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.executiveSummary}</p></div>
          <div className="grid gap-5 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-6"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Primary driver</p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.primaryDriver}</p></div><div className="rounded-2xl border border-slate-200 p-6"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Why it matters</p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.whyItMatters}</p></div></div>
          <div className="rounded-2xl border border-slate-200 p-6"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Management question</p><p className="mt-2 text-sm leading-6 text-slate-700">{analysis.managementQuestion}</p></div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6"><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Recommended action</p><div className="mt-3 space-y-3">{displayRecommendedActions.map((action, index) => <div key={`${action}-${index}`} className="flex gap-3 text-sm leading-6 text-slate-700"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{index + 1}</span><p>{action.replace(/^\d+[.)]\s*/, "")}</p></div>)}</div></div>
          {actions.length > 0 && <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Priority actions</p><div className="mt-3 space-y-3">{actions.map((action, index) => <div key={`${action.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{action.title}</p><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${priorityBadge(action.priority)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{action.priority}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{action.rationale}</p></div>)}</div></div>}
        </div>}
      </section>
    </div></div>
  );
}
