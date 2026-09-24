// Client-side helpers that keep every QuickBooks localStorage cache scoped
// to the business that produced it. The sync writes the owning company id to
// QB_CACHE_COMPANY_KEY; every reader must verify ownership before trusting
// the cache, otherwise one business's numbers can render under another.

export const QB_CACHE_COMPANY_KEY = "clearcfo_qb_cache_company_id";

const QB_CACHE_KEYS = [
  "clearcfo_qb_briefing_cache",
  "clearcfo_qb_last_synced_at",
  "clearcfo_qb_diagnostics",
  "clearcfo_qb_ai_analysis_cache",
  "clearcfo_qb_ai_analysis_cache_signature",
  "clearcfo_analysis_input",
  "clearcfo_ai_analysis_cache_v2",
  "clearcfo_qb_initial_sync",
  QB_CACHE_COMPANY_KEY,
];

export function getCachedCompanyId(): string | null {
  try {
    return window.localStorage.getItem(QB_CACHE_COMPANY_KEY);
  } catch {
    return null;
  }
}

export function evictQuickBooksCache(): void {
  try {
    for (const key of QB_CACHE_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable; nothing to evict.
  }
}

export function stampQuickBooksCacheCompany(companyId: string | null | undefined): void {
  try {
    if (companyId) window.localStorage.setItem(QB_CACHE_COMPANY_KEY, companyId);
    else window.localStorage.removeItem(QB_CACHE_COMPANY_KEY);
  } catch {
    // Keep the sync usable if browser storage is unavailable.
  }
}

/**
 * Returns true when the local QuickBooks caches may be used for the given
 * active company. Ownership can only be disproven when BOTH ids are known
 * and differ; when either is unknown we keep the legacy behavior so the
 * offline stale-cache fallback keeps working. A definite mismatch evicts
 * the other business's caches and returns false.
 */
export function saveQuickBooksBriefingCache(briefing: unknown, companyId: string | null | undefined): void {
  try {
    window.localStorage.setItem("clearcfo_qb_briefing_cache", JSON.stringify(briefing));
  } catch {
    return;
  }
  stampQuickBooksCacheCompany(companyId);
  try {
    window.localStorage.removeItem("clearcfo_qb_ai_analysis_cache");
    window.localStorage.removeItem("clearcfo_qb_ai_analysis_cache_signature");
  } catch {
    // Keep the sync usable if browser storage is unavailable.
  }
}

/**
 * A verified business may only consume a cache carrying the same company
 * stamp. Unlabeled or mismatched data is evicted. If the business cannot be
 * verified, only a provably offline browser may use the cache.
 */
export function isQuickBooksCacheUsable(activeCompanyId: string | null | undefined): boolean {
  const cachedCompanyId = getCachedCompanyId();
  if (activeCompanyId) {
    if (cachedCompanyId !== activeCompanyId) {
      evictQuickBooksCache();
      return false;
    }
    return true;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return false;
}

let activeCompanyIdPromise: Promise<string | null> | null = null;

/**
 * Resolves the active business id from the server, memoized per page load
 * so every component on the page shares a single request.
 */
export function getActiveCompanyId(): Promise<string | null> {
  if (!activeCompanyIdPromise) {
    activeCompanyIdPromise = fetch("/api/quickbooks/status", { cache: "no-store" })
      .then((response) => response.json().catch(() => null))
      .then((payload) => payload?.activeCompanyId || payload?.connection?.companyId || null)
      .catch(() => null);
  }
  return activeCompanyIdPromise;
}
