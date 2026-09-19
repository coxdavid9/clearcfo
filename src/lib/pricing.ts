export const TRIAL_DAYS = 7;

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
  return `7-day free trial, then $${price}${suffix} unless cancelled.`;
}
