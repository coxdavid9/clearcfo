export type TrialTerms = { trialDays: number; cardRequired: boolean; code: string };
export const INVALID_PROMO = "That code is no longer valid. Remove it to continue with the standard trial.";
async function db(path: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ""), key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  const response = await fetch(url + "/rest/v1/" + path, { ...init, headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", ...init.headers }, cache: "no-store" });
  if (!response.ok) throw new Error("Promo storage unavailable.");
  return response;
}
export async function validatePromo(value: unknown, userId: string): Promise<TrialTerms | null> {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) return null;
  const codes = await (await db("promo_codes?code=eq." + encodeURIComponent(code) + "&select=*")).json();
  const row = codes[0];
  if (!row || !row.active || (row.expires_at && !(Date.parse(row.expires_at) > Date.now()))) return null;
  const redemptions = await (await db("promo_redemptions?code=eq." + encodeURIComponent(code) + "&select=user_id,status,created_at")).json() as Array<{user_id:string;status:string;created_at:string}>;
  const live = redemptions.filter(r => r.status === "completed" || (r.status === "pending" && Date.parse(r.created_at) > Date.now() - 86400000));
  if (live.some(r => r.user_id === userId && r.status === "completed")) return null;
  if (!live.some(r => r.user_id === userId && r.status === "pending") && row.max_redemptions != null && live.length >= row.max_redemptions) return null;
  if (!Number.isInteger(row.trial_days) || row.trial_days < 1 || row.trial_days > 90) return null;
  return { code, trialDays: row.trial_days, cardRequired: row.card_required !== false };
}
export function promoFields(metadata?: Record<string,string>) {
  return metadata?.promo_code ? { promo_code: metadata.promo_code, trial_card_required: metadata.card_required !== "false" } : {};
}
export async function claimPromoCode(code: string, userId: string): Promise<boolean> {
  const response = await db("rpc/claim_promo_code", { method: "POST", body: JSON.stringify({ p_code: code, p_user_id: userId }) });
  return (await response.json()) === true;
}
export async function recordPromoRedemption(code: string, userId: string) {
  await db("promo_redemptions?on_conflict=code,user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ code, user_id: userId, status: "completed" }) });
}
export async function expirePromoClaim(code: string, userId: string) {
  await db("promo_redemptions?code=eq." + encodeURIComponent(code) + "&user_id=eq." + encodeURIComponent(userId) + "&status=eq.pending", { method: "PATCH", body: JSON.stringify({status:"expired"}) });
}
