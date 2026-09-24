import { cookies } from "next/headers";
import { getAuthCookieNames, getSupabaseUser } from "../supabase-auth";

export type Plan = "core" | "pro";
export type BillingInterval = "month" | "year";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type Subscription = {
  user_id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null;
  plan: Plan; interval: BillingInterval; status: SubscriptionStatus;
  trial_ends_at: string | null; current_period_end: string | null;
  cancel_at_period_end: boolean; is_comp: boolean;
  trial_email_day0_sent_at: string | null; trial_email_day2_sent_at: string | null;
  trial_email_day5_sent_at: string | null; trial_email_day7_sent_at: string | null;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return { url, key };
}
async function sb(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  return fetch(url + "/rest/v1/" + path, { ...init, headers: { apikey:key, Authorization:"Bearer "+key, "Content-Type":"application/json", ...(init.headers||{}) }, cache:"no-store" });
}
export async function getSubscription(userId: string): Promise<Subscription|null> {
  const r=await sb("subscriptions?user_id=eq."+encodeURIComponent(userId)+"&select=*&limit=1");
  if(!r.ok) throw new Error("Could not read subscription.");
  const rows=await r.json() as Subscription[];
  return rows[0] || null;
}
export function hasAccess(sub: Subscription|null) {
  return !!sub && (sub.status==="trialing" || sub.status==="active" || sub.status==="past_due" || (sub.is_comp && sub.status==="active"));
}
export function isPro(sub: Subscription|null) { return hasAccess(sub) && sub?.plan==="pro"; }
export const BUSINESS_LIMIT={core:1,pro:5} as const;

export async function getCurrentUserId() {
  const c=await cookies(); const {AUTH_COOKIE}=getAuthCookieNames(); const token=c.get(AUTH_COOKIE)?.value;
  if(!token) return null; const user=await getSupabaseUser(token); return user?.id || null;
}
export async function requireBillingUser() {
  const userId=await getCurrentUserId(); if(!userId) throw new Error("Unauthorized"); return userId;
}
export async function ownerSubscription(companyId:string):Promise<Subscription|null>{
  const r=await sb("company_memberships?company_id=eq."+encodeURIComponent(companyId)+"&role=eq.owner&select=user_id&limit=1");
  if(!r.ok) throw new Error("Could not resolve business owner.");
  const rows=await r.json() as Array<{user_id:string}>; return rows[0]?.user_id ? getSubscription(rows[0].user_id) : null;
}
