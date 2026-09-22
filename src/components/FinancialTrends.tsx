"use client";

import { useEffect, useMemo, useState } from "react";
import { getActiveCompanyId, isQuickBooksCacheUsable } from "../lib/company-scoped-cache";

type TrendSeries = { name: string; values: number[]; periods: string[] };
type TrendCardProps = { title: string; series: TrendSeries | undefined; tone: "positive" | "watch"; chartColor: string };
type MetricKey = "revenue" | "margin" | "cash" | "inventory";

const metricNames: Record<MetricKey, string> = { revenue: "Revenue", margin: "Gross Margin", cash: "Cash Position", inventory: "Inventory" };

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatValue(title: string, value: number) { return title === "Gross Margin" ? `${value.toFixed(1)}%` : money(value); }

function changePercent(values: number[]) {
  if (values.length < 2) return Number.NaN;
  const previous = values[values.length - 2];
  const latest = values[values.length - 1];
  if (!Number.isFinite(previous) || !Number.isFinite(latest) || previous === 0) return Number.NaN;
  return ((latest - previous) / Math.abs(previous)) * 100;
}

function TrendCard({ title, series, tone, chartColor }: TrendCardProps) {
  const values = series?.values?.slice(-6) || [];
  const labels = series?.periods?.slice(-6) || [];
  const points = useMemo(() => {
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((value, index) => ({ x: values.length === 1 ? 50 : 4 + (index / (values.length - 1)) * 92, y: 88 - ((value - min) / range) * 68, value }));
  }, [values]);
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const change = changePercent(values);
  const labelIndices = Array.from(new Set([0, Math.round(Math.max(0, labels.length - 1) / 2), Math.max(0, labels.length - 1)]));
  const latest = values[values.length - 1] ?? 0;
  const previous = values.length > 1 ? values[values.length - 2] : 0;
  const hasPercentComparison = values.length > 1 && Number.isFinite(previous) && Number.isFinite(latest) && previous !== 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className={`mt-1 text-sm font-semibold ${hasPercentComparison ? (change >= 0 ? "text-emerald-600" : "text-amber-600") : "text-slate-500"}`}>{hasPercentComparison ? `${change > 0 ? "+" : ""}${change.toFixed(1)}%` : "—"}</p>
          <p className="mt-1 text-[11px] text-slate-400">{hasPercentComparison ? (change >= 0 ? (tone === "positive" ? "Growing" : "Building") : "Declining") : "Prior period was $0"}</p>
        </div>
        <span className="text-[10px] font-semibold text-slate-400">{values.length}-period</span>
      </div>
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 pt-3">
        <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Trend by period</div>
        {points.length ? (
          <div className="relative h-36">
            <div className="absolute inset-x-0 top-3 border-t border-slate-200" /><div className="absolute inset-x-0 top-1/2 border-t border-slate-200" /><div className="absolute inset-x-0 bottom-5 border-t border-slate-200" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`absolute inset-x-1 top-1 h-28 w-[calc(100%-0.5rem)] overflow-visible ${chartColor}`} aria-label={`${title} trend`}>
              <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
              {points.map((point, index) => <circle key={`${index}-${point.value}`} cx={point.x} cy={point.y} r="1.6" fill="currentColor" vectorEffect="non-scaling-stroke" />)}
            </svg>
            <div className="absolute inset-x-0 bottom-0 flex justify-between text-[9px] text-slate-400">{labelIndices.map((index) => <span key={index}>{labels[index] || ""}</span>)}</div>
          </div>
        ) : <div className="flex h-36 items-center justify-center text-xs text-slate-400">No QuickBooks history returned.</div>}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500"><span>Latest {formatValue(title, latest)}</span><span>{values.length > 1 ? `Prior ${formatValue(title, previous)}` : "Current period"}</span></div>
    </article>
  );
}

export default function FinancialTrends() {
  const [series, setSeries] = useState<TrendSeries[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("revenue");
  // The briefing signals this when its initial state determination finishes.
  // Trends must not load or render before that, or graphs appear ahead of
  // the rest of the page.
  const [briefingReady, setBriefingReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const applyPayload = (briefing: any) => {
      if (cancelled) return;
      const next = Array.isArray(briefing?.trendSeries) ? briefing.trendSeries.filter((item: any) => item?.name && Array.isArray(item?.values)) : [];
      setSeries(next);
      setConnected(Boolean(briefing?.companyName));
    };
    const load = async () => {
      try {
        // The cached briefing belongs to exactly one business; never render
        // another business's trends here.
        const activeCompanyId = await getActiveCompanyId();

        // Connection state is authoritative. Never render cached trend data
        // after QuickBooks has been disconnected.
        const status = await fetch("/api/quickbooks/status", { cache: "no-store" });
        const statusPayload = await status.json();
        if (!status.ok || !statusPayload?.connection?.connected) {
          setSeries([]);
          setConnected(false);
          return;
        }

        const cached = window.localStorage.getItem("clearcfo_qb_briefing_cache");
        if (cached && isQuickBooksCacheUsable(activeCompanyId)) { applyPayload(JSON.parse(cached)); return; }

        const response = await fetch("/api/quickbooks/sync", { cache: "no-store" });
        const payload = await response.json();
        if (response.ok && payload?.briefing) applyPayload(payload.briefing);
      } catch { /* The CFO Briefing remains usable if trend history is unavailable. */ }
    };
    // Sequence after the CFO Briefing: wait for its initial state
    // determination before the first trend load, so graphs never render
    // ahead of the rest of the page.
    let readyListener: (() => void) | null = null;
    const markReadyAndLoad = () => {
      if (cancelled) return;
      setBriefingReady(true);
      void load();
    };
    if ((window as unknown as { __clearcfoBriefingReady?: boolean }).__clearcfoBriefingReady === true) {
      markReadyAndLoad();
    } else {
      readyListener = markReadyAndLoad;
      window.addEventListener("clearcfo:briefing-ready", readyListener);
    }
    const handleSync = (event: Event) => { const payload = (event as CustomEvent)?.detail; if (payload?.briefing) applyPayload(payload.briefing); };
    // Mirror the briefing: never keep rendered trend data after QuickBooks
    // has been disconnected.
    const handleDisconnect = () => {
      if (cancelled) return;
      setSeries([]);
      setConnected(false);
    };
    const handleMetricChange = (event: Event) => {
      const key = (event as CustomEvent<MetricKey>)?.detail;
      if (key && key in metricNames) setSelectedMetric(key);
    };
    const detectSelectedMetric = () => {
      const selected = document.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
      if (!selected) return;
      const text = selected.textContent || "";
      const match = (Object.entries(metricNames) as [MetricKey, string][]).find(([, name]) => text.includes(name));
      if (match) setSelectedMetric(match[0]);
    };
    const observer = new MutationObserver(detectSelectedMetric);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
    detectSelectedMetric();
    window.addEventListener("clearcfo:quickbooks-sync", handleSync);
    window.addEventListener("clearcfo:quickbooks-disconnected", handleDisconnect);
    window.addEventListener("clearcfo:metric-change", handleMetricChange);
    return () => {
      cancelled = true;
      if (readyListener) window.removeEventListener("clearcfo:briefing-ready", readyListener);
      observer.disconnect();
      window.removeEventListener("clearcfo:quickbooks-sync", handleSync);
      window.removeEventListener("clearcfo:quickbooks-disconnected", handleDisconnect);
      window.removeEventListener("clearcfo:metric-change", handleMetricChange);
    };
  }, []);

  if (!briefingReady) return null;
  if (!connected && !series.length) return null;
  const byName = new Map(series.map((item) => [item.name, item]));
  const allCards = [
    { key: "revenue" as const, title: "Revenue", tone: "positive" as const, chartColor: "text-blue-600" },
    { key: "margin" as const, title: "Gross Margin", tone: "watch" as const, chartColor: "text-indigo-600" },
    { key: "cash" as const, title: "Cash Position", tone: "positive" as const, chartColor: "text-emerald-600" },
    { key: "inventory" as const, title: "Inventory", tone: "watch" as const, chartColor: "text-violet-600" },
  ];
  const cards = allCards.filter((card) => card.key !== selectedMetric);

  return (
    <section className="mx-auto mb-20 mt-6 w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Financial trends</p><h2 className="mt-1 text-xl font-bold text-slate-900">Supporting trend detail</h2><p className="mt-1 text-sm text-slate-500">Supporting views update to show the other financial trends when you select a KPI above.</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Across periods</span>
        </div>
      </div>
      <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">{cards.map((card) => <div key={card.key} className="bg-white p-3 sm:p-4"><TrendCard title={card.title} series={byName.get(card.title)} tone={card.tone} chartColor={card.chartColor} /></div>)}</div>
      <div className="mx-5 my-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-slate-600 sm:mx-8"><strong className="text-blue-700">The bigger picture:</strong> These charts use the QuickBooks periods actually returned by the connected company. ClearCFO will not fill missing periods with made-up financial values.</div>
    </section>
  );
}
