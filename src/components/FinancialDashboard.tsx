"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefingData, currency, demoData, formatPercentValue } from "../lib/briefing/engine";

function Sparkline({ values }: { values: number[] }) {
  const points = useMemo(() => {
    if (!values.length) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 92 - ((value - min) / range) * 76;
      return `${x},${y}`;
    }).join(" ");
  }, [values]);

  return (
    <svg viewBox="0 0 100 100" className="h-20 w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      {values.map((value, index) => {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
        const y = 92 - ((value - min) / range) * 76;
        return <circle key={`${index}-${value}`} cx={x} cy={y} r="1.6" fill="currentColor" vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}

export default function FinancialDashboard() {
  const [data, setData] = useState<BriefingData>(demoData);
  const [source, setSource] = useState<"demo" | "quickbooks">("demo");

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
      // Keep the dashboard on safe demo data if the cache is unavailable.
    }
  }, []);

  const metrics = [
    { label: "Revenue", value: currency.format(data.revenue), change: data.revenueChange, positive: data.revenueChange >= 0 },
    { label: "Gross Margin", value: formatPercentValue(data.grossMargin), change: data.marginChange, positive: data.marginChange >= 0 },
    { label: "Cash Position", value: currency.format(data.cash), change: data.cashChange, positive: data.cashChange >= 0 },
    { label: "Inventory", value: currency.format(data.inventory), change: data.inventoryChange, positive: data.inventoryChange <= 0 },
  ];

  const chartValues = data.trend.slice(-12);
  const chartLabels = data.periods.slice(-12);
  const labelIndices = Array.from(new Set([0, Math.round(Math.max(0, chartLabels.length - 1) / 3), Math.round(Math.max(0, chartLabels.length - 1) * 2 / 3), Math.max(0, chartLabels.length - 1)]));

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
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{metric.value}</p>
              <p className={`mt-2 text-xs font-semibold ${metric.positive ? "text-emerald-600" : "text-red-600"}`}>
                {metric.change > 0 ? "+" : ""}{formatPercentValue(metric.change)} vs prior period
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Performance trend</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Revenue over the last 12 periods</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">12 periods</span>
            </div>
            <div className="mt-7 rounded-2xl bg-slate-50 px-3 py-4">
              <div className="relative h-56">
                <div className="absolute inset-x-0 top-0 border-t border-slate-200" />
                <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
                <div className="absolute inset-x-0 bottom-0 border-t border-slate-200" />
                <div className="absolute inset-x-2 top-4 h-40 text-blue-600">
                  <Sparkline values={chartValues} />
                </div>
                <div className="absolute inset-x-2 bottom-1 flex justify-between text-[10px] font-medium text-slate-400">
                  {labelIndices.map((index) => <span key={index}>{chartLabels[index] ?? ""}</span>)}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>Each dot represents one period.</span>
              <span className={data.revenueChange >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>{data.revenueChange >= 0 ? "Growing" : "Declining"} vs prior period</span>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">KPI movement</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">What changed?</h2>
            <div className="mt-7 space-y-6">
              {metrics.map((metric) => {
                const magnitude = Math.min(100, Math.abs(metric.change) * 4);
                return (
                  <div key={metric.label}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-700">{metric.label}</span>
                      <span className={metric.positive ? "font-bold text-emerald-600" : "font-bold text-red-600"}>{metric.change > 0 ? "+" : ""}{formatPercentValue(metric.change)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${metric.positive ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.max(4, magnitude)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">CFO takeaway</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{data.recommendation}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
