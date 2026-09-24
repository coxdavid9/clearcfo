// ClearCFO alert rules engine — Step 4 (Pro "comes to you" bundle).
//
// Pure, deterministic evaluation: given a computed briefing snapshot and the
// company's alert rules, return the alerts worth sending. No I/O, no dates,
// no randomness — safe to run in CI scenario tests and in cron jobs.
//
// The snapshot type is structural: BriefingData satisfies it, so callers pass
// the briefing straight in.

export type AlertMetric =
  | "cash"
  | "grossMargin"
  | "revenue"
  | "operatingExpense"
  | "inventory";

export type AlertOperator = "below" | "above";

export type AlertSeverity = "high" | "medium" | "watch";

export type AlertRule = {
  id: string;
  metric: AlertMetric;
  operator: AlertOperator;
  value: number;
  severity: AlertSeverity;
  enabled: boolean;
};

export type BriefingSnapshot = {
  revenue: number;
  revenueChange: number;
  grossMargin: number;
  marginChange: number;
  cash: number;
  cashChange: number;
  inventory: number;
  inventoryChange: number;
  operatingExpense?: number;
  previousOperatingExpense?: number;
  drivers?: Array<{
    id: string;
    title: string;
    severity: "High" | "Medium" | "Watch";
    impact: number;
    observation: string;
  }>;
};

export type Alert = {
  key: string;
  ruleId: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  estimatedImpact: number;
  metric: AlertMetric;
};

const MATERIALITY_FLOOR = 250;
const MAX_ALERTS = 5;

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  high: 0,
  medium: 1,
  watch: 2,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function metricValue(snapshot: BriefingSnapshot, metric: AlertMetric): number | null {
  switch (metric) {
    case "cash":
      return isFiniteNumber(snapshot.cash) ? snapshot.cash : null;
    case "grossMargin":
      return isFiniteNumber(snapshot.grossMargin) ? snapshot.grossMargin : null;
    case "revenue":
      return isFiniteNumber(snapshot.revenue) ? snapshot.revenue : null;
    case "operatingExpense":
      return isFiniteNumber(snapshot.operatingExpense) ? snapshot.operatingExpense : null;
    case "inventory":
      return isFiniteNumber(snapshot.inventory) ? snapshot.inventory : null;
  }
}

function formatMoney(value: number): string {
  const rounded = Math.round(Math.abs(value));
  return "$" + rounded.toLocaleString("en-US");
}

function formatPoints(value: number): string {
  return `${Math.abs(value).toFixed(1)} pts`;
}

type BuiltinHit = {
  severity: AlertSeverity;
  title: string;
  detail: string;
  estimatedImpact: number;
  metric: AlertMetric;
};

type BuiltinCheck = (snapshot: BriefingSnapshot) => BuiltinHit | null;

function marginDropCheck(snapshot: BriefingSnapshot): BuiltinHit | null {
  const change = snapshot.marginChange;
  if (!isFiniteNumber(change) || change > -1.5) return null;
  const severity: AlertSeverity = change <= -3 ? "high" : "medium";
  const impact = isFiniteNumber(snapshot.revenue)
    ? Math.abs(snapshot.revenue * (change / 100))
    : 0;
  return {
    severity,
    title: `Gross margin dropped ${formatPoints(change)}`,
    detail:
      `Gross margin fell ${formatPoints(change)} vs the prior period` +
      (isFiniteNumber(snapshot.grossMargin) ? `, to ${snapshot.grossMargin.toFixed(1)}%.` : "."),
    estimatedImpact: impact,
    metric: "grossMargin",
  };
}

function cashDeclineCheck(snapshot: BriefingSnapshot): BuiltinHit | null {
  const change = snapshot.cashChange;
  if (!isFiniteNumber(change) || change > -10) return null;
  const severity: AlertSeverity = change <= -20 ? "high" : "medium";
  const impact =
    isFiniteNumber(snapshot.cash) ? Math.abs(snapshot.cash * (change / 100)) : 0;
  return {
    severity,
    title: `Cash down ${Math.abs(change).toFixed(1)}%`,
    detail: `Cash declined ${Math.abs(change).toFixed(1)}% vs the prior period.`,
    estimatedImpact: impact,
    metric: "cash",
  };
}

function revenueDeclineCheck(snapshot: BriefingSnapshot): BuiltinHit | null {
  const change = snapshot.revenueChange;
  if (!isFiniteNumber(change) || change > -5) return null;
  const severity: AlertSeverity = change <= -10 ? "high" : "medium";
  const impact = isFiniteNumber(snapshot.revenue)
    ? Math.abs(snapshot.revenue * (change / 100))
    : 0;
  return {
    severity,
    title: `Revenue down ${Math.abs(change).toFixed(1)}%`,
    detail: `Revenue declined ${Math.abs(change).toFixed(1)}% vs the prior period.`,
    estimatedImpact: impact,
    metric: "revenue",
  };
}

function opexOutpacingCheck(snapshot: BriefingSnapshot): BuiltinHit | null {
  const current = snapshot.operatingExpense;
  const previous = snapshot.previousOperatingExpense;
  if (!isFiniteNumber(current) || !isFiniteNumber(previous) || previous <= 0) return null;
  if (!isFiniteNumber(snapshot.revenueChange)) return null;
  const opexGrowth = ((current - previous) / previous) * 100;
  const gap = opexGrowth - snapshot.revenueChange;
  if (gap < 10) return null;
  return {
    severity: "medium",
    title: "Spending is outpacing revenue",
    detail:
      `Operating expenses grew ${opexGrowth.toFixed(1)}% while revenue ` +
      `${snapshot.revenueChange >= 0 ? "grew" : "changed"} ${snapshot.revenueChange.toFixed(1)}% — a ${gap.toFixed(1)} point gap.`,
    estimatedImpact: Math.abs(current - previous),
    metric: "operatingExpense",
  };
}

function inventoryOutpacingCheck(snapshot: BriefingSnapshot): BuiltinHit | null {
  if (!isFiniteNumber(snapshot.inventory) || snapshot.inventory <= 0) return null;
  if (!isFiniteNumber(snapshot.inventoryChange) || !isFiniteNumber(snapshot.revenueChange))
    return null;
  const gap = snapshot.inventoryChange - snapshot.revenueChange;
  if (gap < 15) return null;
  const previousInventory = snapshot.inventory / (1 + snapshot.inventoryChange / 100);
  if (!isFiniteNumber(previousInventory)) return null;
  return {
    severity: "medium",
    title: "Inventory is outpacing revenue",
    detail:
      `Inventory grew ${snapshot.inventoryChange.toFixed(1)}% while revenue ` +
      `${snapshot.revenueChange >= 0 ? "grew" : "changed"} ${snapshot.revenueChange.toFixed(1)}% — cash is getting tied up in stock.`,
    estimatedImpact: Math.abs(snapshot.inventory - previousInventory),
    metric: "inventory",
  };
}

function topDriverCheck(snapshot: BriefingSnapshot): BuiltinHit | null {
  const driver = (snapshot.drivers || []).find(
    (d) => d.severity === "High" && isFiniteNumber(d.impact) && d.impact >= 1000,
  );
  if (!driver) return null;
  return {
    severity: "medium",
    title: `Cost driver: ${driver.title}`,
    detail: driver.observation,
    estimatedImpact: Math.abs(driver.impact),
    metric: "operatingExpense",
  };
}

const BUILTIN_CHECKS: Array<{ id: string; check: BuiltinCheck }> = [
  { id: "margin-drop", check: marginDropCheck },
  { id: "cash-decline", check: cashDeclineCheck },
  { id: "revenue-decline", check: revenueDeclineCheck },
  { id: "opex-outpacing", check: opexOutpacingCheck },
  { id: "inventory-outpacing", check: inventoryOutpacingCheck },
  { id: "top-driver", check: topDriverCheck },
];

function evaluateCustomRule(rule: AlertRule, snapshot: BriefingSnapshot): Alert | null {
  if (!rule.enabled) return null;
  if (!isFiniteNumber(rule.value)) return null;
  const current = metricValue(snapshot, rule.metric);
  if (current === null) return null;
  const tripped = rule.operator === "below" ? current < rule.value : current > rule.value;
  if (!tripped) return null;

  const thresholdLabel =
    rule.metric === "grossMargin"
      ? `${rule.value.toFixed(1)}% margin`
      : formatMoney(rule.value);
  const currentLabel =
    rule.metric === "grossMargin" ? `${current.toFixed(1)}%` : formatMoney(current);
  const direction = rule.operator === "below" ? "fell below" : "rose above";

  let estimatedImpact: number;
  if (rule.metric === "grossMargin" && isFiniteNumber(snapshot.revenue)) {
    estimatedImpact = Math.abs(snapshot.revenue * ((current - rule.value) / 100));
  } else {
    estimatedImpact = Math.abs(current - rule.value);
  }

  return {
    key: `custom:${rule.id}`,
    ruleId: rule.id,
    severity: rule.severity,
    title: `${metricLabel(rule.metric)} ${direction} ${thresholdLabel}`,
    detail: `${metricLabel(rule.metric)} is ${currentLabel} — ${direction} your ${thresholdLabel} threshold.`,
    estimatedImpact,
    metric: rule.metric,
  };
}

function metricLabel(metric: AlertMetric): string {
  switch (metric) {
    case "cash":
      return "Cash";
    case "grossMargin":
      return "Gross margin";
    case "revenue":
      return "Revenue";
    case "operatingExpense":
      return "Operating expenses";
    case "inventory":
      return "Inventory";
  }
}

export function evaluateAlerts(
  snapshot: BriefingSnapshot,
  rules: AlertRule[] = [],
): Alert[] {
  const alerts: Alert[] = [];

  for (const { id, check } of BUILTIN_CHECKS) {
    const hit = check(snapshot);
    if (!hit) continue;
    if (hit.estimatedImpact < MATERIALITY_FLOOR) continue;
    alerts.push({
      key: `builtin:${id}:${hit.severity}`,
      ruleId: `builtin:${id}`,
      severity: hit.severity,
      title: hit.title,
      detail: hit.detail,
      estimatedImpact: hit.estimatedImpact,
      metric: hit.metric,
    });
  }

  for (const rule of rules) {
    const alert = evaluateCustomRule(rule, snapshot);
    if (alert) alerts.push(alert);
  }

  alerts.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.estimatedImpact - a.estimatedImpact,
  );

  return alerts.slice(0, MAX_ALERTS);
}
