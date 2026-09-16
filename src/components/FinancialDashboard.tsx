"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefingData, currency, demoData, formatPercentValue } from "../lib/briefing/engine";

type TrendSeries = { name: string; values: number[]; periods: string[] };
type MetricKey = "Revenue" | "Gross Margin" | "Cash Position" | "Inventory";

const demoTrendSeries: TrendSeries[] = [
  { name: "Revenue", values: demoData.trend, periods: demoData.periods },
  { name: "Gross Margin", values: [34.2, 33.8, 33.4, 33.1, 32.9, 32.7, 32.5, 32.2, 32.0, 31.9, 31.8, 31.8], periods: demoData.periods },
  { name: "Cash Position", values: [505000, 498000, 492000, 486000, 475000, 468000, 459000, 451000, 443000, 431000, 422000, 412000], periods: demoData.periods },
  { name: "Inventory", values: [500000, 508000, 515000, 523000, 531000, 542000, 550000, 558000, 567000, 575000, 581000, 587000], periods: demoData.periods },
];

function TrendChart({ series, formatValue }: { series: TrendSeries; formatValue: (value: number) => string }) {
  const values = series.values.slice(-12);
  const labels = series.periods.slice(-12);
  const points = useMemo(() => {
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((value, index) => ({
      x: values.length === 1 ? 50 : (index / (values.length - 1)) * 100,
      y: 88 - ((value - min) / range) * 72,
      value,
    }));
  }, [values]);
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const labelIndices = Array.from(new Set([0, Math.round(Math.max(0, labels.length - 1) / 3), Math.round(Math.max(0, labels.length - 1) * 2 / 3), Math.max(0, labels.length - 1)]));

  return (
    <div className="mt-6 rounded-2xl bg-slate-50 px-3 py-5 sm:px-5">
      <div className="relative h-64">
        <div className="absolute inset-x-0 top-2 border-t border-slate-200" />
        <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
        <div className="absolute inset-x-0 bottom-6 border-t border-slate-200" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-x-3 top-4 h-48 w-[calc(100%-1.5rem)] overflow-visible text-blue-600" aria-label={`${series.name} trend chart`}>
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => <circle key={`${index}-${point.value}`} cx={point.x} cy={point.y} r="1.5" fill="currentColor" vectorEffect="non-scaling-stroke" />)}
        </svg>
        <div className="absolute inset-x-3 bottom-0 flex justify-between text-[10px] font-medium text-slate-400">
          {labelIndices.map((index) => <span key={index}>{labels[index] ?? ""}</span>)}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>12 monthly periods · every dot is an actual period value</span>
        <span className="font-semibold text-slate-700">Latest: {formatValue(values[values.length - 1] ?? 0)}</span>
      </div>
    </div>
  );
}

export default function FinancialDashboard() {
  const [data, setData] = useState<BriefingData>(demoData);
  const [source, setSource] = useState<"demo" | "quickbooks">("demo");
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("Revenue");

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem("clearcfo_qb_briefing_cache");
      if (!cached) return;
      const parsed = JSON.parse(cached) as BriefingData;
      if (parsed?.companyName && Array.isArray(parsed.trend)) {
        setData(parsed);
        setSource("quickbooks");
      }
    } catch {
      // Keep safe demo data if the cache is unavailable.
    }
  }, []);

  const series = source === "quickbooks" && Array.isArray(data.trendSeries) && data.trendSeries.length >= 4 ? data.trendSeries : demoTrendSeries;
  const selectedSeries = series.find((item) => item.name === selectedMetric) || series[0];
  const seriesByName = new Map(series.map((item) => [item.name, item]));

  const metricCards = [
    { key: "Revenue" as const, value: currency.format(data.revenue), change: data.revenueChange, good: data.revenueChange >= 0 },
    { key: "Gross Margin" as const, value: formatPercentValue(data.grossMargin), change: data.marginChange, good: data.marginChange >= 0 },
    { key: "Cash Position" as const, value: currency.format(data.cash), change: data.cashChange, good: data.cashChange >= 0 },
    { key: "Inventory" as const, value: currency.format(data.inventory), change: data.inventoryChange, good: data.inventoryChange <= 0 },
  ];

  const formatSelectedValue = (value: number) => selectedMetric === "Gross Margin" ? formatPercentValue(value) : currency.format(value);

  return (
    <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ClearCFO Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Financial performance at a glance.</h1>
            <p className="mt-2 text-sm text-slate-500">{data.companyName} · {source === "quickbooks" ? "Connected QuickBooks data" : "Demo financial data"}</p>
          </div>
          <a href="/customer/briefing" className="inline-flex w-fit items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700">Open CFO Briefing →</a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => {
            const active = selectedMetric === metric.key;
            const actualSeries = seriesByName.get(metric.key);
            return (
              <button key={metric.key} type="button" onClick={() => setSelectedMetric(metric.key)} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${active ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-500">{metric.key}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">View trend</span>
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{metric.value}</p>
                <p className={`mt-2 text-xs font-semibold ${metric.good ? "text-emerald-600" : "text-red-600"}`}>
                  {metric.change > 0 ? "+" : ""}{formatPercentValue(metric.change)} vs prior period
                </p>
                {actualSeries && <div className="mt-4 h-10 text-blue-600"><MiniSparkline values={actualSeries.values.slice(-12)} /></div>}
              </button>
            );
          })}
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">12-month performance</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{selectedSeries?.name} trend</h2>
              <p className="mt-1 text-sm text-slate-500">Select a KPI above to inspect its monthly history.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{selectedSeries?.values.length || 0} periods</span>
          </div>
          {selectedSeries && <TrendChart series={selectedSeries} formatValue={formatSelectedValue} />}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">KPI movement</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">What changed?</h2>
            <div className="mt-7 space-y-5">
              {metricCards.map((metric) => {
                const magnitude = Math.min(100, Math.abs(metric.change) * 4);
                return <div key={metric.key}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-slate-700">{metric.key}</span><span className={metric.good ? "font-bold text-emerald-600" : "font-bold text-red-600"}>{metric.change > 0 ? "+" : ""}{formatPercentValue(metric.change)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${metric.good ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.max(4, magnitude)}%` }} /></div></div>;
              })}
            </div>
          </section>
          <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">CFO takeaway</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{data.recommendation}</p>
            <a href="/customer/briefing" className="mt-6 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">Open full CFO Briefing →</a>
          </section>
        </div>
      </div>
    </div>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 2 : (index / (values.length - 1)) * 96 + 2;
    const y = 38 - ((value - min) / range) * 30;
    return `${x},${y}`;
  }).join(" ");
  return <svg viewBox="0 0 100 40" className="h-full w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />{values.map((value, index) => { const x = values.length === 1 ? 2 : (index / (values.length - 1)) * 96 + 2; const y = 38 - ((value - min) / range) * 30; return <circle key={`${index}-${value}`} cx={x} cy={y} r="1.3" fill="currentColor" vectorEffect="non-scaling-stroke" />; })}</svg>;
}
