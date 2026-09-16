"use client";

import { useInsertionEffect } from "react";

const CACHE_KEY = "clearcfo_qb_briefing_cache";
const DIAGNOSTICS_KEY = "clearcfo_qb_diagnostics";
const SYNC_KEY = "clearcfo_qb_last_synced_at";
const MANUAL_KEY = "clearcfo_manual_qb_sync";
const TREND_VERSION_KEY = "clearcfo_qb_trend_series_v4";

function normalizeBriefing(briefing: any) {
  const revenueSeries = Array.isArray(briefing?.trendSeries)
    ? briefing.trendSeries.find((series: any) => series?.name === "Revenue")
    : null;
  if (revenueSeries?.values?.length) {
    return {
      ...briefing,
      trend: Array.isArray(briefing.trend) && briefing.trend.length ? briefing.trend : revenueSeries.values,
      periods: Array.isArray(briefing.periods) && briefing.periods.length ? briefing.periods : revenueSeries.periods,
    };
  }
  return briefing;
}

export default function QuickBooksBriefingCache() {
  useInsertionEffect(() => {
    if (window.localStorage.getItem(TREND_VERSION_KEY) !== "1") {
      window.localStorage.removeItem(CACHE_KEY);
      window.localStorage.removeItem(DIAGNOSTICS_KEY);
      window.localStorage.removeItem(SYNC_KEY);
      window.localStorage.setItem(TREND_VERSION_KEY, "1");
    }

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const isSyncRequest = url.includes("/api/quickbooks/sync");
      const manualSync = window.sessionStorage.getItem(MANUAL_KEY) === "true";

      if (!isSyncRequest || manualSync) return originalFetch(input, init);

      const cachedBriefing = window.localStorage.getItem(CACHE_KEY);
      const cachedDiagnostics = window.localStorage.getItem(DIAGNOSTICS_KEY);
      const cachedSyncedAt = window.localStorage.getItem(SYNC_KEY);
      if (!cachedBriefing) {
        const response = await originalFetch(input, init);
        if (!response.ok) return response;
        try {
          const payload = await response.clone().json();
          if (!payload?.briefing) return response;
          const briefing = normalizeBriefing(payload.briefing);
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(briefing));
          if (payload.diagnostics) window.localStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(payload.diagnostics));
          if (payload.syncedAt) window.localStorage.setItem(SYNC_KEY, payload.syncedAt);
          return new Response(JSON.stringify({ ...payload, briefing }), {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return response;
        }
      }

      const briefing = normalizeBriefing(JSON.parse(cachedBriefing));
      return new Response(JSON.stringify({
        ok: true,
        source: "quickbooks",
        cached: true,
        syncedAt: cachedSyncedAt || new Date().toISOString(),
        briefing,
        diagnostics: cachedDiagnostics ? JSON.parse(cachedDiagnostics) : null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    return () => { window.fetch = originalFetch; };
  }, []);

  return null;
}
