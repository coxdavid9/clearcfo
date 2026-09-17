"use client";

import { ReactNode, useEffect, useState } from "react";

const CACHE_KEY = "clearcfo_qb_briefing_cache";
const SYNC_KEY = "clearcfo_qb_last_synced_at";
const DIAGNOSTICS_KEY = "clearcfo_qb_diagnostics";

export default function QuickBooksBriefingGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refreshBeforeReveal = async () => {
      try {
        const statusResponse = await fetch("/api/quickbooks/status", { cache: "no-store" });
        const statusPayload = await statusResponse.json();

        if (statusResponse.ok && statusPayload?.connection?.connected) {
          const response = await fetch("/api/quickbooks/sync", { cache: "no-store" });
          const payload = await response.json();

          if (response.ok && payload?.briefing) {
            window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload.briefing));
            if (payload.diagnostics) window.localStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(payload.diagnostics));
            if (payload.syncedAt) window.localStorage.setItem(SYNC_KEY, payload.syncedAt);
          }
        }
      } catch {
        // CFOBriefing will use its normal cached fallback if the live refresh fails.
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void refreshBeforeReveal();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <section className="mx-auto mt-8 w-full max-w-6xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 animate-pulse rounded-full bg-blue-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Loading your QuickBooks financial data…</p>
            <p className="mt-1 text-xs text-slate-500">ClearCFO is refreshing the connected company before showing the briefing.</p>
          </div>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
