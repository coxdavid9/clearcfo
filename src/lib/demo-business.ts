/**
 * Entirely fictional figures for a public, read-only product walkthrough.
 * Never load these values into authenticated customers' company context.
 */
export const DEMO_PERIODS = { prior: "August 2026", current: "September 2026" } as const;

export const DEMO_FINANCIALS = {
  revenue: { prior: 120000, current: 132000 },
  costOfGoodsSold: { prior: 78000, current: 92400 },
  cash: { prior: 58000, current: 42000 },
  inventory: { prior: 80000, current: 112000 },
  receivables: { prior: 46000, current: 61000 },
} as const;

export type DemoMoneyKey = keyof typeof DEMO_FINANCIALS;

export function moneyChange(key: DemoMoneyKey): number {
  const metric = DEMO_FINANCIALS[key];
  return metric.current - metric.prior;
}

export function percentChange(key: DemoMoneyKey): number {
  const metric = DEMO_FINANCIALS[key];
  return (100 * moneyChange(key)) / metric.prior;
}

export function grossMargin(period: keyof typeof DEMO_PERIODS): number {
  const revenue = DEMO_FINANCIALS.revenue[period];
  const cogs = DEMO_FINANCIALS.costOfGoodsSold[period];
  return (100 * (revenue - cogs)) / revenue;
}

export function demoCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(amount);
}

export function demoPercentage(n: number): string {
  return Math.abs(n).toFixed(1) + "%";
}
