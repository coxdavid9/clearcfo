"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import OnboardingFlow from "./OnboardingFlow";
import BusinessSwitcher from "./BusinessSwitcher";
import PlanSelection from "./PlanSelection";
import {
  type BriefingData,
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

function KpiDrilldown({ breakdown }: { breakdown?: NonNullable<BriefingData["kpiBreakdowns"]>[keyof NonNullable<BriefingData["kpiBreakdowns"]>] }) {
  if (!breakdown) return null;
  const total = breakdown.rows.reduce((sum, row) => sum + Math.max(0, row.current), 0);
  return (
    <div className="mt-5 min-h-[220px] border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{breakdown.title}</p>
        <p className="text-xs font-medium text-slate-400">{breakdown.asOfLabel || breakdown.periodLabel}</p>
      </div>
      {breakdown.variant === "bars" ? (
        breakdown.rows.length ? (
          <div className="mt-4 space-y-4">
            {breakdown.rows.map((row) => {
              const share = total > 0 ? Math.round((Math.max(0, row.current) / total) * 100) : 0;
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between gap-3 text-sm"><p className="font-medium text-slate-800">{row.label}</p><p className="font-semibold tabular-nums text-slate-900">{currency.format(row.current)}</p></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${share}%` }} /></div>
                  <p className="mt-1 text-[10px] font-medium text-slate-400">{share}% of breakdown</p>
                </div>
              );
            })}
          </div>
        ) : null
      ) : (
        <div className="mt-4 space-y-2">
          {breakdown.rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0"><p className="text-sm font-medium text-slate-700">{row.label}</p><p className="text-sm font-semibold tabular-nums text-slate-900">{currency.format(row.current)}</p></div>)}
        </div>
      )}
      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3"><p className="text-sm leading-6 text-slate-700">{breakdown.insight}</p></div>
    </div>
  );
}
export default function CFOBriefing() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<BriefingData>(demoData);
  const [liveSource, setLiveSource] = useState<"demo" | "upload" | "quickbooks">("demo");
  const [hasValidAnalysis, setHasValidAnalysis] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFileLabel, setSelectedFileLabel] = useState("");
  const [error, setError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [lastSyncedLabel, setLastSyncedLabel] = useState("");
  const [onboardingStep, setOnboardingStep] = useState<"welcome" | "connect" | "building">("welcome");
  const [onboardingSource, setOnboardingSource] = useState<"quickbooks" | "excel">("quickbooks");
  const [readyBanner, setReadyBanner] = useState(false);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingLocked, setBillingLocked] = useState(false);
  const [billingCancelled, setBillingCancelled] = useState(false);
  const [billingInfo, setBillingInfo] = useState<{plan:"core"|"pro"|null;interval:"month"|"year"|null;status:string|null;trialEndsAt:string|null}>({plan:null,interval:null,status:null,trialEndsAt:null});

  const onboardingSyncing = () => {
    try { return sessionStorage.getItem("clearcfo_onboarding_syncing") === "1"; } catch { return false; }
  };
  const markBriefingReady = () => {
    const wasSyncing = onboardingSyncing();
    try { sessionStorage.removeItem("clearcfo_onboarding_syncing"); } catch {}
    if (wasSyncing) {
      try {
        if (localStorage.getItem("clearcfo_briefing_ready_seen") !== "1") setReadyBanner(true);
      } catch {}
    }
  };
  const marginBaseline = data.drivers.some((driver) => driver.id === "margin-baseline");
  const zeroCogsNote = data.drivers.some((driver) => driver.id === "account-classification-review");
  const [activeMetricKey, setActiveMetricKey] = useState<"revenue" | "margin" | "cash" | "inventory">("revenue");
  const activeMetric = useMemo(() => {
    const metricLabels: Record<string, string> = {
      revenue: "Revenue",
      margin: "Gross Margin",
      cash: "Cash Position",
      inventory: "Inventory",
    };
    const label = metricLabels[activeMetricKey] || "Revenue";
    return data.trendSeries?.find((series) => series.name === label) || {
      name: label,
      values: [],
      periods: [],
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
      let excelCached: BriefingData | null = null;
      let excelUploadedAt: string | null = null;
      try {
        const storedExcelBriefing = window.localStorage.getItem("clearcfo_excel_briefing");
        if (storedExcelBriefing) {
          const parsed = JSON.parse(storedExcelBriefing) as BriefingData;
          if (parsed?.companyName && Array.isArray(parsed.alerts)) excelCached = parsed;
        }
        excelUploadedAt = window.localStorage.getItem("clearcfo_excel_uploaded_at");
      } catch {
        excelCached = null;
        excelUploadedAt = null;
      }
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
        if (statusOk) {
          evictQuickBooksCache();
        }
        if (excelCached) {
          setData(excelCached);
          setLiveSource("upload");
          setHasValidAnalysis(true);
          setError("");
          setSyncNotice("");
          setLastSyncedLabel(excelUploadedAt || "");
          cacheAnalysisInput(excelCached);
          return;
        }
        if (!statusOk && cached?.companyName && Array.isArray(cached.alerts)) {
          setData(cached);
          setLiveSource("quickbooks");
          setHasValidAnalysis(true);
          cacheAnalysisInput(cached);
          setLastSyncedLabel(formatSyncedAt(cachedSyncedAt));
        } else {
          setLiveSource("demo");
          setHasValidAnalysis(false);
          setError("");
          setSyncNotice("");
          setLastSyncedLabel("");
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
        markBriefingReady();
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
      try { sessionStorage.removeItem("clearcfo_onboarding_syncing"); } catch {}
      setOnboardingStep("connect");
      setError(err instanceof Error ? err.message : "ClearCFO could not load your QuickBooks financial data.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (new URLSearchParams(window.location.search).get("billing") === "cancelled") setBillingCancelled(true);
    void fetch("/api/billing/status", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to check billing status.");
      if (cancelled) return;
      setBillingInfo({
        plan: payload?.plan === "core" || payload?.plan === "pro" ? payload.plan : null,
        interval: payload?.interval === "month" || payload?.interval === "year" ? payload.interval : null,
        status: typeof payload?.status === "string" ? payload.status : null,
        trialEndsAt: typeof payload?.trialEndsAt === "string" ? payload.trialEndsAt : null,
      });
      setBillingLocked(payload?.hasAccess !== true);
      setBillingLoading(false);
    }).catch((error) => {
      if (cancelled) return;
      setBillingLocked(true);
      setBillingLoading(false);
      setError(error instanceof Error ? error.message : "Unable to check billing status.");
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (billingLoading || billingLocked) return;
    try {
      const syncing = sessionStorage.getItem("clearcfo_onboarding_syncing") === "1";
      const seen = localStorage.getItem("clearcfo_onboarding_seen") === "1";
      if (syncing) setOnboardingStep("building");
      else setOnboardingStep(seen ? "connect" : "welcome");
    } catch {}
    const handleOnboardingConnect = () => setOnboardingStep("connect");
    const handleOnboardingWelcome = () => setOnboardingStep("welcome");
    window.addEventListener("clearcfo:onboarding-connect", handleOnboardingConnect);
    window.addEventListener("clearcfo:onboarding-welcome", handleOnboardingWelcome);
    void loadQuickBooksBriefing().finally(() => {
      setIsLoading(false);
      (window as unknown as { __clearcfoBriefingReady?: boolean }).__clearcfoBriefingReady = true;
      window.dispatchEvent(new CustomEvent("clearcfo:briefing-ready"));
    });
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
        markBriefingReady();
        return;
      }
      void loadQuickBooksBriefing();
    };
    const handleDisconnect = () => {
      evictQuickBooksCache();
      setLiveSource("demo");
      setHasValidAnalysis(false);
      setIsLoading(false);
      (window as unknown as { __clearcfoBriefingReady?: boolean }).__clearcfoBriefingReady = true;
      window.dispatchEvent(new CustomEvent("clearcfo:briefing-ready"));
      setError("");
      setSyncNotice("");
      setLastSyncedLabel("");
    };
    window.addEventListener("clearcfo:quickbooks-sync", handleSync);
    window.addEventListener("clearcfo:quickbooks-disconnected", handleDisconnect);
    return () => {
      window.removeEventListener("clearcfo:quickbooks-sync", handleSync);
      window.removeEventListener("clearcfo:quickbooks-disconnected", handleDisconnect);
      window.removeEventListener("clearcfo:onboarding-connect", handleOnboardingConnect);
      window.removeEventListener("clearcfo:onboarding-welcome", handleOnboardingWelcome);
    };
  }, [billingLoading, billingLocked]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setHasValidAnalysis(false);
    setError("");
    setOnboardingSource("excel");
    setOnboardingStep("building");
    try { sessionStorage.setItem("clearcfo_onboarding_syncing", "1"); } catch {}
    try {
      const workbook = XLSX.utils.book_new();
      const usedSheetNames = new Set<string>();

      const appendSheet = (sheet: XLSX.WorkSheet, requestedName: string) => {
        // First file wins on sheet-name collisions; later sheets are suffixed.
        const baseName = requestedName.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
        let sheetName = baseName;
        let suffix = 2;
        while (usedSheetNames.has(sheetName)) {
          const suffixText = ` (${suffix++})`;
          sheetName = `${baseName.slice(0, Math.max(1, 31 - suffixText.length))}${suffixText}`;
        }
        usedSheetNames.add(sheetName);
        XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      };

      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const parsed = XLSX.read(buffer, { cellDates: true });
        const isCsv = /\.csv$/i.test(file.name);
        if (isCsv) {
          const sheet = parsed.Sheets[parsed.SheetNames[0]];
          if (sheet) appendSheet(sheet, file.name.replace(/\.[^.]+$/, ""));
          continue;
        }
        for (const sheetName of parsed.SheetNames) {
          const sheet = parsed.Sheets[sheetName];
          if (sheet) appendSheet(sheet, sheetName);
        }
      }

      if (!workbook.SheetNames.length) {
        throw new Error("We couldn't find a readable worksheet in the selected files. Please check the file format and sheet names.");
      }

      const analyzed = analyzeWorkbook(workbook);
      setData(analyzed);
      setLiveSource("upload");
      setSelectedFileLabel(files.length === 1 ? files[0].name : `${files.length} files: ${files.map((file) => file.name).join(", ")}`);
      setHasValidAnalysis(true);
      setSyncNotice("");
      const uploadedAt = new Date().toISOString();
      setLastSyncedLabel(uploadedAt);
      try {
        window.localStorage.setItem("clearcfo_excel_briefing", JSON.stringify(analyzed));
        window.localStorage.setItem("clearcfo_excel_uploaded_at", uploadedAt);
      } catch {
        // Keep the in-session briefing usable if browser storage is unavailable.
      }
      cacheAnalysisInput(analyzed);
      markBriefingReady();
    } catch (err) {
      setHasValidAnalysis(false);
      try { sessionStorage.removeItem("clearcfo_onboarding_syncing"); } catch {}
      setOnboardingStep("connect");
      setError(err instanceof Error ? err.message : "We couldn't read that workbook. Please check the file format and sheet names.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const emptyState = (
    <OnboardingFlow
      step={onboardingStep}
      source={onboardingSource}
      error={error}
      onUpload={() => fileRef.current?.click()}
      onBack={onboardingStep === "connect" && localStorage.getItem("clearcfo_onboarding_seen") === "1" ? () => {
        localStorage.removeItem("clearcfo_onboarding_seen");
        setOnboardingStep("welcome");
      } : undefined}
    />
  );

  const metrics = [
    { key: "revenue" as const, label: "Revenue", value: currency.format(data.revenue), change: data.revenueChange, tone: data.revenueChange > 0 ? "text-emerald-600" : data.revenueChange < 0 ? "text-red-600" : "text-amber-600", signal: data.revenueChange > 0 ? "bg-emerald-500" : data.revenueChange < 0 ? "bg-red-500" : "bg-amber-400" },
    { key: "margin" as const, label: "Gross Margin", value: formatPercentValue(data.grossMargin), change: data.marginChange, tone: marginBaseline ? "text-amber-600" : data.marginChange > 0 ? "text-emerald-600" : data.marginChange < 0 ? "text-red-600" : "text-amber-600", signal: marginBaseline ? "bg-amber-400" : data.marginChange > 0 ? "bg-emerald-500" : data.marginChange < 0 ? "bg-red-500" : "bg-amber-400" },
    { key: "cash" as const, label: "Cash Position", value: currency.format(data.cash), change: data.cashChange, tone: data.cashChange > 0 ? "text-emerald-600" : data.cashChange < 0 ? "text-red-600" : "text-amber-600", signal: data.cashChange > 0 ? "bg-emerald-500" : data.cashChange < 0 ? "bg-red-500" : "bg-amber-400", cashAsOfDate: data.cashAsOfDate, liveCashNote: data.liveCashNote },
    { key: "inventory" as const, label: "Inventory", value: currency.format(data.inventory), change: data.inventoryChange, tone: !Number.isFinite(data.inventoryChange) ? "text-slate-500" : data.inventoryChange > 0 ? "text-amber-600" : data.inventoryChange < 0 ? "text-emerald-600" : "text-slate-500", signal: data.inventoryChange > 0 ? "bg-amber-400" : data.inventoryChange < 0 ? "bg-emerald-500" : "bg-slate-400" },
  ];
  const mtd = data.mtdComparison;
  const attentionCandidates = useMemo(() => {
    const driverCandidates = data.drivers.map((driver) => ({
      id: driver.id,
      title: driver.title,
      observation: driver.observation,
      severity: driver.severity,
      estimatedImpact: driver.estimatedImpact,
    }));
    const ratioCandidates = (data.ratios || [])
      .filter((ratio) => ratio.health !== "strong")
      .map((ratio) => ({
        id: `ratio-${ratio.id}`,
        title: ratio.label,
        observation: ratio.interpretation,
        severity: ratio.health === "attention" ? "High" : "Medium",
        estimatedImpact: undefined as number | undefined,
      }));
    const severityRank: Record<string, number> = { High: 3, Medium: 2, Watch: 1 };
    return [...driverCandidates, ...ratioCandidates].sort((a, b) => {
      const impactA = Number.isFinite(a.estimatedImpact) ? (a.estimatedImpact as number) : -1;
      const impactB = Number.isFinite(b.estimatedImpact) ? (b.estimatedImpact as number) : -1;
      if (impactA !== impactB) return impactB - impactA;
      return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    });
  }, [data.drivers, data.ratios]);
  const shownAttention = attentionCandidates.slice(0, 3);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const visibleAttention = showAllAttention ? attentionCandidates : shownAttention;
  const attentionCountLabel = showAllAttention ? attentionCandidates.length : Math.min(3, attentionCandidates.length);

  if (billingLoading) {
    return <main className="min-h-screen bg-slate-50 px-5 py-10"><div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold text-slate-500">Checking your ClearCFO plan…</p></div></main>;
  }
  if (billingLocked) return <PlanSelection cancelled={billingCancelled} locked status={billingInfo.status} />;

  if (isLoading) {
    return (
      <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
        <div className="mx-auto w-full max-w-6xl animate-pulse" aria-label="Loading your CFO Briefing">
          <div className="h-8 w-64 rounded-lg bg-slate-200" />
          <div className="mt-2 h-4 w-96 max-w-full rounded bg-slate-100" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => <div key={index} className="h-28 rounded-2xl bg-slate-100" />)}
          </div>
          <div className="mt-4 h-64 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!hasValidAnalysis) {
    return (
      <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
        <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
        {error && <div className="mx-auto mb-4 w-full max-w-6xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">{error}</div>}
        <div className="mx-auto w-full max-w-6xl">{emptyState}</div>
      </div>
    );
  }

  return (
    <div className="px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_25px_80px_-35px_rgba(15,23,42,0.35)]">
        <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
        <div className="border-b border-slate-200 bg-white px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">TODAY&apos;S CFO BRIEFING</p>
              <p className="mt-1 text-sm text-slate-500">{liveSource === "quickbooks" ? `${data.companyName} · Synced ${lastSyncedLabel || "just now"}` : liveSource === "upload" ? `${data.companyName} · Last uploaded: ${lastSyncedLabel ? new Date(lastSyncedLabel).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unknown"}` : "Demo data"}</p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
              <BusinessSwitcher />
              {selectedFileLabel && liveSource === "upload" ? <p className="max-w-xs truncate text-xs text-slate-400" title={selectedFileLabel}>{selectedFileLabel}</p> : null}
              <button type="button" onClick={() => fileRef.current?.click()} className={liveSource === "quickbooks" ? "text-sm font-semibold text-slate-500 underline-offset-4 hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30" : "rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-blue-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30"}>{uploading ? "Analyzing…" : "Upload Excel"}</button>
            </div>
          </div>
        </div>

        <div className="p-7 sm:p-10">
          {readyBanner && (
            <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">Your CFO Briefing is ready.</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Start with the takeaway — if you read one paragraph, read that one.</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => document.getElementById("takeaway-heading")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">Show me the takeaway</button>
                  <button type="button" onClick={() => { localStorage.setItem("clearcfo_briefing_ready_seen", "1"); localStorage.setItem("clearcfo_onboarding_done", "1"); setReadyBanner(false); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Got it</button>
                </div>
              </div>
            </div>
          )}
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {syncNotice && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{syncNotice}</div>}

          {billingInfo.status === "trialing" && billingInfo.trialEndsAt ? (
            <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-slate-800">Trial ends in {Math.max(0, Math.ceil((new Date(billingInfo.trialEndsAt).getTime() - Date.now()) / 86400000))} days — {billingInfo.plan === "pro" ? "Pro" : "Core"} {billingInfo.interval === "year" ? (billingInfo.plan === "pro" ? "$790/year" : "$390/year") : (billingInfo.plan === "pro" ? "$79/mo" : "$39/mo")} starts {new Date(billingInfo.trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>
                <button type="button" onClick={async()=>{const r=await fetch("/api/billing/portal",{method:"POST"});const d=await r.json().catch(()=>({}));if(d?.url)window.location.href=d.url;}} className="shrink-0 text-sm font-semibold text-blue-700 hover:text-blue-800">Manage billing</button>
              </div>
            </div>
          ) : null}
          <section aria-labelledby="takeaway-heading">
            <p id="takeaway-heading" className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">THE TAKEAWAY</p>
            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm sm:p-7"><p className="text-base leading-7 text-slate-800 sm:text-lg">{deterministicAnalysis}</p></div>
          </section>

          <section className="mt-8" aria-labelledby="attention-heading">
            <div className="flex items-center gap-2"><p id="attention-heading" className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">NEEDS YOUR ATTENTION</p><span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">{attentionCountLabel} of {attentionCandidates.length}</span></div>
            <p className="mt-1 text-xs text-slate-500">Ranked by estimated dollar impact, then severity.</p>
            {attentionCandidates.length > 0 ? (
              <div className="mt-4 space-y-3">
                {visibleAttention.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold text-slate-900">{item.title}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${item.severity === "High" ? "bg-red-50 text-red-600" : item.severity === "Medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{item.severity}</span></div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.observation}</p>
                    {item.estimatedImpact !== undefined && <p className="mt-2 text-xs font-bold text-blue-700">Est. impact: {currency.format(Math.round(item.estimatedImpact))} / month</p>}
                  </div>
                ))}
                {attentionCandidates.length > 3 && <button type="button" onClick={() => setShowAllAttention((value) => !value)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">{showAllAttention ? "Show top 3" : `Show all ${attentionCandidates.length}`}</button>}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">Balance-sheet ratios all look healthy for the latest synced period.</p>
            )}
          </section>

          <section className="mt-8" aria-labelledby="kpi-heading">
            <p id="kpi-heading" className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">KEY PERFORMANCE INDICATORS</p>
            <p className="mt-1 text-xs text-slate-500">Tap a card to view its trend and breakdown.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => {
                const isSelected = activeMetricKey === metric.key;
                return (
                  <button key={metric.key} type="button" onClick={() => setActiveMetricKey(metric.key)} aria-pressed={isSelected} className={`relative min-h-[132px] w-full rounded-2xl border p-5 text-left shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${isSelected ? "border-blue-400 bg-blue-50/70 shadow-md shadow-blue-900/10" : "border-slate-200 bg-white opacity-70 hover:opacity-100 hover:border-blue-200 hover:shadow-md"}`}>
                    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${metric.signal}`} /><p className="text-xs font-medium text-slate-500 sm:text-sm">{metric.label}</p></div>{isSelected && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">Selected</span>}</div>
                    <p className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{metric.value}</p>
                    {metric.key === "cash" && metric.cashAsOfDate && <p className="mt-1 text-[10px] font-medium text-slate-400">{`as of ${metric.cashAsOfDate}`}</p>}
                    {metric.key === "cash" && metric.liveCashNote && <p className="mt-1 text-[10px] font-medium text-slate-400">{metric.liveCashNote}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold sm:text-sm">
                      <span className={metric.tone}>{displayChange(metric.change, metric.key, metric.key === "inventory" ? data.inventory : undefined)}</span>
                      <span className="font-normal text-slate-400">vs. prior period</span>
                    </div>
                    {metric.key === "margin" && (marginBaseline || zeroCogsNote) && <p className="mt-2 text-[10px] leading-4 text-amber-700">No COGS recorded in QuickBooks — 100% is a reported accounting margin, not necessarily economic gross margin.</p>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7" aria-labelledby="trend-heading">
            <div className="flex items-start justify-between gap-4"><div><p id="trend-heading" className="text-sm font-semibold text-slate-900">{activeMetric.name} trend</p><p className="mt-1 text-xs text-slate-500">Trailing {trendValues.length} periods</p></div><div className="text-right"><p className={`text-sm font-bold ${Number.isFinite(trendChange) ? trendChange >= 0 ? "text-emerald-600" : "text-red-600" : "text-slate-500"}`}>{displayChange(trendChange, activeMetricKey, activeMetricDefinition.current)}</p><p className="text-xs text-slate-400">latest trend</p></div></div>
            <div className="relative mt-5 h-60 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60">
              {trendValues.length ? (
                <>
                  <div className="pointer-events-none absolute left-2 top-2 bottom-8 flex flex-col justify-between text-[10px] font-medium text-slate-400">
                    <span>{formatTrendValue(activeMetricKey, Math.max(...trendValues))}</span>
                    <span>{formatTrendValue(activeMetricKey, (Math.min(...trendValues) + Math.max(...trendValues)) / 2)}</span>
                    <span>{formatTrendValue(activeMetricKey, Math.min(...trendValues))}</span>
                  </div>
                  <div className="h-full pl-14">
                    <svg viewBox="0 0 720 220" className="h-full w-full" role="img" aria-label={`${activeMetric.name} trend over available periods`} preserveAspectRatio="none">
                      <line x1="18" y1="22" x2="702" y2="22" stroke="currentColor" className="text-slate-200" strokeWidth="1" /><line x1="18" y1="106" x2="702" y2="106" stroke="currentColor" className="text-slate-200" strokeWidth="1" /><line x1="18" y1="190" x2="702" y2="190" stroke="currentColor" className="text-slate-200" strokeWidth="1" />
                      {trendPolyline && <polyline points={trendPolyline} fill="none" stroke="currentColor" className={activeMetricKey === "cash" ? "text-emerald-600" : activeMetricKey === "inventory" ? "text-violet-600" : activeMetricKey === "margin" ? "text-indigo-600" : "text-blue-600"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                      {trendPoints.map((point, index) => <circle key={`${trendPeriods[index] || index}-${index}`} cx={point.x} cy={point.y} r="4" fill="currentColor" className={activeMetricKey === "cash" ? "text-emerald-600" : activeMetricKey === "inventory" ? "text-violet-600" : activeMetricKey === "margin" ? "text-indigo-600" : "text-blue-600"}><title>{`${trendPeriods[index] || "Period"}: ${formatTrendValue(activeMetricKey, point.value)}`}</title></circle>)}
                    </svg>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <p className="max-w-md text-sm leading-6 text-slate-500">No {activeMetric.name} trend available — connect QuickBooks or upload a file with balance-sheet data.</p>
                </div>
              )}
            </div>
            <div className="mt-2 grid grid-cols-4 text-[10px] font-medium text-slate-400">{trendLabelIndices.map((index) => <span key={`${trendPeriods[index] || index}-${index}`} className={index === trendLabelIndices[trendLabelIndices.length - 1] ? "text-right" : index === 0 ? "text-left" : "text-center"}>{trendPeriods[index] || (index === 0 ? "Prior" : "Current")}</span>)}</div>
            <KpiDrilldown breakdown={data.kpiBreakdowns?.[activeMetricKey]} />
          </section>

          {mtd && <section className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4" aria-label="Month to date">
            <p className="text-sm font-semibold text-slate-800">{mtd.currentLabel} so far — revenue {currency.format(mtd.revenue.current)}, expenses {currency.format(mtd.operatingExpense.current)}, net income {currency.format(mtd.netIncome.current)}.</p>
            {mtd.revenue.current === 0 && mtd.operatingExpense.current === 0 && mtd.netIncome.current === 0 && <p className="mt-1 text-xs text-slate-500">{new Date().getDate()} days in, nothing posted yet — {data.periods[data.periods.length - 1] || "the latest complete month"} is the latest complete month above.</p>}
          </section>}

          {data.cashFlow && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="cash-flow-heading">
            <p id="cash-flow-heading" className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">CASH FLOW</p>
            <p className="mt-1 text-xs text-slate-500">From net income to cash: working-capital changes for the latest period.</p>
            <div className="mt-4 space-y-2">
              {[...data.cashFlow.lines].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 5).map((line) => <div key={line.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"><p className="text-sm font-medium text-slate-800">{line.label}</p><p className={line.value >= 0 ? "text-sm font-bold text-emerald-600" : "text-sm font-bold text-red-600"}>{line.value >= 0 ? "+" : "−"}{currency.format(Math.abs(Math.round(line.value)))}</p></div>)}
              <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-600 px-3 py-2.5"><p className="text-sm font-bold text-white">Net cash from operations</p><p className="text-sm font-bold text-white">{data.cashFlow.operatingCashFlow >= 0 ? "+" : "−"}{currency.format(Math.abs(Math.round(data.cashFlow.operatingCashFlow)))}</p></div>
            </div>
            {data.cashFlow.cashChange !== null && <p className="mt-3 text-xs text-slate-500">Reported change in cash: {data.cashFlow.cashChange >= 0 ? "+" : "−"}{currency.format(Math.abs(Math.round(data.cashFlow.cashChange)))}.</p>}
          </section>}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6" aria-labelledby="questions-heading">
            <p id="questions-heading" className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">MANAGEMENT QUESTIONS</p>
            <p className="mt-1 text-xs text-slate-500">{liveSource === "upload" ? "Questions generated from your uploaded financial data." : "Questions generated from the financial data ClearCFO received from QuickBooks."}</p>
            <div className="mt-4 space-y-3">{(data.managementQuestions?.length ? data.managementQuestions : deterministicManagementQuestions).map((item, index) => <div key={`mq-${item.category}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"><span className="font-semibold text-slate-900">{item.category}:</span> {item.question}</div>)}</div>
          </section>

          <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">AI Analysis</p><h3 className="mt-2 text-xl font-bold text-slate-900">Turn the signals into a decision.</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{deterministicAnalysis}</p></div>
            <a href="/customer/analysis" className="self-start rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700">View AI Analysis →</a>
          </section>
        </div>
      </div>
    </div>
  );
}
