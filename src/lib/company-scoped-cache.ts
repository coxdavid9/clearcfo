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
  "clearcfo_ai_analysis_cache_v3",
  "clearcfo_analysis_input_company_id",
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

/** Save a QuickBooks briefing with its business ownership stamp. */
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
    window.localStorage.removeItem("clearcfo_ai_analysis_cache_v3");
    window.localStorage.removeItem("clearcfo_ai_analysis_cache_v2");
  } catch {
    // Keep the sync usable if browser storage is unavailable.
  }
}

/**
 * A verified business may only consume a cache carrying the same company
 * stamp. Unlabeled or mismatched data is evicted. If the business cannot be
 * verified, the cache cannot be used.
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
      .then((response) => response.ok ? response.json().catch(() => null) : null)
      .then((payload) => payload?.activeCompanyId || payload?.connection?.companyId || null)
      .catch(() => null);
  }
  return activeCompanyIdPromise;
}

const EXCEL_CACHE_COMPANY_KEY = "clearcfo_excel_cache_company_id";
const ANALYSIS_INPUT_COMPANY_KEY = "clearcfo_analysis_input_company_id";

function ownedCache(companyId: string | null | undefined, stampKey: string, keys: string[]): boolean {
  try {
    if (companyId && window.localStorage.getItem(stampKey) === companyId) return true;
    for (const key of [...keys, stampKey]) window.localStorage.removeItem(key);
  } catch { /* Unavailable storage cannot verify ownership. */ }
  return false;
}

export function isExcelCacheUsable(companyId: string | null | undefined): boolean {
  return ownedCache(companyId, EXCEL_CACHE_COMPANY_KEY, ["clearcfo_excel_briefing", "clearcfo_excel_uploaded_at"]);
}

export function isAnalysisInputUsable(companyId: string | null | undefined): boolean {
  return ownedCache(companyId, ANALYSIS_INPUT_COMPANY_KEY, ["clearcfo_analysis_input", "clearcfo_ai_analysis_cache_v2", "clearcfo_ai_analysis_cache_v3"]);
}

export function saveExcelBriefingCache(briefing: unknown, uploadedAt: string, companyId: string): void {
  try {
    // Invalidate first so a partial write cannot attribute old data to a new business.
    window.localStorage.removeItem(EXCEL_CACHE_COMPANY_KEY);
    window.localStorage.setItem("clearcfo_excel_briefing", JSON.stringify(briefing));
    window.localStorage.setItem("clearcfo_excel_uploaded_at", uploadedAt);
    window.localStorage.setItem(EXCEL_CACHE_COMPANY_KEY, companyId);
  } catch { /* In-session upload remains usable. */ }
}

export function saveAnalysisInput(briefing: unknown, companyId: string | null | undefined): void {
  try {
    window.localStorage.removeItem(ANALYSIS_INPUT_COMPANY_KEY);
    if (!companyId) {
      isAnalysisInputUsable(null);
      return;
    }
    window.localStorage.setItem("clearcfo_analysis_input", JSON.stringify(briefing));
    window.localStorage.setItem(ANALYSIS_INPUT_COMPANY_KEY, companyId);
  } catch { /* In-session briefing remains usable. */ }
}
