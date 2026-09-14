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

  const [data, setData] =
    useState<BriefingData>(
      demoData
    );

  const [hasValidAnalysis, setHasValidAnalysis] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showAnalysis, setShowAnalysis] =
    useState(false);

  const [aiAnalysis, setAiAnalysis] =
    useState<AIAnalysis | null>(null);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [aiError, setAiError] =
    useState("");

  const [expandedMetric, setExpandedMetric] =
    useState<ExpandedMetric>(null);

  const showFinancialDetail = true;

  const trendChange =
    data.trend.length >= 2 && data.trend[0] !== 0
      ? ((data.trend[data.trend.length - 1] - data.trend[0]) /
          Math.abs(data.trend[0])) *
        100
      : 0;

  // The uploaded trend contains real dollar values, not CSS percentages.
  // Normalize them only for the visual bar heights so the chart reflects the
  // actual period-to-period movement without forcing huge values into CSS.
  const trendHeights = useMemo(() => {
    const values = data.trend.filter((value) => Number.isFinite(value));
    if (!values.length) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) return values.map(() => 55);

    return data.trend.map((value) =>
      18 + ((value - min) / range) * 72
    );
  }, [data.trend]);

  const deterministicAnalysis =
    buildDeterministicExecutiveSummary(data);

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


  const toggleMetric = (metric: ExpandedMetric) => {
    setExpandedMetric((current) =>
      current === metric ? null : metric
    );
  };

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setHasValidAnalysis(false);
    setError("");
    setAiError("");
    setAiAnalysis(null);
    setShowAnalysis(false);

    try {
      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(buffer, {
          cellDates: true,
        });

      const analyzed =
        analyzeWorkbook(
          workbook
        );

      setData(analyzed);
      setHasValidAnalysis(true);
      await generateAIAnalysis(analyzed);
    } catch (err) {
      setHasValidAnalysis(false);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't read that workbook. Please check the file format and sheet names."
      );
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
        headers: {
          "Content-Type": "application/json",
        },
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

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "ClearCFO could not generate the AI analysis."
        );
      }

      const normalizePercentageText = (value: string): string =>
        value.replace(/(-?\d+)\.0%\b/g, "$1%");

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
        actions: analysis.actions.map((action) => ({
          ...action,
          title: normalizePercentageText(action.title),
          rationale: normalizePercentageText(action.rationale),
        })),
      });
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : "ClearCFO could not generate the AI analysis."
      );
    } finally {
      setAiLoading(false);
    }
  }

  const emptyState = (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-600">
        ✦
      </div>

      <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
        ClearCFO Intelligence
      </p>

      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        Your CFO Briefing starts with your data.
      </h2>

      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
        Upload a financial workbook to generate KPIs,
        trends, exceptions, and prioritized
        recommendations.
      </p>

      <button
        type="button"
        onClick={() =>
          fileRef.current?.click()
        }
        className="mt-7 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"
      >
        {uploading
          ? "Analyzing…"
          : "Upload Financial Data"}
      </button>

      <p className="mt-3 text-xs text-slate-400">
        Your real customer dashboard will start here —
        no fake numbers.
      </p>
    </div>
  );

  if (!hasValidAnalysis) {
    return (
      <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
        {error && (
          <div className="mx-auto mb-4 w-full max-w-6xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</div>
        )}
        <div className="mx-auto w-full max-w-6xl">{emptyState}</div>
      </div>
    );
  }

  return (
    <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_25px_80px_-35px_rgba(15,23,42,0.35)]">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleUpload}
      />

      <div className="border-b border-slate-200 bg-white px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs text-white">✦</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ClearCFO Intelligence</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Financial briefing</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{data.source === "upload" ? `Last analyzed: ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Demo financial data"}</p>
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
          <p className="mt-1 text-sm text-slate-500">{data.source === "upload" ? data.companyName : "Your financial data"}</p>
        </div>
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <>
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
              {[
                {
                  key: "revenue" as const,
                  label: "Revenue",
                  value: currency.format(data.revenue),
                  change: percent(data.revenueChange),
                  tone: data.revenueChange > 0 ? "text-emerald-600" : data.revenueChange < 0 ? "text-red-600" : "text-amber-600",
                  signal: data.revenueChange > 0 ? "bg-emerald-500" : data.revenueChange < 0 ? "bg-red-500" : "bg-amber-400",
                  detail: "Current revenue and the change from the prior reporting period. Use the expanded view to compare the prior-period level, recent trend, and whether growth is keeping pace with the rest of the business.",
                },
                {
                  key: "margin" as const,
                  label: "Gross Margin",
                  value: `${formatPercentValue(data.grossMargin)}%`,
                  change: `${data.marginChange >= 0 ? "+" : ""}${data.marginChange.toFixed(1)} pts`,
                  tone: data.marginChange > 0 ? "text-emerald-600" : data.marginChange < 0 ? "text-red-600" : "text-amber-600",
                  signal: data.marginChange > 0 ? "bg-emerald-500" : data.marginChange < 0 ? "bg-red-500" : "bg-amber-400",
                  detail: "Margin performance compared with the prior reporting period. The expanded view shows the implied prior-period margin and why margin movement matters for every sales dollar.",
                },
                {
                  key: "cash" as const,
                  label: "Cash Position",
                  value: currency.format(data.cash),
                  change: percent(data.cashChange),
                  tone: data.cashChange > 0 ? "text-emerald-600" : data.cashChange < 0 ? "text-red-600" : "text-amber-600",
                  signal: data.cashChange > 0 ? "bg-emerald-500" : data.cashChange < 0 ? "bg-red-500" : "bg-amber-400",
                  detail: "Current cash available and the change from the prior reporting period. The expanded view adds prior-period cash and context for interpreting cash alongside working capital and operating performance.",
                },
                {
                  key: "attention" as const,
                  label: "Needs Attention",
                  value: String(data.attention),
                  change: `${data.attention} ${data.attention === 1 ? "issue" : "issues"}`,
                  tone: data.attention > 0 ? "text-red-600" : "text-emerald-600",
                  signal: data.attention > 0 ? "bg-red-500" : "bg-emerald-500",
                  detail: "Detected exceptions that deserve management attention. The expanded view shows the actual issues ClearCFO found so the count has useful context rather than being just a number.",
                },
              ].map((metric) => {
                const isExpanded = expandedMetric === metric.key;

                return (
                  <button
                    type="button"
                    key={metric.key}
                    onClick={() => toggleMetric(metric.key)}
                    aria-expanded={isExpanded}
                    className={`relative min-h-[132px] rounded-2xl border p-5 text-left shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${
                      isExpanded
                        ? "z-10 border-blue-300 bg-blue-50/70 shadow-lg shadow-blue-900/10 md:-translate-y-1 md:scale-[1.02]"
                        : expandedMetric
                          ? "border-slate-200 bg-white opacity-65 hover:opacity-100"
                          : "border-slate-200 bg-white hover:-translate-y-1 hover:border-blue-200 hover:shadow-md hover:shadow-blue-900/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${metric.signal}`} aria-hidden="true" />
                        <p className="text-xs font-medium text-slate-500 sm:text-sm">
                          {metric.label}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-slate-400">
                        {isExpanded ? "Selected" : "View detail"}
                      </span>
                    </div>

                    <p className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                      {metric.value}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold sm:text-sm">
                      <span className={metric.tone}>{metric.change}</span>
                      <span className="font-normal text-slate-400">vs. prior period</span>
                    </div>

                                      </button>
                );
              })}
            </div>

            {expandedMetric && (() => {
              const selected = [
                {
                  key: "revenue" as const,
                  label: "Revenue",
                  detail: `Current revenue is ${currency.format(data.revenue)}. The implied prior-period level is approximately ${currency.format(data.revenue / (1 + data.revenueChange / 100))}, a ${data.revenueChange >= 0 ? "gain" : "decline"} of ${formatPercentValue(Math.abs(data.revenueChange))}%.`,
                  context: `Across the available trend, revenue has ${trendChange >= 0 ? "increased" : "declined"} ${formatPercentValue(Math.abs(trendChange))}%.`,
                  why: "Revenue growth is useful context for judging whether costs, margins, and working capital are keeping pace.",
                },
                {
                  key: "margin" as const,
                  label: "Gross Margin",
                  detail: `Current gross margin is ${formatPercentValue(data.grossMargin)}%. The implied prior-period margin is approximately ${formatPercentValue((data.grossMargin - data.marginChange))}%, a ${data.marginChange >= 0 ? "gain" : "decline"} of ${Math.abs(data.marginChange).toFixed(1)} points.`,
                  context: `Margin is ${data.marginChange >= 0 ? "improving" : "declining"} versus the prior period.`,
                  why: "Margin shows how much of each sales dollar remains after direct costs and helps explain whether revenue growth is translating into gross profit.",
                },
                {
                  key: "cash" as const,
                  label: "Cash Position",
                  detail: `Current cash is ${currency.format(data.cash)}. The implied prior-period position is approximately ${currency.format(data.cash / (1 + data.cashChange / 100))}, a ${data.cashChange >= 0 ? "gain" : "decline"} of ${formatPercentValue(Math.abs(data.cashChange))}%.`,
                  context: "Cash should be read alongside inventory, receivables, payables, and operating performance.",
                  why: "A stronger cash balance is useful, but the source and sustainability of the movement matter.",
                },
                {
                  key: "attention" as const,
                  label: "Needs Attention",
                  detail: `${data.attention} ${data.attention === 1 ? "issue is" : "issues are"} currently flagged for management attention.`,
                  context: data.alerts.slice(0, 3).join(" "),
                  why: "This is a shortcut to the exceptions ClearCFO believes deserve investigation before lower-priority details.",
                },
              ].find((item) => item.key === expandedMetric);

              if (!selected) return null;

              return (
                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/40 p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">KPI detail</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">{selected.label}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedMetric(null)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-blue-600"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-white bg-white/80 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What changed</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selected.detail}</p>
                    </div>
                    <div className="rounded-xl border border-white bg-white/80 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Context</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selected.context}</p>
                    </div>
                    <div className="rounded-xl border border-white bg-white/80 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Why it matters</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{selected.why}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      KPI trend — Revenue performance
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Trailing{" "}
                      {data.trend.length}{" "}
                      periods
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${
                        trendChange >= 0
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {percent(
                        trendChange
                      )}
                    </p>

                    <p className="text-xs text-slate-400">
                      trend
                    </p>
                  </div>
                </div>

                <div className="relative mt-6 h-32 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50 px-2 pt-3">
                  <div className="pointer-events-none absolute inset-x-2 top-5 border-t border-slate-200/80" />
                  <div className="pointer-events-none absolute inset-x-2 top-1/2 border-t border-slate-200/70" />
                  <div className="pointer-events-none absolute inset-x-2 bottom-5 border-t border-slate-200/80" />
                  <div className="relative flex h-full items-end gap-2">
                  {data.trend.map(
                    (
                      height,
                      index
                    ) => (
                      <div
                        key={index}
                        className="flex h-full flex-1 items-end"
                      >
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            index ===
                            data.trend.length - 1
                              ? "bg-blue-600"
                              : "bg-blue-200"
                          }`}
                          style={{
                            height: `${trendHeights[index] ?? 55}%`,
                          }}
                        />
                      </div>
                    )
                  )}
                  </div>
                </div>

                <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                  <span>
                    {data.periods?.[0] ??
                      "Prior"}
                  </span>

                  <span>
                    {data.periods?.[
                      data.periods.length -
                        1
                    ] ??
                      "Current"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm sm:p-7">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    What needs attention
                  </p>

                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    {data.attention}{" "}
                    {data.attention === 1
                      ? "alert"
                      : "alerts"}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {data.alerts
                    .slice(0, 3)
                    .map(
                      (
                        alert,
                        index
                      ) => (
                        <div
                          key={alert}
                          className="w-full rounded-xl border border-amber-100 bg-white/80 p-3 text-left"
                        >
                          <p className="text-xs font-semibold text-slate-900">
                            {index === 0
                              ? "Priority exception"
                              : "Detected variance"}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {alert}
                          </p>
                        </div>
                      )
                    )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
            <div className="order-2 mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Financial drivers</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">What is actually driving the result?</h3>
                  <p className="mt-1 text-sm text-slate-500">ClearCFO ranks the strongest observable financial relationships before AI reasoning is applied.</p>
                </div>
              </div>

              {showFinancialDetail && (
                <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.drivers.slice(0, 4).map((driver) => (
                  <div key={driver.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${driver.severity === "High" ? "bg-red-500" : driver.severity === "Medium" ? "bg-amber-400" : "bg-emerald-500"}`} aria-hidden="true" />
                            <p className="text-sm font-semibold text-slate-900">{driver.title}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${driver.severity === "High" ? "bg-red-50 text-red-700" : driver.severity === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{driver.severity === "Watch" ? "Monitor" : driver.severity}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{driver.observation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {data.relationships.length > 0 && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Driver relationships</p>
                  <ul className="mt-2 space-y-1.5">
                    {data.relationships.slice(0, 3).map((relationship) => (
                      <li key={relationship} className="text-xs leading-5 text-slate-600">
                        <span className="mr-2 text-blue-500">•</span>{relationship}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.unknowns.length > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">What ClearCFO does not know yet</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">These are evidence gaps, not assumptions. They identify where additional detail would improve the recommendation.</p>
                  <ul className="mt-2 space-y-1.5">
                    {data.unknowns.slice(0, 4).map((unknown) => (
                      <li key={unknown} className="text-xs leading-5 text-slate-600">
                        <span className="mr-2 text-slate-400">•</span>{unknown}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
                </>
              )}
            </div>

            {data.trendSeries.length > 0 && (
              <div className="order-3 mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Financial Trends</p>
                    <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">What has changed over time?</h3>
                    <p className="mt-1 text-sm text-slate-600">See whether the latest result is part of a broader pattern across the available periods.</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Across periods</span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {data.trendSeries.slice(0, 4).map((series) => {
                    const values = series.values.filter((v) => Number.isFinite(v));
                    const first = values[0] ?? 0;
                    const last = values[values.length - 1] ?? 0;
                    const change = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
                    const lowerName = series.name.toLowerCase();
                    const isInventory = lowerName.includes("inventory");
                    const isExpense = lowerName.includes("expense");
                    const isCash = lowerName.includes("cash");
                    const isMargin = lowerName.includes("margin");
                    const isNegative = change < 0;
                    const tone =
                      isExpense || isInventory
                        ? isNegative ? "positive" : "monitor"
                        : isNegative ? "attention" : "positive";
                    const toneText =
                      tone === "monitor" ? "text-amber-600" :
                      tone === "attention" ? "text-red-600" :
                      "text-emerald-600";
                    const line =
                      tone === "monitor" ? "#f59e0b" :
                      tone === "attention" ? "#ef4444" :
                      "#10b981";
                    const latest = values.at(-1) ?? 0;
                    const prior = values.at(-2) ?? latest;
                    const formatTrendValue = (value: number) =>
                      isMargin ? `${formatPercentValue(value)}%` : formatCurrency(value);

                    // Use every available period as a real data point. The axis
                    // labels are intentionally sparse so the chart stays readable.
                    const minValue = Math.min(...values);
                    const maxValue = Math.max(...values);
                    const valueRange = Math.max(maxValue - minValue, 1);
                    const chartMin = minValue - valueRange * 0.12;
                    const chartMax = maxValue + valueRange * 0.12;
                    const chartRange = Math.max(chartMax - chartMin, 1);
                    const plotLeft = 18;
                    const plotRight = 98;
                    const plotTop = 8;
                    const plotBottom = 72;

                    const points = values.map((value, index) => {
                      const x = values.length === 1
                        ? (plotLeft + plotRight) / 2
                        : plotLeft + (index / (values.length - 1)) * (plotRight - plotLeft);
                      const y = plotBottom - ((value - chartMin) / chartRange) * (plotBottom - plotTop);
                      return `${x},${y}`;
                    }).join(" ");

                    const axisLabelCount =
                      values.length >= 10 ? 4 :
                      values.length >= 6 ? 3 :
                      Math.min(values.length, 3);

                    const axisIndexes = Array.from({ length: axisLabelCount }, (_, i) => {
                      if (axisLabelCount === 1) return 0;
                      return Math.round((i / (axisLabelCount - 1)) * (values.length - 1));
                    });

                    const axisPeriodLabels = axisIndexes.map((index) => ({
                      index,
                      label: series.periods[index] ?? `P${index + 1}`,
                    }));

                    const trendLabel =
                      isInventory ? (change >= 0 ? "Building" : "Easing") :
                      isExpense ? (change >= 0 ? "Increasing" : "Decreasing") :
                      isCash ? (change >= 0 ? "Strengthening" : "Declining") :
                      isMargin ? (change >= 0 ? "Expanding" : "Compressing") :
                      change >= 0 ? "Growing" : "Declining";

                    return (
                      <div key={series.name} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{series.name}</p>
                            <p className={`mt-1 text-sm font-bold ${toneText}`}>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</p>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400">{values.length}-period</span>
                        </div>

                        <p className="mt-1 text-[11px] font-semibold text-slate-500">{trendLabel}</p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 pb-2 pt-3">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Trend by period</span>
                  <span className="text-[10px] font-semibold text-slate-500">Latest {formatTrendValue(latest)}</span>
                </div>
                <svg
                  viewBox="0 0 520 190"
                  className="h-44 w-full"
                  role="img"
                  aria-label={`${series.name} historical trend across ${values.length} periods`}
                >
                  {(() => {
                    const chartLeft = 54;
                    const chartRight = 504;
                    const chartTop = 14;
                    const chartBottom = 142;
                    const chartHeight = chartBottom - chartTop;
                    const yTicks = [maxValue, (maxValue + minValue) / 2, minValue];
                    const tickLabels = yTicks.map((value) => isMargin ? `${formatPercentValue(value)}%` : formatCurrency(value));
                    const xFor = (index: number) => values.length === 1
                      ? (chartLeft + chartRight) / 2
                      : chartLeft + (index / (values.length - 1)) * (chartRight - chartLeft);
                    const yFor = (value: number) => chartBottom - ((value - chartMin) / chartRange) * chartHeight;
                    const chartPoints = values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
                    const areaPoints = `${chartLeft},${chartBottom} ${chartPoints} ${chartRight},${chartBottom}`;

                    return (
                      <>
                        {yTicks.map((value, index) => (
                          <g key={`y-${index}`}>
                            <line x1={chartLeft} y1={yFor(value)} x2={chartRight} y2={yFor(value)} stroke="#dbe3ec" strokeWidth="1" />
                            <text x="48" y={yFor(value) + 3} textAnchor="end" fontSize="10" fill="#64748b">{tickLabels[index]}</text>
                          </g>
                        ))}
                        <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#cbd5e1" strokeWidth="1" />
                        <polygon points={areaPoints} fill={line} opacity="0.08" />
                        <polyline points={chartPoints} fill="none" stroke={line} strokeWidth="3.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />

                        {values.map((value, index) => {
                          const x = xFor(index);
                          const y = yFor(value);
                          const isLatest = index === values.length - 1;
                          return (
                            <g key={`${series.name}-${index}`}>
                              {isLatest && <circle cx={x} cy={y} r="7" fill={line} opacity="0.14" />}
                              <circle cx={x} cy={y} r={isLatest ? "4.5" : "3.2"} fill={line} stroke="#ffffff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            </g>
                          );
                        })}

                        {axisPeriodLabels.map(({ index, label }) => {
                          const x = xFor(index);
                          return (
                            <text key={`x-${index}`} x={x} y="166" textAnchor={index === 0 ? "start" : index === values.length - 1 ? "end" : "middle"} fontSize="11" fontWeight="600" fill="#64748b">
                              {label}
                            </text>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Latest {formatTrendValue(latest)}</span>
                          <span>Prior {formatTrendValue(prior)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                  <p className="text-xs font-semibold leading-5 text-blue-800"><span className="font-bold">The bigger picture:</span> {data.trendInsights[0] ?? "The available history shows how the latest period fits into the broader financial trend."} {data.trendInsights[1] ?? "Management should watch whether the current pattern persists."}</p>
                </div>
              </div>
            )}

            <div className="order-1 mt-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white p-6 shadow-sm sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm text-white">
                    ✦
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-blue-700">
                        ClearCFO Recommendation
                      </p>

                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                        Data driven
                      </span>
                    </div>

                    <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                      {
                        data.recommendation
                      }
                    </h3>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">ClearCFO turns the strongest financial evidence into a focused management action. Review the drivers and evidence below to understand why it matters and what deserves attention.</p>
                  </div>
                </div>


              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  Based on analyzed financial history
                </span>

                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{data.source === "upload" ? `Analyzed for ${data.companyName}` : "Demo financial data"}</span>

                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">Evidence confidence: {data.confidence >= 85 ? "High" : data.confidence >= 65 ? "Moderate" : "Limited"}</span>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {aiAnalysis ? (
                  <button type="button" onClick={() => setShowAnalysis(true)} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">View Full CFO Analysis →</button>
                ) : aiLoading ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">ClearCFO is analyzing your financial data…</div>
                ) : aiError ? (
                  <button type="button" onClick={() => generateAIAnalysis()} disabled={aiLoading} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30">Retry Analysis</button>
                ) : null}
              </div>
              {aiError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
                  {aiError}
                  {!aiLoading && /OPENAI_API_KEY|AI analysis is not configured/i.test(aiError) && (
                    <p className="mt-1 font-medium text-red-700">
                      Add OPENAI_API_KEY to .env.local, restart the app, and retry.
                    </p>
                  )}
                </div>
              )}
            </div>
            </div>

        </>
      </div>
    </div>

      {showAnalysis && (
        <div id="cfo-analysis" className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <Navbar
            onNavigate={(href) => {
              setShowAnalysis(false);
              window.setTimeout(() => {
                document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 0);
            }}
            onLogin={() => setShowAnalysis(false)}
            loginLabel="Back to Briefing"
          />

          <div id="cfo-analysis-content" className="mx-auto min-h-[calc(100vh-5rem)] max-w-5xl px-5 py-7 sm:px-7 sm:py-10">
          <div className="border-b border-slate-200 pb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ClearCFO Analysis</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">What changed, why it matters, and what to do next.</h3>
          </div>

          {aiAnalysis ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/70 via-white to-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
                      AI CFO Reasoning
                    </p>
                    <h4 className="mt-1 text-lg font-bold text-slate-900">
                      Executive readout
                    </h4>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
                    {data.attention === 0 ? "Monitor" : aiAnalysis.priority} priority · {aiAnalysis.confidence >= 85 ? "High" : aiAnalysis.confidence >= 65 ? "Moderate" : "Limited"} confidence
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-700">
                  {aiAnalysis.executiveSummary}
                </p>
              </div>

              {aiAnalysis.evidence.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Evidence used</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {aiAnalysis.evidence.slice(0, 4).map((item) => (
                      <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">{item}</span>
                    ))}
                  </div>
                </div>
              )}

              {aiAnalysis.unknowns && aiAnalysis.unknowns.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Evidence gaps</p>
                  <div className="mt-3 space-y-2">
                    {aiAnalysis.unknowns.slice(0, 4).map((unknown) => (
                      <p key={unknown} className="text-xs leading-5 text-slate-600">• {unknown}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Primary driver
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {aiAnalysis.primaryDriver}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Management question
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {aiAnalysis.managementQuestion}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm md:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Why it matters
                  </p>
                  <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-700">
                    {aiAnalysis.whyItMatters}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Recommended action
                </p>
                <p className="mt-2 text-base font-semibold leading-6 text-slate-900">
                  {aiAnalysis.recommendedAction}
                </p>
              </div>

              <div>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Prioritized actions
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      The next management moves ClearCFO would prioritize.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> High</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Medium</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Monitor</span>
                  </div>
                </div>

                <div className="grid gap-3">
                  {aiAnalysis.actions.slice(0, 4).map((action, index) => (
                    <div key={`${action.title}-${index}`} className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                          {index + 1}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {action.title}
                            </p>
                            <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${action.priority === "High" ? "bg-red-50 text-red-700" : action.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                              <span className={`h-2 w-2 rounded-full ${action.priority === "High" ? "bg-red-500" : action.priority === "Medium" ? "bg-amber-400" : "bg-emerald-500"}`} aria-hidden="true" />
                              {action.priority === "Watch" ? "Monitor" : action.priority}
                            </span>
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                              Score {scoreAIAction(action)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {action.rationale}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Executive readout</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{deterministicAnalysis.summary}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Primary driver</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{deterministicAnalysis.primaryDriver}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{deterministicAnalysis.whyItMatters}</p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Management question</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{deterministicAnalysis.managementQuestion}</p>
                </div>

                <div className="rounded-2xl bg-emerald-50/60 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Recommended action</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{data.recommendation}</p>
                </div>
              </div>

              {deterministicAnalysis.unknowns.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Evidence gaps</p>
                  <div className="mt-2 space-y-1.5">
                    {deterministicAnalysis.unknowns.slice(0, 4).map((unknown) => (
                      <p key={unknown} className="text-xs leading-5 text-slate-600">• {unknown}</p>
                    ))}
                  </div>
                </div>
              )}

              {deterministicAnalysis.actions.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Prioritized actions</p>
                  <div className="mt-3 grid gap-3">
                    {deterministicAnalysis.actions.map((action, index) => (
                      <div key={`${action.title}-${index}`} className="rounded-2xl bg-white p-4 shadow-sm">
                        <div className="flex gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                              <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${action.priority === "High" ? "bg-red-50 text-red-700" : action.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}><span className={`h-2 w-2 rounded-full ${action.priority === "High" ? "bg-red-500" : action.priority === "Medium" ? "bg-amber-400" : "bg-emerald-500"}`} aria-hidden="true" />{action.priority === "Watch" ? "Monitor" : action.priority}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{action.rationale}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>

          <Footer onNavigate={(href) => {
            setShowAnalysis(false);
            window.setTimeout(() => {
              document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 0);
          }} />
        </div>
      )}
    </div>
  );
}
