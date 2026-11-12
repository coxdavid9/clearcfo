export const TRIAL_DAYS = 7;
export const PROMO_TRIAL_DAYS = 30;
const PROMO_START_MS = Date.parse("2026-11-25T06:00:00.000Z");
const PROMO_END_MS = Date.parse("2026-12-01T06:00:00.000Z");
export function currentTrialDays(now: Date = new Date()): number {
 const t = now.getTime();
 return t >= PROMO_START_MS && t < PROMO_END_MS ? PROMO_TRIAL_DAYS : TRIAL_DAYS;
}

export const PLANS = {
  core: {
    key: "core",
    name: "Core",
    monthlyPrice: 39,
    annualPrice: 390,
    annualSavingsPercent: 17,
    maxBusinesses: 1,
  },
  pro: {
    key: "pro",
    name: "Pro",
    monthlyPrice: 79,
    annualPrice: 790,
    annualSavingsPercent: 17,
    maxBusinesses: 5,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
export type BillingInterval = "month" | "year";

export function getPlanPrice(plan: PlanKey, interval: BillingInterval) {
  return interval === "year" ? PLANS[plan].annualPrice : PLANS[plan].monthlyPrice;
}

export function getMaxBusinesses(plan: PlanKey) {
  return PLANS[plan].maxBusinesses;
}

export function getTrialDisclosure(plan: PlanKey, interval: BillingInterval) {
  const price = getPlanPrice(plan, interval);
  const suffix = interval === "year" ? "/year" : "/month";
  return `${currentTrialDays()}-day free trial, then $${price}${suffix} unless cancelled.`;
}
