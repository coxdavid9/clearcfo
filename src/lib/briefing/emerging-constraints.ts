export type ConstraintStatus = "emerging" | "worsening" | "stable" | "easing" | "resolved";
export type ConstraintConfidence = "High" | "Medium";
export type ConstraintDataCompleteness = "complete" | "partial" | "insufficient";

export type EmergingConstraint = {
  id: "cash_squeeze";
  title: string;
  relationship: string;
  evidenceChecked: string[];
  whyNow: string;
  decisionWindow: string;
  confidence: ConstraintConfidence;
  dataCompleteness: ConstraintDataCompleteness;
  status: ConstraintStatus;
  statusDetail: string;
  strength: number;
  updatedAt: string;
};

type ReportRow = {
  label: string;
  values: number[];
  group: string;
  type: string;
};

type AgingCustomer = {
  customer: string;
  overdue30: number;
};

type AgingSnapshot = {
  customers: AgingCustomer[];
  overdue30: number;
};

type Validation = {
  passed: boolean;
  available: boolean;
  detail: string;
};

type CashSqueezeInput = {
  periods: string[];
  revenue: number[];
  cash: number[];
  profitAndLossDetail?: any;
  agedReceivables?: any;
  agedReceivablesPrevious?: any;
  cashFlowStatement?: any;
  previousConstraint?: EmergingConstraint | null;
  now?: string;
};

function toNumber(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[$,%(),]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function reportPeriods(report: any): string[] {
  return (report?.Columns?.Column || []).slice(1)
    .map((column: any) => String(column?.ColTitle || "").trim())
    .filter((title: string) => title && !/^total$/i.test(title));
}

function collectRows(node: any, output: ReportRow[] = []): ReportRow[] {
  if (!node) return output;
  if (Array.isArray(node)) {
    for (const item of node) collectRows(item, output);
    return output;
  }
  if (typeof node !== "object") return output;
  const cells = node.ColData || node.Summary?.ColData;
  if (Array.isArray(cells)) {
    output.push({
      label: String(cells[0]?.value || "").trim(),
      values: cells.slice(1).map((cell: any) => toNumber(cell?.value)),
      group: String(node.group || ""),
      type: String(node.type || ""),
    });
  }
  if (node.Rows) collectRows(node.Rows, output);
  if (Array.isArray(node.Row)) for (const row of node.Row) collectRows(row, output);
  return output;
}

function parseAging(report: any): AgingSnapshot | null {
  if (!report) return null;
  const normalized = report?.reportData?.rows;
  if (Array.isArray(normalized) && normalized.length) {
    const customers = normalized.map((row: any) => {
      const cells = row?.cells || row?.ColData || [];
      const get = (name: string) => {
        const cell = cells.find((item: any) => String(item?.name || "").trim().toLowerCase() === name.toLowerCase());
        return toNumber(cell?.value);
      };
      return {
        customer: String(cells.find((item: any) => String(item?.name || "").toLowerCase() === "customer")?.value || "").trim(),
        overdue30: get("31-60") + get("61-90") + get("91+"),
      };
    }).filter((row: AgingCustomer) => row.customer && row.overdue30 > 0);
    if (customers.length) {
      return { customers, overdue30: customers.reduce((sum, row) => sum + row.overdue30, 0) };
    }
  }

  const rawRows: any[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object") return;
    if (Array.isArray(node.ColData)) rawRows.push(node);
    if (node.Rows) walk(node.Rows);
    if (Array.isArray(node.Row)) node.Row.forEach(walk);
  };
  walk(report.Rows);

  const customerMap = new Map<string, number>();
  for (const row of rawRows) {
    const cells = row.ColData || [];
    const customer = String(cells[3]?.value || "").trim();
    const dueDate = String(cells[4]?.value || "").trim();
    const openBalance = toNumber(cells[6]?.value);
    if (!customer || openBalance <= 0) continue;
    const asOf = report.__asOfDate ? new Date(String(report.__asOfDate) + "T00:00:00Z") : null;
    const due = new Date(dueDate + "T00:00:00Z");
    if (!asOf || !Number.isFinite(asOf.getTime()) || !Number.isFinite(due.getTime())) continue;
    const daysOverdue = Math.floor((asOf.getTime() - due.getTime()) / 86400000);
    if (daysOverdue <= 30) continue;
    customerMap.set(customer, (customerMap.get(customer) || 0) + openBalance);
  }

  if (!customerMap.size) return null;
  const customers = Array.from(customerMap, ([customer, overdue30]) => ({ customer, overdue30 }));
  return { customers, overdue30: customers.reduce((sum, row) => sum + row.overdue30, 0) };
}

function agingBroadBased(current: AgingSnapshot, previous: AgingSnapshot): Validation {
  const previousByCustomer = new Map(previous.customers.map((row) => [row.customer, row.overdue30]));
  const increases = current.customers
    .map((row) => ({ customer: row.customer, change: row.overdue30 - (previousByCustomer.get(row.customer) || 0) }))
    .filter((row) => row.change > 0)
    .sort((a, b) => b.change - a.change);

  if (increases.length < 3) {
    return { passed: false, available: true, detail: "A/R deterioration is not broad-based across at least three customers." };
  }
  const totalIncrease = increases.reduce((sum, row) => sum + row.change, 0);
  const topShare = totalIncrease > 0 ? increases[0].change / totalIncrease : 1;
  if (topShare > 0.6) {
    return { passed: false, available: true, detail: "A/R deterioration is concentrated in one customer rather than broadly distributed." };
  }
  return { passed: true, available: true, detail: `A/R deterioration is broad-based across ${increases.length} customers; the largest customer's share of the increase is ${Math.round(topShare * 100)}%.` };
}

function payrollSeries(report: any): { periods: string[]; values: number[] } | null {
  if (!report) return null;
  const periods = reportPeriods(report);
  if (!periods.length) return null;
  const rows = collectRows(report.Rows).filter((row) => row.type !== "Section" && /payroll|wages?|salar(y|ies)|employee compensation|employee benefits/i.test(row.label));
  if (!rows.length) return null;
  return {
    periods,
    values: periods.map((_, index) => rows.reduce((sum, row) => sum + (row.values[index] || 0), 0)),
  };
}

function payrollRecurring(report: any): Validation {
  const series = payrollSeries(report);
  if (!series || series.values.length < 3) {
    return { passed: false, available: false, detail: "We could not determine whether the payroll increase was recurring." };
  }
  const n = series.values.length;
  const prior = series.values[n - 2] || 0;
  const current = series.values[n - 1] || 0;
  const twoBack = series.values[n - 3] || 0;
  const currentChange = prior === 0 ? Number.NaN : ((current - prior) / Math.abs(prior)) * 100;
  const priorChange = twoBack === 0 ? Number.NaN : ((prior - twoBack) / Math.abs(twoBack)) * 100;
  if (!Number.isFinite(currentChange) || !Number.isFinite(priorChange)) {
    return { passed: false, available: false, detail: "We could not determine whether the payroll increase was recurring because the prior payroll baseline is unavailable." };
  }
  if (currentChange < 5 || priorChange < 0) {
    return { passed: false, available: true, detail: "Payroll is not showing a recurring increase across the last two period changes." };
  }
  return { passed: true, available: true, detail: `Payroll increased ${currentChange.toFixed(1)}% in the latest period after a ${priorChange.toFixed(1)}% increase in the preceding period.` };
}

function offsettingFinancing(report: any): Validation {
  if (!report) {
    return { passed: false, available: false, detail: "We could not determine whether an offsetting financing inflow occurred." };
  }
  const periods = reportPeriods(report);
  const rows = collectRows(report.Rows);
  const latestIndex = periods.length ? periods.length - 1 : 0;
  const financingRows = rows.filter((row) =>
    /financingactivities|financing activities|loan proceeds|owner contribution|capital contribution|investor funding|proceeds from/i.test(`${clean(row.group)} ${clean(row.label)}`)
  );
  const financingInflow = financingRows.reduce((sum, row) => sum + Math.max(0, row.values[latestIndex] || 0), 0);
  if (financingInflow > 0) {
    return { passed: false, available: true, detail: `An offsetting financing inflow of $${Math.round(financingInflow).toLocaleString("en-US")} was detected.` };
  }
  return { passed: true, available: true, detail: "No positive financing inflow was detected in the latest cash-flow period." };
}

function pct(current: number, prior: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function strengthScore(revenueDrop: number, arIncrease: number, payrollIncrease: number): number {
  const revenueScore = Math.min(1, Math.max(0, revenueDrop / 25));
  const arScore = Math.min(1, Math.max(0, arIncrease / 50));
  const payrollScore = Math.min(1, Math.max(0, payrollIncrease / 20));
  return Number(((revenueScore + arScore + payrollScore) / 3).toFixed(3));
}

function statusFromStrength(previous: EmergingConstraint | null, currentStrength: number): { status: ConstraintStatus; detail: string } {
  if (!previous || previous.status === "resolved") {
    return { status: "emerging", detail: "First detected in this briefing." };
  }
  const delta = currentStrength - previous.strength;
  if (delta >= 0.1) return { status: "worsening", detail: `Pattern strength increased ${Math.round(delta * 100)} points since the last briefing.` };
  if (delta <= -0.1) return { status: "easing", detail: `Pattern strength decreased ${Math.round(Math.abs(delta) * 100)} points since the last briefing.` };
  return { status: "stable", detail: "Pattern strength is broadly unchanged since the last briefing." };
}

export function detectCashSqueeze(input: CashSqueezeInput): EmergingConstraint | null {
  const now = input.now || new Date().toISOString();
  const previous = input.previousConstraint || null;
  const revenue = input.revenue;
  const cash = input.cash;

  if (revenue.length < 3 || cash.length < 3 || !revenue.slice(-3).every(Number.isFinite) || !cash.slice(-3).every(Number.isFinite)) {
    if (previous && previous.status !== "resolved") {
      return { ...previous, status: "resolved", statusDetail: "The required trend data is no longer available, so the prior pattern cannot be confirmed.", updatedAt: now };
    }
    return null;
  }

  const revenueCurrent = revenue[revenue.length - 1];
  const revenueTwoBack = revenue[revenue.length - 3];
  const revenueDrop = pct(revenueCurrent, revenueTwoBack);
  if (revenueDrop === null || revenueDrop > -10) {
    if (previous && previous.status !== "resolved") return { ...previous, status: "resolved", statusDetail: "The revenue signal no longer meets the cash-squeeze threshold.", updatedAt: now };
    return null;
  }

  const currentAging = parseAging(input.agedReceivables);
  const previousAging = parseAging(input.agedReceivablesPrevious);
  const arChange = currentAging && previousAging ? pct(currentAging.overdue30, previousAging.overdue30) : null;
  const arSignal = arChange !== null && arChange >= 20;
  const arValidation = currentAging && previousAging
    ? agingBroadBased(currentAging, previousAging)
    : { passed: false, available: false, detail: "We could not determine whether the increase in overdue receivables was broad-based." };

  const payroll = payrollSeries(input.profitAndLossDetail);
  const payrollCurrent = payroll?.values[payroll.values.length - 1] ?? 0;
  const payrollPrevious = payroll?.values[payroll.values.length - 2] ?? 0;
  const payrollChange = pct(payrollCurrent, payrollPrevious);
  const payrollSignal = payrollChange !== null && payrollChange >= 5;
  const payrollValidation = payrollRecurring(input.profitAndLossDetail);
  const financingValidation = offsettingFinancing(input.cashFlowStatement);

  const requiredSignalsAvailable = revenueDrop !== null && arChange !== null && payrollChange !== null;
  const signalCount = [revenueDrop !== null && revenueDrop <= -10, arSignal, payrollSignal, cash[cash.length - 1] >= cash[cash.length - 2]].filter(Boolean).length;
  const allSignals = signalCount === 4;
  const validationChecks = [arValidation, payrollValidation, financingValidation];
  const validationFailed = validationChecks.some((check) => check.available && !check.passed);
  const validationIncomplete = validationChecks.some((check) => !check.available);
  const complete = requiredSignalsAvailable && arSignal && payrollSignal && arValidation.available && payrollValidation.available && financingValidation.available;
  const requiredChecksPassed = !validationFailed;

  if (!allSignals || validationFailed || !requiredChecksPassed) {
    if (previous && previous.status !== "resolved" && allSignals && validationFailed) {
      return { ...previous, status: "resolved", statusDetail: "A required disconfirming check failed, so the prior pattern is no longer carried forward.", updatedAt: now };
    }
    return null;
  }

  const confidence: ConstraintConfidence = complete && !validationIncomplete ? "High" : "Medium";
  const dataCompleteness: ConstraintDataCompleteness = complete && !validationIncomplete ? "complete" : "partial";
  const strength = strengthScore(Math.abs(revenueDrop), arChange, payrollChange);
  const lifecycle = statusFromStrength(previous, strength);

  const evidenceChecked = [
    arValidation.detail,
    payrollValidation.detail,
    financingValidation.detail,
    `Cash balance has not declined: $${Math.round(cash[cash.length - 2]).toLocaleString("en-US")} to $${Math.round(cash[cash.length - 1]).toLocaleString("en-US")}.`,
  ];

  return {
    id: "cash_squeeze",
    title: "Cash constraint may be forming",
    relationship: "Revenue is slowing while collections are taking longer and payroll is increasing. Cash is being squeezed from both sides before the cash balance has turned down.",
    evidenceChecked,
    whyNow: `Revenue is down ${Math.abs(revenueDrop).toFixed(1)}% over the last two periods, overdue A/R is up ${arChange.toFixed(1)}%, and payroll is up ${payrollChange.toFixed(1)}% while cash remains stable.`,
    decisionWindow: "Review collections and planned near-term cash commitments before the pressure reaches the operating cash balance.",
    confidence,
    dataCompleteness,
    status: lifecycle.status,
    statusDetail: lifecycle.detail,
    strength,
    updatedAt: now,
  };
}

export function resolveCashSqueeze(previous: EmergingConstraint | null, now = new Date().toISOString()): EmergingConstraint | null {
  if (!previous || previous.status === "resolved") return null;
  return {
    ...previous,
    status: "resolved",
    statusDetail: "The cash-squeeze pattern is no longer confirmed in the latest briefing.",
    updatedAt: now,
  };
}
