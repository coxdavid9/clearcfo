"use client";

import { ReactNode, useEffect, useState } from "react";

const SYNC_KEY = "clearcfo_qb_last_synced_at";
const CACHE_KEY = "clearcfo_qb_briefing_cache";

export default function QuickBooksBriefingGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const initialSync = window.localStorage.getItem(SYNC_KEY);
    const startedAt = Date.now();

    const check = () => {
      if (cancelled) return;
      const currentSync = window.localStorage.getItem(SYNC_KEY);
      const currentCache = window.localStorage.getItem(CACHE_KEY);
      const hasFreshSync = Boolean(currentSync && currentSync !== initialSync);
      const timedOut = Date.now() - startedAt >= 15000;

      if (hasFreshSync || (!initialSync && currentCache) || timedOut) {
        setReady(true);
        return;
      }

      window.setTimeout(check, 150);
    };

    check();
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
