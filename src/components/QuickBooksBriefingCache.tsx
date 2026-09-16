"use client";

import { useInsertionEffect } from "react";

const CACHE_KEY = "clearcfo_qb_briefing_cache";
const SYNC_KEY = "clearcfo_qb_last_synced_at";
const MANUAL_KEY = "clearcfo_manual_qb_sync";
const TREND_VERSION_KEY = "clearcfo_qb_trend_series_v2";

export default function QuickBooksBriefingCache() {
  useInsertionEffect(() => {
    // Existing caches were created before the dashboard stored all four KPI
    // trend series. Clear that snapshot once so the next sync hydrates the
    // dashboard with the new monthly history.
    if (window.localStorage.getItem(TREND_VERSION_KEY) !== "1") {
      window.localStorage.removeItem(CACHE_KEY);
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
      const cachedSyncedAt = window.localStorage.getItem(SYNC_KEY);
      if (!cachedBriefing) {
        const response = await originalFetch(input, init);
        if (response.ok) {
          try {
            const payload = await response.clone().json();
            if (payload?.briefing) {
              window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload.briefing));
              if (payload.syncedAt) window.localStorage.setItem(SYNC_KEY, payload.syncedAt);
            }
          } catch {
            // Let the original response continue to the caller.
          }
        }
        return response;
      }

      return new Response(JSON.stringify({
        ok: true,
        source: "quickbooks",
        cached: true,
        syncedAt: cachedSyncedAt || new Date().toISOString(),
        briefing: JSON.parse(cachedBriefing),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    return () => { window.fetch = originalFetch; };
  }, []);

  return null;
}
