/**
 * Record AI/Excel analysis only against the signed-in user's server-verified
 * active company. A company ID in the request body is never authorization.
 *
 * Older clients may omit companyId; we still stamp the active company.
 */
export function resolveVerifiedAnalysisCompanyId(
  activeCompanyId: string | null | undefined,
  requestedCompanyId: unknown,
): string | null {
  if (!activeCompanyId) return null;
  if (requestedCompanyId === undefined || requestedCompanyId === null || requestedCompanyId === "") {
    return activeCompanyId;
  }
  if (typeof requestedCompanyId !== "string" || requestedCompanyId.trim() !== activeCompanyId) {
    return null;
  }
  return activeCompanyId;
}
