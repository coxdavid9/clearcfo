"use client";

import { useInsertionEffect } from "react";

const CACHE_KEY = "clearcfo_qb_briefing_cache";
const DIAGNOSTICS_KEY = "clearcfo_qb_diagnostics";
const SYNC_KEY = "clearcfo_qb_last_synced_at";
const TREND_VERSION_KEY = "clearcfo_qb_trend_series_v4";

// Maximum age of a cached briefing before it is treated as stale and evicted.
// The briefing page always attempts a live QuickBooks refresh first; the cache
// is only a fallback, so it must never be served indefinitely with a
// fabricated "just now" timestamp.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function evictCache() {
  window.localStorage.removeItem(CACHE_KEY);
  window.localStorage.removeItem(DIAGNOSTICS_KEY);
  window.localStorage.removeItem(SYNC_KEY);
}

export default function QuickBooksBriefingCache() {
  useInsertionEffect(() => {
    // Invalidate caches written by older trend-series formats.
    if (window.localStorage.getItem(TREND_VERSION_KEY) !== "1") {
      evictCache();
      window.localStorage.setItem(TREND_VERSION_KEY, "1");
      return;
    }

    // TTL: evict entries older than CACHE_TTL_MS so a very stale briefing
    // cannot be served silently as if current. A missing or unparseable
    // timestamp is treated as stale — freshness is never fabricated.
    // NOTE: the window.fetch monkey-patch was deliberately removed. Every
    // /api/quickbooks/sync request now reaches the network; the explicit
    // refresh-then-fallback logic in CFOBriefing's loadQuickBooksBriefing
    // (which also populates this cache on success, with a guarded JSON.parse
    // when reading) is the single cache owner.
    const syncedAt = window.localStorage.getItem(SYNC_KEY);
    const syncedTime = syncedAt ? new Date(syncedAt).getTime() : NaN;
    if (!Number.isFinite(syncedTime) || Date.now() - syncedTime > CACHE_TTL_MS) {
      evictCache();
    }
  }, []);

  return null;
}
