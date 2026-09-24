import type { BriefingData, FinancialDriver, FinancialRatio, CashFlowBridge, CashFlowLine, DetailDriver, MtdComparison, MtdMetricComparison, KpiBreakdowns } from "./briefing/engine";
import { currency } from "./briefing/engine";

type Series = { name: string; values: number[]; periods: string[] };
type ReportNode = { label: string; values: number[]; group: string; type: string };

function clean(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function toNumber(value: unknown): number {
  const text = String(value ?? "").trim().replace(/\$/g, "").replace(/,/g, "").replace(/%/g, "").replace(/^\((.*)\)$/, "-$1");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function valuesFromCells(cells: any[] | undefined, periodCount: number): number[] {
  return (cells || []).slice(1, periodCount + 1).map((cell: any) => toNumber(cell?.value));
}

function labelFromCells(cells: any[] | undefined): string {
  return String(cells?.[0]?.value || "").trim();
}

function collectRows(node: any, periodCount: number, output: ReportNode[] = []): ReportNode[] {
  if (!node) return output;
  if (Array.isArray(node)) {
    for (const item of node) collectRows(item, periodCount, output);
    return output;
  }
  if (typeof node !== "object") return output;
  const group = String(node.group || "");
  const type = String(node.type || "");
  if (node.Summary?.ColData) {
    const label = labelFromCells(node.Summary.ColData);
    if (label) output.push({ label, values: valuesFromCells(node.Summary.ColData, periodCount), group, type });
  }
  if (node.ColData) {
    const label = labelFromCells(node.ColData);
    if (label) output.push({ label, values: valuesFromCells(node.ColData, periodCount), group, type });
  }
  if (node.Header?.ColData) {
    const label = labelFromCells(node.Header.ColData);
    if (label) output.push({ label, values: valuesFromCells(node.Header.ColData, periodCount), group, type: "Header" });
  }
  if (node.Rows) collectRows(node.Rows, periodCount, output);
  if (Array.isArray(node.Row)) for (const row of node.Row) collectRows(row, periodCount, output);
  return output;
}


type ARAgingCustomer = {
  customer: string;
  total: number;
  current: number;
  buckets: { "1-30": number; "31-60": number; "61-90": number; "91+": number };
};

type ARAgingSummary = {
  customers: ARAgingCustomer[];
  totalReceivables: number;
  totalOverdue: number;
  bucketTotals: { Current: number; "1-30": number; "31-60": number; "61-90": number; "91+": number };
};

function parseARCellValue(row: any, name: string): number {
  const cell = (row?.cells || row?.ColData || []).find((item: any) => String(item?.name || item?.id || "").toLowerCase() === name.toLowerCase());
  return toNumber(cell?.value);
}

function parseARCellText(row: any, name: string): string {
  const cell = (row?.cells || row?.ColData || []).find((item: any) => String(item?.name || "").toLowerCase() === name.toLowerCase());
  return String(cell?.value || "").trim();
}

function ageBucket(daysOverdue: number): "1-30" | "31-60" | "61-90" | "91+" {
  if (daysOverdue >= 91) return "91+";
  if (daysOverdue >= 61) return "61-90";
  if (daysOverdue >= 31) return "31-60";
  return "1-30";
}

function parseARAgingSummary(report: any, asOfDate: string): ARAgingSummary | null {
  if (!report) return null;

  // Some report adapters expose a normalized reportData.rows shape; support it
  // directly so this parser remains useful in deterministic tests as well as
  // with raw QuickBooks report payloads.
  const normalizedRows = report?.reportData?.rows;
  if (Array.isArray(normalizedRows) && normalizedRows.length) {
    const customers = normalizedRows.map((row: any) => {
      const customer = parseARCellText(row, "Customer");
      const total = parseARCellValue(row, "Total");
      const current = parseARCellValue(row, "Current");
      return {
        customer,
        total,
        current,
        buckets: {
          "1-30": parseARCellValue(row, "1-30"),
          "31-60": parseARCellValue(row, "31-60"),
          "61-90": parseARCellValue(row, "61-90"),
          "91+": parseARCellValue(row, "91+"),
        },
      };
    }).filter((row: ARAgingCustomer) => row.customer && (row.total !== 0 || row.current !== 0 || Object.values(row.buckets).some(Boolean)));

    if (customers.length) {
      return {
        customers,
        totalReceivables: customers.reduce((sum: number, row: ARAgingCustomer) => sum + row.total, 0),
        totalOverdue: customers.reduce((sum: number, row: ARAgingCustomer) => sum + Object.values(row.buckets).reduce((a, b) => a + b, 0), 0),
        bucketTotals: {
          Current: customers.reduce((sum: number, row: ARAgingCustomer) => sum + row.current, 0),
          "1-30": customers.reduce((sum: number, row: ARAgingCustomer) => sum + row.buckets["1-30"], 0),
          "31-60": customers.reduce((sum: number, row: ARAgingCustomer) => sum + row.buckets["31-60"], 0),
          "61-90": customers.reduce((sum: number, row: ARAgingCustomer) => sum + row.buckets["61-90"], 0),
          "91+": customers.reduce((sum: number, row: ARAgingCustomer) => sum + row.buckets["91+"], 0),
        },
      };
    }
  }

  // Raw QBO AgedReceivableDetail is transaction-oriented rather than
  // period-oriented. Never run it through reportRowsWithPeriods(): the columns
  // are Date, Transaction Type, Customer, Due Date, Open Balance, etc.
  const rows = collectRows(report?.Rows, 7)
    .filter((row) => row.type !== "Section" && row.label)
    .map((row) => row);

  if (!rows.length) return null;

  const customerMap = new Map<string, ARAgingCustomer>();
  const asOf = new Date(asOfDate + "T00:00:00Z");
  if (!Number.isFinite(asOf.getTime())) return null;

  for (const row of rows) {
    // collectRows flattens ColData and loses column names, so only use this
    // path when the report exposes a normalized rows shape. Raw QBO detail
    // parsing is handled by parseRawARAgingDetail below.
  }

  return parseRawARAgingDetail(report, asOf);
}

function parseRawARAgingDetail(report: any, asOf: Date): ARAgingSummary | null {
  const rawRows: any[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object") return;
    if (Array.isArray(node.ColData)) rawRows.push(node);
    if (node.Rows) walk(node.Rows);
    if (Array.isArray(node.Row)) node.Row.forEach(walk);
  };
  walk(report?.Rows);

  const customerMap = new Map<string, ARAgingCustomer>();
  for (const row of rawRows) {
    const cells = row.ColData || [];
    const get = (namePattern: RegExp) => {
      const cell = cells.find((cell: any) => namePattern.test(String(cell?.value ?? "").trim()) && false);
      return cell;
    };
    const byIndex = (index: number) => cells[index]?.value;
    // QBO's AgedReceivableDetail columns are Date, Transaction Type,
    // Transaction#, Customer, Due Date, Amount, Open Balance in this fixture.
    const transactionType = String(byIndex(1) || "").trim().toUpperCase();
    const customer = String(byIndex(3) || "").trim();
    const dueDateText = String(byIndex(4) || "").trim();
    const openBalance = toNumber(byIndex(6));
    if (!customer || !Number.isFinite(openBalance) || openBalance === 0) continue;

    const existing = customerMap.get(customer) || {
      customer,
      total: 0,
      current: 0,
      buckets: { "1-30": 0, "31-60": 0, "61-90": 0, "91+": 0 },
    };
    existing.total += openBalance;

    const dueDate = new Date(dueDateText + "T00:00:00Z");
    const daysOverdue = Number.isFinite(dueDate.getTime())
      ? Math.floor((asOf.getTime() - dueDate.getTime()) / 86400000)
      : 0;

    // Positive invoice/open-balance rows are the receivable exposure. Negative
    // payments/credits remain in total/current reconciliation but are not
    // treated as positive overdue exposure.
    if (openBalance > 0) {
      if (daysOverdue <= 0) existing.current += openBalance;
      else existing.buckets[ageBucket(daysOverdue)] += openBalance;
    }

    customerMap.set(customer, existing);
  }

  const customers = Array.from(customerMap.values()).filter((row) => row.total !== 0 || row.current !== 0 || Object.values(row.buckets).some(Boolean));
  if (!customers.length) return null;

  return {
    customers,
    totalReceivables: customers.reduce((sum, row) => sum + row.total, 0),
    totalOverdue: customers.reduce((sum, row) => sum + Object.values(row.buckets).reduce((a, b) => a + b, 0), 0),
    bucketTotals: {
      Current: customers.reduce((sum, row) => sum + row.current, 0),
      "1-30": customers.reduce((sum, row) => sum + row.buckets["1-30"], 0),
      "31-60": customers.reduce((sum, row) => sum + row.buckets["31-60"], 0),
      "61-90": customers.reduce((sum, row) => sum + row.buckets["61-90"], 0),
      "91+": customers.reduce((sum, row) => sum + row.buckets["91+"], 0),
    },
  };
}

function reportPeriods(report: any): string[] {
  return (report?.Columns?.Column || []).slice(1)
    .map((column: any) => String(column?.ColTitle || "").trim())
    .filter((title: string) => title && !/^total$/i.test(title));
}

function isPartialCurrentMonth(label: string): boolean {
  const cleaned = label.trim().toLowerCase();
  const monthStarts = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const monthIndex = monthStarts.findIndex((m) => cleaned.startsWith(m));
  if (monthIndex < 0) return false;
  const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return false;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return monthIndex === now.getMonth() && Number(yearMatch[0]) === now.getFullYear() && now.getDate() < daysInMonth;
}

function findSectionByGroup(rows: ReportNode[], patterns: RegExp[]): ReportNode | null {
  return rows.find((row) => row.type === "Section" && row.group && patterns.some((pattern) => pattern.test(clean(row.group))) && row.values.some((value) => value !== 0)) || null;
}

function findSectionByLabel(rows: ReportNode[], patterns: RegExp[]): ReportNode | null {
  return rows.find((row) => row.type === "Section" && patterns.some((pattern) => pattern.test(clean(row.label))) && row.values.some((value) => value !== 0)) || null;
}

function findAnyByLabel(rows: ReportNode[], patterns: RegExp[]): ReportNode | null {
  return rows.find((row) => patterns.some((pattern) => pattern.test(clean(row.label))) && row.values.some((value) => value !== 0)) || null;
}

function pickSeries(rows: ReportNode[], groupPatterns: RegExp[], labelPatterns: RegExp[], length: number): number[] | null {
  const row = findSectionByGroup(rows, groupPatterns) || findSectionByLabel(rows, labelPatterns) || findAnyByLabel(rows, labelPatterns);
  return row ? row.values.slice(0, length) : null;
}

function sumDataRows(rows: ReportNode[], patterns: RegExp[], length: number): number[] {
  const matches = rows.filter((row) => row.type !== "Section" && patterns.some((pattern) => pattern.test(clean(row.label))));
  return Array.from({ length }, (_, index) => matches.reduce((sum, row) => sum + (row.values[index] || 0), 0));
}

function changePercent(current: number, previous: number): number {
  return previous === 0 ? Number.NaN : ((current - previous) / Math.abs(previous)) * 100;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Number(value.toFixed(1))}%`;
}

function latestPopulatedIndex(series: number[][]): number {
  for (let index = Math.max(...series.map((values) => values.length)) - 1; index >= 0; index -= 1) {
    if (series.some((values) => Number.isFinite(values[index]) && values[index] !== 0)) return index;
  }
  return -1;
}

type PnlReconciliationIssue = {
  period: string;
  reportedNetIncome: number;
  expectedNetIncome: number;
  variance: number;
};

function findOtherSeries(rows: ReportNode[], periods: number, income: boolean): number[] | null {
  return pickSeries(
    rows,
    income ? [/^otherincome$/] : [/^otherexpenses?$/],
    income ? [/^total other income$/, /^other income$/] : [/^total other expenses$/, /^other expenses?$/],
    periods,
  );
}

function findPnlReconciliationIssue(rows: ReportNode[], periods: string[], revenue: number[], cogs: number[], expenses: number[], netIncome: number[] | null): PnlReconciliationIssue | null {
  if (!netIncome || !periods.length) return null;
  const otherIncome = findOtherSeries(rows, periods.length, true);
  const otherExpense = findOtherSeries(rows, periods.length, false);
  let largest: PnlReconciliationIssue | null = null;

  for (let index = 0; index < periods.length; index += 1) {
    const reported = netIncome[index];
    if (!Number.isFinite(reported)) continue;
    const expected = (revenue[index] || 0) - (cogs[index] || 0) - (expenses[index] || 0) + (otherIncome?.[index] || 0) - (otherExpense?.[index] || 0);
    const variance = reported - expected;
    const threshold = Math.max(1000, Math.abs(expected) * 0.01, Math.abs(revenue[index] || 0) * 0.005);
    if (Math.abs(variance) <= threshold) continue;
    if (!largest || Math.abs(variance) > Math.abs(largest.variance)) {
      largest = { period: periods[index], reportedNetIncome: reported, expectedNetIncome: expected, variance };
    }
  }
  return largest;
}

function buildDrivers(revenueChange: number, marginChange: number, cashChange: number, inventoryChange: number, expenseChange: number, previousCogs: number, currentCogs: number, previousExpense: number, currentExpense: number, previousCash: number, currentCash: number, previousInventory: number, currentInventory: number, currentRevenue: number, previousRevenue: number): FinancialDriver[] {
  const drivers: FinancialDriver[] = [];
  // Dollar-materiality floors: a percentage move on a tiny base is noise, not a
  // signal. Each driver below keeps its percentage threshold AND requires the
  // underlying dollar movement to clear its floor before firing.
  const MIN_DRIVER_DELTA = 1000;
  if (Number.isFinite(expenseChange) && expenseChange > (Number.isFinite(revenueChange) ? revenueChange : 0) + 2 && Math.abs(currentExpense - previousExpense) >= MIN_DRIVER_DELTA) {
    drivers.push({ id: "opex-growth", category: "Operating Expense", title: "Operating expenses are rising faster than revenue", observation: `Operating expenses changed ${formatPercent(expenseChange)} while revenue changed ${formatPercent(revenueChange)}.`, evidence: [`Operating expense change: ${formatPercent(expenseChange)}`, `Operating expense dollars: ${Math.round(previousExpense).toLocaleString()} to ${Math.round(currentExpense).toLocaleString()} (${currentExpense - previousExpense >= 0 ? "+" : ""}${Math.round(currentExpense - previousExpense).toLocaleString()})`, `Revenue change: ${formatPercent(revenueChange)}`], direction: "up", severity: expenseChange > 20 ? "High" : "Medium", impact: Math.min(10, Math.max(1, Math.round(Math.abs(expenseChange - (Number.isFinite(revenueChange) ? revenueChange : 0)) / 5))), confidence: 0.9, managementQuestion: "Which expense categories are driving the increase, and which are controllable or temporary?", estimatedImpact: Math.abs(currentExpense - previousExpense) });
  }
  if (Number.isFinite(cashChange) && cashChange < -5 && Math.abs(currentCash - previousCash) >= MIN_DRIVER_DELTA) {
    drivers.push({ id: "cash-pressure", category: "Cash", title: "Cash is under pressure", observation: `Cash declined ${formatPercent(Math.abs(cashChange))} from the prior period.`, evidence: [`Cash change: ${formatPercent(cashChange)}`], direction: "down", severity: cashChange < -15 ? "High" : "Medium", impact: 5, confidence: 0.94, managementQuestion: "What near-term cash commitments could create additional pressure?", estimatedImpact: Math.abs(currentCash - previousCash) });
  }
  if (Number.isFinite(inventoryChange) && Number.isFinite(revenueChange) && inventoryChange > revenueChange + 2 && Math.abs(currentInventory - previousInventory) >= MIN_DRIVER_DELTA) {
    drivers.push({ id: "inventory-growth", category: "Inventory", title: "Inventory is outpacing revenue", observation: `Inventory changed ${formatPercent(inventoryChange)}, ahead of revenue at ${formatPercent(revenueChange)}.`, evidence: [`Inventory change: ${formatPercent(inventoryChange)}`, `Revenue change: ${formatPercent(revenueChange)}`], direction: "up", severity: "Medium", impact: 3, confidence: 0.9, managementQuestion: "What is driving the inventory build, and how quickly can it be converted to sales?", estimatedImpact: Math.abs(currentInventory - previousInventory) });
  }
  if (Number.isFinite(marginChange) && marginChange < -2) {
    if ((previousCogs || 0) === 0 && (currentCogs || 0) > 0) {
      drivers.push({ id: "margin-baseline", category: "Margin", title: "COGS appeared this period after none in the prior period", observation: `COGS of ${Math.round(currentCogs).toLocaleString()} was recorded this period versus $0 in the prior period. That change coincides with the margin movement, but the prior-period baseline should be validated before treating it as a recurring margin driver.`, evidence: [`Current COGS: $${Math.round(currentCogs).toLocaleString()}`, `Prior COGS: $0`], direction: "down", severity: "Medium", impact: 2, confidence: 0.88, managementQuestion: "Was prior-period COGS omitted, or is this the beginning of a recurring COGS pattern?", estimatedImpact: Math.abs(currentCogs) });
    } else {
      drivers.push({ id: "margin-pressure", category: "Margin", title: "Gross margin has weakened", observation: `Gross margin changed ${formatPercent(marginChange)} from the prior period.`, evidence: [`Margin change: ${formatPercent(marginChange)}`], direction: "down", severity: marginChange < -5 ? "High" : "Medium", impact: 4, confidence: 0.88, managementQuestion: "Is the margin change coming from pricing, product mix, or direct costs?", estimatedImpact: currentRevenue > 0 ? Math.abs(marginChange / 100) * currentRevenue : undefined });
    }
  }
  return drivers;
}

function buildClassificationReview(profitAndLossRows: ReportNode[], revenue: number, cogs: number, operatingExpense: number): { driver: FinancialDriver | null; unknown: string | null } {
  // QuickBooks can legally contain direct-cost accounts under ordinary Expense
  // categories. Do not silently reclassify them: surface the accounting
  // classification as a review item so the customer can confirm the mapping.
  if (revenue <= 0 || operatingExpense <= 0 || cogs > 0 || (cogs / revenue) > 0.001) {
    return { driver: null, unknown: null };
  }

  const directCostPatterns = [
    /contract labor/i, /subcontract/i, /job materials?/i, /materials?/i,
    /parts?/i, /equipment rental/i, /job supplies?/i, /direct labor/i,
  ];
  const candidates = profitAndLossRows
    .filter((row) => row.type !== "Section" && directCostPatterns.some((pattern) => pattern.test(row.label)))
    .filter((row) => row.values.some((value) => Math.abs(value) > 0))
    .map((row) => row.label)
    .filter((label, index, labels) => labels.indexOf(label) === index)
    .slice(0, 5);

  const margin = (revenue - cogs) / revenue * 100;
  const evidence = [
    "QuickBooks-reported COGS: $" + Math.round(cogs).toLocaleString(),
    "QuickBooks-reported operating expenses: $" + Math.round(operatingExpense).toLocaleString(),
    "Reported gross margin: " + margin.toFixed(1) + "%",
    ...(candidates.length ? ["Expense accounts worth reviewing for direct-cost treatment: " + candidates.join(", ")] : []),
  ];

  return {
    driver: {
      id: "account-classification-review",
      category: "Unusual Spend",
      title: "Gross margin may be affected by account classification",
      observation: candidates.length
        ? "QuickBooks reports no COGS while " + candidates.join(", ") + " appear as expense accounts. If any are direct costs of delivering revenue, confirm their classification before relying on gross margin."
        : "QuickBooks reports no COGS while operating expenses are present. Confirm that direct costs of delivering revenue are classified consistently before relying on gross margin.",
      evidence, direction: "watch", severity: "Watch", impact: 4, confidence: 0.96,
      managementQuestion: "Which expense accounts are direct costs of delivering revenue, and should any be mapped to Cost of Revenue?",
    },
    unknown: "Gross margin is based on QuickBooks account classifications. ClearCFO detected operating expenses but no COGS, so direct-cost classification should be reviewed before treating the reported gross margin as economically representative.",
  };
}
function buildAlerts(revenueChange: number, cashChange: number, inventoryChange: number, expenseChange: number): string[] {
  // Exception-driven, mirroring the upload path: only genuinely notable
  // movements become alerts. Calm periods produce no alerts, and the
  // executive summary then reports "no major exceptions" instead of
  // restating every metric.
  const alerts: string[] = [];
  if (Number.isFinite(expenseChange) && expenseChange > (Number.isFinite(revenueChange) ? revenueChange : 0) + 2) alerts.push(`Operating expenses increased ${formatPercent(expenseChange)} while revenue changed ${formatPercent(revenueChange)}.`);
  if (Number.isFinite(cashChange) && cashChange < -5) alerts.push(`Cash declined ${formatPercent(Math.abs(cashChange))} from the prior period.`);
  if (Number.isFinite(inventoryChange) && Number.isFinite(revenueChange) && inventoryChange > revenueChange + 2) alerts.push(`Inventory increased ${formatPercent(inventoryChange)}, outpacing revenue change of ${formatPercent(revenueChange)}.`);
  return alerts;
}

type ManagementQuestion = { category: string; question: string };

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sumDailyMetric(rows: ReportNode[], groupPatterns: RegExp[], labelPatterns: RegExp[], dayCount: number, fallbackPatterns?: RegExp[]): number {
  const series = pickSeries(rows, groupPatterns, labelPatterns, dayCount)
    || (fallbackPatterns ? sumDataRows(rows, fallbackPatterns, dayCount) : null)
    || [];
  return series.slice(0, dayCount).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

// Day-matched month-to-date: sums daily P&L values for the elapsed days of
// the current month versus the same days of the previous month. Returns null
// when either daily report is missing or has no usable data, in which case
// the UI simply omits the MTD section (no projection, no filler).
function buildDayMatchedComparison(mtdCurrent: any, mtdPrevious: any): MtdComparison | null {
  if (!mtdCurrent || !mtdPrevious) return null;
  const currentPeriods = reportPeriods(mtdCurrent);
  const previousPeriods = reportPeriods(mtdPrevious);
  if (!currentPeriods.length || !previousPeriods.length) return null;
  if (currentPeriods.length > 31 || previousPeriods.length > 31) return null;

  const now = new Date();
  const currentRows = collectRows(mtdCurrent?.Rows, currentPeriods.length);
  const previousRows = collectRows(mtdPrevious?.Rows, previousPeriods.length);

  const metric = (rows: ReportNode[], dayCount: number, groups: RegExp[], labels: RegExp[], fallback?: RegExp[]) => sumDailyMetric(rows, groups, labels, dayCount, fallback);
  const revenueGroups = [/^income$/, /^revenue$/, /^sales$/];
  const revenueLabels = [/^total income$/, /^total revenue$/, /^net revenue$/, /^total sales$/, /^net sales$/];
  const cogsGroups = [/^cogs$/, /^costofgoodssold$/, /^costofsales$/, /^costofrevenue$/];
  const cogsLabels = [/^total cost of goods sold$/, /^cost of goods sold$/, /^cost of sales$/, /^cost of revenue$/];
  const expenseGroups = [/^expenses$/, /^operatingexpenses$/];
  const expenseLabels = [/^total operating expenses$/, /^operating expenses$/, /^total expenses$/, /^expenses$/];
  const netGroups = [/^netincome$/, /^netoperatingincome$/];
  const netLabels = [/^net income$/, /^net operating income$/];

  // Net Income must come from the true Net Income row. The generic picker
  // takes the first matching section in report order, which is Net Operating
  // Income — pairing current Net Income against a prior operating-income
  // baseline once showed -101.3% for a nearly flat bottom line.
  const netIncomeSeries = (rows: ReportNode[], dayCount: number): number[] | null => {
    const exact = rows.find((row) => row.type === "Section" && clean(row.label) === "net income");
    if (exact) return exact.values.slice(0, dayCount);
    return pickSeries(rows, netGroups, netLabels, dayCount);
  };
  const netMetric = (rows: ReportNode[], dayCount: number): number =>
    (netIncomeSeries(rows, dayCount) || []).slice(0, dayCount)
      .reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);

  const currentRevenue = metric(currentRows, currentPeriods.length, revenueGroups, revenueLabels, [/revenue/, /^sales$/]);
  const previousRevenue = metric(previousRows, previousPeriods.length, revenueGroups, revenueLabels, [/revenue/, /^sales$/]);
  if (currentRevenue === 0 && previousRevenue === 0) return null;

  const currentCogs = metric(currentRows, currentPeriods.length, cogsGroups, cogsLabels);
  const previousCogs = metric(previousRows, previousPeriods.length, cogsGroups, cogsLabels);
  const currentExpense = metric(currentRows, currentPeriods.length, expenseGroups, expenseLabels, [/expense/]);
  const previousExpense = metric(previousRows, previousPeriods.length, expenseGroups, expenseLabels, [/expense/]);
  const currentNet = netMetric(currentRows, currentPeriods.length);
  const previousNet = netMetric(previousRows, previousPeriods.length);

  const compare = (current: number, previous: number): MtdMetricComparison => ({ current, previous, change: changePercent(current, previous) });
  const monthLabel = (date: Date, dayCount: number) => `${SHORT_MONTHS[date.getMonth()]} 1–${dayCount}, ${date.getFullYear()}`;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    currentLabel: monthLabel(now, currentPeriods.length),
    previousLabel: monthLabel(prevMonth, previousPeriods.length),
    revenue: compare(currentRevenue, previousRevenue),
    grossProfit: compare(currentRevenue - currentCogs, previousRevenue - previousCogs),
    operatingExpense: compare(currentExpense, previousExpense),
    netIncome: compare(currentNet, previousNet),
  };
}

function isUsableDetailLabel(label: string): boolean {
  const normalized = label.trim();
  if (!normalized) return false;
  // QuickBooks detail reports can surface transaction dates as row labels.
  // Those are not expense accounts and should never become management-question subjects.
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  return true;
}

function topReportRows(report: any, limit = 3): Array<{ label: string; value: number }> {
  if (!report) return [];
  const periods = reportPeriods(report);
  if (!periods.length) return [];
  const latestIndex = periods.length - 1;
  return collectRows(report?.Rows, periods.length)
    .filter((row) => row.type !== "Section")
    .map((row) => ({ label: row.label, value: row.values[latestIndex] || 0 }))
    .filter((row) => row.label && isUsableDetailLabel(row.label) && Number.isFinite(row.value) && row.value !== 0 && !/^total|^net income|^gross profit|^operating income/i.test(row.label))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, limit);
}


function reportRowsWithPeriods(report: any): Array<{ label: string; current: number; previous: number }> {
  if (!report) return [];
  const periods = reportPeriods(report);
  if (!periods.length) return [];
  return collectRows(report?.Rows, periods.length)
    .filter((row) => row.type !== "Section")
    .map((row) => ({
      label: row.label,
      current: row.values[periods.length - 1] || 0,
      previous: periods.length > 1 ? row.values[periods.length - 2] || 0 : 0,
    }))
    .filter((row) => row.label && isUsableDetailLabel(row.label) && Number.isFinite(row.current) && row.current !== 0)
    .filter((row) => !/^total|^net income|^gross profit|^operating income/i.test(row.label));
}

function detailDriverFromRow(row: { label: string; current: number; previous: number }, direction: "up" | "down", category: "Revenue" | "Operating Expense"): DetailDriver {
  const change = row.current - row.previous;
  return {
    name: row.label,
    current: row.current,
    previous: row.previous,
    change,
    percentChange: row.previous === 0 ? 0 : (change / Math.abs(row.previous)) * 100,
    direction,
    impact: Math.abs(change),
    category,
  };
}

function buildDetailedDrivers(detailReports: Record<string, any>): { drivers: FinancialDriver[]; details: DetailDriver[]; relationships: string[]; unknowns: string[] } {
  const drivers: FinancialDriver[] = [];
  const details: DetailDriver[] = [];
  const relationships: string[] = [];
  const unknowns: string[] = [];

  const customers = reportRowsWithPeriods(detailReports.incomeByCustomer)
    .map((row) => ({ ...row, change: row.current - row.previous }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const customerUps = customers.filter((row) => row.change > 0).slice(0, 3);
  const customerDowns = customers.filter((row) => row.change < 0).slice(0, 3);
  customerUps.forEach((row) => details.push(detailDriverFromRow(row, "up", "Revenue")));
  customerDowns.forEach((row) => details.push(detailDriverFromRow(row, "down", "Revenue")));
  if (customerUps.length || customerDowns.length) {
    const evidence = [
      ...customerUps.slice(0, 2).map((row) => `${row.label}: +${currency.format(row.change)}`),
      ...customerDowns.slice(0, 2).map((row) => `${row.label}: ${currency.format(row.change)}`),
    ];
    drivers.push({
      id: "revenue-customer-mix",
      category: "Revenue",
      title: "Customer mix is driving revenue movement",
      observation: "The customer-level report identifies specific accounts contributing to the period-over-period revenue change.",
      evidence,
      direction: customerUps.length && customerDowns.length ? "mixed" : customerUps.length ? "up" : "down",
      severity: "Watch",
      impact: Math.min(10, Math.max(1, Math.round(Math.max(...customers.map((row) => Math.abs(row.change)), 0) / 10000))),
      confidence: 0.95,
      managementQuestion: customerDowns.length
        ? `What changed with ${customerDowns[0].label}, which moved ${currency.format(customerDowns[0].change)} versus the prior period?`
        : `Is the growth from ${customerUps[0]?.label || "the largest customer"} recurring, or was it driven by a one-time order?`,
    });
    relationships.push(customerUps.length
      ? `Customer growth is concentrated in ${customerUps[0].label}, which increased ${currency.format(customerUps[0].change)} versus the prior period.`
      : "Customer-level revenue data shows the largest reported revenue movements.");
  } else {
    unknowns.push("Customer-level revenue detail was not available, so ClearCFO cannot attribute revenue movement to specific customers.");
  }

  const expenses = reportRowsWithPeriods(detailReports.profitAndLossDetail)
    .filter((row) => !/income|revenue|sales|cost of goods|gross profit|net income/i.test(row.label))
    .map((row) => ({ ...row, change: row.current - row.previous }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const expenseUps = expenses.filter((row) => row.change > 0).slice(0, 4);
  expenseUps.forEach((row) => details.push(detailDriverFromRow(row, "up", "Operating Expense")));
  if (expenseUps.length) {
    drivers.push({
      id: "expense-detail",
      category: "Operating Expense",
      title: "Specific expense lines are driving the change",
      observation: "The detailed P&L identifies the largest expense movements instead of treating operating expenses as one combined number.",
      evidence: expenseUps.slice(0, 3).map((row) => `${row.label}: +${currency.format(row.change)}`),
      direction: "up",
      severity: "Medium",
      impact: Math.min(10, Math.max(1, Math.round(expenseUps[0].change / 10000))),
      confidence: 0.95,
      managementQuestion: `Operating expenses changed versus the prior period, driven primarily by ${expenseUps[0].label} increasing ${currency.format(expenseUps[0].change)}. Is this a recurring cost, a one-time expense, or something that needs to be reviewed?`,
    });
    relationships.push(`${expenseUps[0].label} is the largest reported expense increase at ${currency.format(expenseUps[0].change)}.`);
  } else if (detailReports.profitAndLossDetail) {
    unknowns.push("The detailed P&L did not provide a meaningful period-over-period expense movement.");
  } else {
    unknowns.push("Detailed P&L data was not available, so expense changes cannot yet be attributed to specific accounts.");
  }

  const vendors = reportRowsWithPeriods(detailReports.expenseByVendor)
    .map((row) => ({ ...row, change: row.current - row.previous }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const vendorUps = vendors.filter((row) => row.change > 0).slice(0, 3);
  vendorUps.forEach((row) => details.push(detailDriverFromRow(row, "up", "Operating Expense")));
  if (vendorUps.length) {
    drivers.push({
      id: "vendor-spend",
      category: "Operating Expense",
      title: "Vendor spending is concentrated",
      observation: "Vendor-level detail shows where reported spending is concentrated and which relationships changed most.",
      evidence: vendorUps.map((row) => `${row.label}: +${currency.format(row.change)}`),
      direction: "up",
      severity: "Watch",
      impact: Math.min(10, Math.max(1, Math.round(vendorUps[0].change / 10000))),
      confidence: 0.93,
      managementQuestion: `Was the ${currency.format(vendorUps[0].change)} increase with ${vendorUps[0].label} planned, recurring, or unusual?`,
    });
  }

  const arAging = parseARAgingSummary(detailReports.agedReceivables, detailReports.arAsOfDate || new Date().toISOString().slice(0, 10));
  if (arAging) {
    const customers = [...arAging.customers].sort((a, b) => Math.max(...Object.values(b.buckets)) - Math.max(...Object.values(a.buckets)));
    const top = customers[0];
    const overdue = arAging.totalOverdue;
    const oldestBucket = arAging.bucketTotals["91+"] > 0 ? "91+"
      : arAging.bucketTotals["61-90"] > 0 ? "61-90"
      : arAging.bucketTotals["31-60"] > 0 ? "31-60"
      : arAging.bucketTotals["1-30"] > 0 ? "1-30"
      : null;
    drivers.push({
      id: "receivables-aging",
      category: "Cash",
      title: "Receivables include aged balances",
      observation: overdue > 0
        ? `QuickBooks reports ${currency.format(overdue)} of gross overdue receivables, concentrated in ${top?.customer || "specific customers"}.`
        : "QuickBooks reports no positive overdue receivable exposure.",
      evidence: [
        `Net receivables: ${currency.format(arAging.totalReceivables)}`,
        `Gross overdue: ${currency.format(overdue)}`,
        oldestBucket ? `Oldest populated bucket: ${oldestBucket}` : "No overdue aging bucket populated",
      ],
      direction: "watch",
      severity: overdue > 0 ? (arAging.bucketTotals["91+"] > 0 ? "High" : "Medium") : "Watch",
      impact: Math.min(10, Math.max(1, Math.round(overdue / 10000))),
      confidence: 0.94,
      managementQuestion: overdue > 0
        ? `Which overdue receivables are collectible on schedule, and what follow-up is needed for the oldest balances?`
        : "Are current receivables expected to convert to cash on their normal payment terms?",
    });
    relationships.push(`A/R aging shows ${currency.format(overdue)} of gross overdue exposure; the net receivables balance is ${currency.format(arAging.totalReceivables)}.`);
  } else {
    unknowns.push("Accounts-receivable aging detail was not available, so ClearCFO cannot reliably attribute receivable exposure by customer or aging bucket.");
  }

  const inventory = reportRowsWithPeriods(detailReports.inventoryValuation).sort((a, b) => Math.abs(b.current) - Math.abs(a.current));
  if (inventory.length) {
    const top = inventory[0];
    drivers.push({
      id: "inventory-detail",
      category: "Inventory",
      title: "Inventory is concentrated in specific items",
      observation: `${top.label} has the largest reported inventory value at ${currency.format(Math.abs(top.current))}.`,
      evidence: inventory.slice(0, 3).map((row) => `${row.label}: ${currency.format(Math.abs(row.current))}`),
      direction: "watch",
      severity: "Medium",
      impact: Math.min(10, Math.max(1, Math.round(Math.abs(top.current) / 10000))),
      confidence: 0.9,
      managementQuestion: `Is ${top.label}'s ${currency.format(Math.abs(top.current))} inventory balance turning at an acceptable rate?`,
    });
    relationships.push(`The largest reported inventory balance is ${top.label} at ${currency.format(Math.abs(top.current))}.`);
  } else {
    unknowns.push("Inventory detail was not available, so ClearCFO cannot identify which items are tying up the most cash.");
  }

  return { drivers, details, relationships, unknowns };
}

// Balance-sheet point-in-time value aligned to a P&L period label. Periods
// with no balance-sheet value are reported as missing, never as zero.
type BalancePoint = { current: number; previous: number; hasCurrent: boolean; hasPrevious: boolean };

function balancePoint(balanceRows: ReportNode[], balancePeriods: string[], groupPatterns: RegExp[], labelPatterns: RegExp[], currentLabel: string, previousLabel: string | null): BalancePoint {
  const series = balancePeriods.length ? pickSeries(balanceRows, groupPatterns, labelPatterns, balancePeriods.length) : null;
  const byLabel = new Map<string, number>();
  if (series) balancePeriods.forEach((label, index) => { if (Number.isFinite(series[index])) byLabel.set(label, series[index]); });
  const current = byLabel.get(currentLabel);
  const previous = previousLabel ? byLabel.get(previousLabel) : undefined;
  return { current: current ?? 0, previous: previous ?? 0, hasCurrent: current !== undefined, hasPrevious: previous !== undefined };
}

// Deterministic balance-sheet health ratios for the latest synced period.
// Day-count ratios assume monthly reporting periods. Ratios whose inputs
// are unavailable are skipped, never fabricated.
function buildRatios(args: {
  balanceRows: ReportNode[];
  balancePeriods: string[];
  currentLabel: string;
  previousLabel: string | null;
  revenue: number;
  cogs: number;
  operatingExpense: number;
  inventory: number;
}): { ratios: FinancialRatio[]; unknowns: string[] } {
  const ratios: FinancialRatio[] = [];
  const unknowns: string[] = [];
  const { balanceRows, balancePeriods, currentLabel, previousLabel, revenue, cogs, operatingExpense, inventory } = args;
  const point = (groups: RegExp[], labels: RegExp[]) => balancePoint(balanceRows, balancePeriods, groups, labels, currentLabel, previousLabel);
  const assets = point([], [/^total assets$/]);
  const liabilities = point([], [/^total liabilities$/]);
  const currentAssets = point([], [/^total current assets$/]);
  const currentLiabilities = point([], [/^total current liabilities$/]);
  const receivables = point([], [/^accounts receivable$/, /^total accounts receivable$/]);
  const payables = point([], [/^accounts payable$/, /^total accounts payable$/]);
  if (!assets.hasCurrent || !balancePeriods.length) {
    unknowns.push("QuickBooks did not return a usable balance sheet, so ClearCFO could not compute financial ratios.");
    return { ratios, unknowns };
  }
  const push = (id: string, label: string, value: string, interpretation: string, health: FinancialRatio["health"]) => ratios.push({ id, label, value, interpretation, health });
  if (currentAssets.hasCurrent && currentLiabilities.hasCurrent && currentLiabilities.current !== 0) {
    const value = currentAssets.current / currentLiabilities.current;
    push("current-ratio", "Current ratio", `${value.toFixed(2)}x`, `Current assets cover current liabilities ${value.toFixed(2)} times.`, value >= 1.5 ? "strong" : value >= 1 ? "watch" : "attention");
  }
  if (currentAssets.hasCurrent && currentLiabilities.hasCurrent && currentLiabilities.current !== 0) {
    const quickAssets = currentAssets.current - (Number.isFinite(inventory) ? inventory : 0);
    const value = quickAssets / currentLiabilities.current;
    push("quick-ratio", "Quick ratio", `${value.toFixed(2)}x`, `Liquid assets excluding inventory cover current liabilities ${value.toFixed(2)} times.`, value >= 1 ? "strong" : value >= 0.7 ? "watch" : "attention");
  }
  const equity = assets.current - liabilities.current;
  if (liabilities.hasCurrent && equity !== 0) {
    const value = liabilities.current / equity;
    push("debt-to-equity", "Debt-to-equity", `${value.toFixed(2)}x`, equity < 0 ? "Liabilities exceed assets: the balance sheet shows negative equity." : `Creditors finance ${value.toFixed(2)}x of what owners finance.`, equity < 0 || value > 2 ? "attention" : value > 1 ? "watch" : "strong");
  }
  if (receivables.hasCurrent && revenue > 0) {
    const value = (receivables.current / revenue) * 30;
    push("dso", "Days sales outstanding", `${Math.round(value)} days`, `It takes about ${Math.round(value)} days on average to collect a dollar of sales.`, value <= 30 ? "strong" : value <= 45 ? "watch" : "attention");
  }
  const spend = cogs + operatingExpense;
  if (payables.hasCurrent && spend > 0) {
    const value = (payables.current / spend) * 30;
    push("dpo", "Days payable outstanding", `${Math.round(value)} days`, `It takes about ${Math.round(value)} days on average to pay suppliers.`, value <= 60 ? "strong" : "watch");
  }
  if (Number.isFinite(inventory) && inventory > 0 && cogs > 0) {
    const value = (inventory / cogs) * 30;
    push("inventory-days", "Inventory days", `${Math.round(value)} days`, `Inventory on hand covers about ${Math.round(value)} days of cost of goods sold.`, value <= 30 ? "strong" : value <= 60 ? "watch" : "attention");
  }
  if (currentAssets.hasCurrent && currentLiabilities.hasCurrent) {
    const value = currentAssets.current - currentLiabilities.current;
    push("working-capital", "Working capital", currency.format(Math.round(value)), value >= 0 ? "Short-term resources exceed short-term obligations." : "Short-term obligations exceed short-term resources.", value >= 0 ? "strong" : "attention");
  }
  return { ratios, unknowns };
}

function pnlRevenueAccountRows(pnlRows: ReportNode[], incomeSectionIndex: number): ReportNode[] {
  const cogsSectionIndex = pnlRows.findIndex((row, index) =>
    index > incomeSectionIndex && /^(cost of goods sold|cost of sales|cost of revenue)$/.test(clean(row.label))
  );
  const nextSectionIndex = pnlRows.findIndex((row, index) => index > incomeSectionIndex && row.type === "Section");
  const revenueSectionEnd = [cogsSectionIndex, nextSectionIndex].filter((index) => index > incomeSectionIndex).sort((a, b) => a - b)[0];
  return incomeSectionIndex >= 0
    ? pnlRows.slice(incomeSectionIndex + 1, revenueSectionEnd).filter((row) =>
        row.type !== "Section" &&
        row.label &&
        isUsableDetailLabel(row.label) &&
        !/^total|^net income|^net operating income|^gross profit|^income$/i.test(row.label)
      )
    : [];
}

function formatCashAsOfDate(periodLabel: string, live: boolean): string {
  if (live) {
    const now = new Date();
    return `as of ${SHORT_MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }
  const match = periodLabel.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (!match) return `as of ${periodLabel}`;
  const monthIndex = SHORT_MONTHS.findIndex((month) => month.toLowerCase() === match[1].toLowerCase());
  if (monthIndex < 0) return `as of ${periodLabel}`;
  return `as of ${SHORT_MONTHS[monthIndex]} ${new Date(Number(match[2]), monthIndex + 1, 0).getDate()}, ${match[2]}`;
}

function buildKpiBreakdowns(args: {
  pnlRows: ReportNode[];
  activePeriods: string[];
  activeRevenue: number[];
  activeCogs: number[];
  activeGrossProfit: number[];
  balanceRows: ReportNode[];
  balancePeriods: string[];
  cashByPeriod: Map<string, number>;
  inventoryByPeriod: Map<string, number>;
  netIncome: number[] | null;
}): KpiBreakdowns {
  const { pnlRows, activePeriods, activeRevenue, activeCogs, activeGrossProfit, balanceRows, balancePeriods, cashByPeriod, netIncome } = args;
  const currentIndex = activePeriods.length - 1;
  const previousIndex = currentIndex - 1;
  if (currentIndex < 0) return {};
  const periodLabel = activePeriods[currentIndex];
  const previousPeriodLabel = previousIndex >= 0 ? activePeriods[previousIndex] : null;
  const currentRevenue = activeRevenue[currentIndex] || 0;
  const previousRevenue = previousIndex >= 0 ? activeRevenue[previousIndex] || 0 : 0;

  const incomeSectionIndex = pnlRows.findIndex((row) =>
    row.type === "Section" &&
    (/^(income|revenue)$/.test(clean(row.label)) || /^income$|^revenue$/.test(clean(row.group)))
  );
  const revenueRows = pnlRevenueAccountRows(pnlRows, incomeSectionIndex)
    .map((row) => ({
      label: row.label,
      current: row.values[currentIndex] || 0,
      previous: previousIndex >= 0 ? row.values[previousIndex] || 0 : 0,
    }))
    .filter((row) => row.current !== 0 || row.previous !== 0)
    .sort((a, b) => b.current - a.current);

  const revenueInsight = revenueRows.length === 1
    ? "Revenue " + (currentRevenue >= previousRevenue ? "grew " : "slipped ") + currency.format(Math.abs(currentRevenue - previousRevenue)) + " from " + (previousPeriodLabel || "the prior period") + " on " + revenueRows[0].label + " — with a single revenue stream, every dollar of the change is explained here."
    : revenueRows.length
      ? revenueRows[0].label + " is the largest reported revenue stream at " + currency.format(revenueRows[0].current) + "; the breakdown shows the complete-month mix."
      : "No revenue streams were reported for the latest complete month.";

  const currentCogs = activeCogs[currentIndex] || 0;
  const previousCogs = previousIndex >= 0 ? activeCogs[previousIndex] || 0 : 0;
  const currentGrossProfit = activeGrossProfit[currentIndex] || 0;
  const previousGrossProfit = previousIndex >= 0 ? activeGrossProfit[previousIndex] || 0 : 0;
  const currentMargin = currentRevenue ? (currentGrossProfit / currentRevenue) * 100 : 0;
  const marginInsight = currentCogs === 0
    ? "Gross margin is " + formatPercent(currentMargin) + " because no COGS is recorded in " + periodLabel + "."
    : "Gross margin is " + formatPercent(currentMargin) + " based on reported revenue of " + currency.format(currentRevenue) + " and COGS of " + currency.format(currentCogs) + ".";

  const liquidCashPattern = [/^checking$/, /^savings$/, /^cash$/, /^cash on hand$/, /^undeposited funds$/];
  const currentBalanceIndex = balancePeriods.indexOf(periodLabel);
  const previousBalanceIndex = previousPeriodLabel ? balancePeriods.indexOf(previousPeriodLabel) : -1;
  const cashRows = balanceRows
    .filter((row) => row.type !== "Section" && liquidCashPattern.some((pattern) => pattern.test(clean(row.label))))
    .map((row) => ({
      label: row.label,
      current: currentBalanceIndex >= 0 ? row.values[currentBalanceIndex] || 0 : 0,
      previous: previousBalanceIndex >= 0 ? row.values[previousBalanceIndex] || 0 : 0,
    }))
    .filter((row) => isUsableDetailLabel(row.label) && (row.current !== 0 || row.previous !== 0))
    .sort((a, b) => Math.abs(b.current) - Math.abs(a.current));

  const inventoryPattern = [/^inventory asset$/, /^inventory$/, /^total inventory asset$/, /^total inventory$/];
  const inventoryRows = balanceRows
    .filter((row) => row.type !== "Section" && inventoryPattern.some((pattern) => pattern.test(clean(row.label))))
    .map((row) => ({
      label: row.label,
      current: currentBalanceIndex >= 0 ? row.values[currentBalanceIndex] || 0 : 0,
      previous: previousBalanceIndex >= 0 ? row.values[previousBalanceIndex] || 0 : 0,
    }))
    .filter((row) => isUsableDetailLabel(row.label) && (row.current !== 0 || row.previous !== 0))
    .sort((a, b) => Math.abs(b.current) - Math.abs(a.current));

  const currentCash = cashByPeriod.get(periodLabel) ?? 0;
  const previousCash = previousPeriodLabel ? cashByPeriod.get(previousPeriodLabel) ?? 0 : 0;
  const cashDelta = currentCash - previousCash;

  // Keep the newer balance-sheet column available only as a secondary live note.
  const latestBalanceLabel = balancePeriods[balancePeriods.length - 1] || periodLabel;
  const hasNewerLiveCashColumn =
    latestBalanceLabel !== periodLabel && cashByPeriod.has(latestBalanceLabel);
  const liveCashLabel = hasNewerLiveCashColumn ? latestBalanceLabel : periodLabel;
  const liveCash = cashByPeriod.get(liveCashLabel) ?? currentCash;
  const liveCashChange = liveCash - currentCash;
  const liveCashChangePct = currentCash === 0 ? Number.NaN : (liveCashChange / Math.abs(currentCash)) * 100;
  const currentNetIncome = netIncome?.[currentIndex];
  const cashInsight = Number.isFinite(currentNetIncome) && Math.abs(cashDelta - (currentNetIncome as number)) < 1
    ? "Cash grew " + currency.format(Math.abs(cashDelta)) + " in " + periodLabel + " — every dollar of reported profit landed in the bank."
    : "Cash " + (cashDelta >= 0 ? "grew " : "declined ") + currency.format(Math.abs(cashDelta)) + " in " + periodLabel + ". The account breakdown shows where the reported cash position sits.";

  return {
    revenue: { title: "By revenue stream", periodLabel, variant: "bars", rows: revenueRows, insight: revenueInsight },
    margin: {
      title: "Margin walk",
      periodLabel,
      variant: "walk",
      rows: [
        { label: "Revenue", current: currentRevenue, previous: previousRevenue },
        { label: "Less: COGS", current: currentCogs, previous: previousCogs },
        { label: "= Gross profit", current: currentGrossProfit, previous: previousGrossProfit },
      ],
      insight: marginInsight,
    },
    cash: {
      title: "By account",
      periodLabel,
      variant: "bars",
      rows: cashRows,
      insight: cashInsight,
    },
    inventory: {
      title: "By account",
      periodLabel,
      variant: "bars",
      rows: inventoryRows,
      insight: inventoryRows.length
        ? "Inventory reported across " + inventoryRows.length + " account" + (inventoryRows.length === 1 ? "" : "s") + " for " + periodLabel + "."
        : "No inventory balances reported for " + periodLabel + ".",
    },
  };
}

function buildManagementQuestions(
  detailReports: Record<string, any>,
  pnlRows: ReportNode[],
  pnlPeriods: string[],
  context: {
    revenue: number;
    previousRevenue: number;
    revenueChange: number;
    currentExpense: number;
    previousExpense: number;
    expenseChange: number;
    currentCash: number;
    previousCash: number;
    cashChange: number;
    currentInventory: number;
    previousInventory: number;
    inventoryChange: number;
    marginChange: number;
  },
): ManagementQuestion[] {
  const questions: ManagementQuestion[] = [];

  const customers = topReportRows(detailReports.incomeByCustomer, 3);
  const customerTotal = customers.reduce((sum, row) => sum + Math.abs(row.value), 0);
  if (customers.length && customerTotal > 0) {
    const top = customers[0];
    const share = (Math.abs(top.value) / customerTotal) * 100;
    questions.push({
      category: "Revenue",
      question: `Which customers are driving the current revenue mix? ${top.label} is the largest reported customer at ${currency.format(top.value)}, representing about ${share.toFixed(0)}% of the top customers returned by QuickBooks.`,
    });
  } else if (Number.isFinite(context.revenueChange)) {
    const incomeSectionIndex = pnlRows.findIndex((row) =>
      row.type === "Section" &&
      (/^(income|revenue)$/.test(clean(row.label)) || /^income$|^revenue$/.test(clean(row.group)))
    );
    const revenueAccountRows = pnlRevenueAccountRows(pnlRows, incomeSectionIndex);
    const revenueChanges = revenueAccountRows
      .map((row) => ({
        label: row.label,
        current: row.values[pnlPeriods.length - 1] || 0,
        previous: pnlPeriods.length > 1 ? row.values[pnlPeriods.length - 2] || 0 : 0,
      }))
      .map((row) => ({ ...row, change: row.current - row.previous }))
      .filter((row) => row.change !== 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    if (revenueChanges.length) {
      const top = revenueChanges[0];
      const accountValue = top.current;
      questions.push({
        category: "Revenue",
        question: `Revenue moved from ${currency.format(context.previousRevenue)} to ${currency.format(context.revenue)} (${formatPercent(context.revenueChange)}). ${top.label} is the largest current-period revenue stream at ${currency.format(accountValue)}. What changed in this revenue stream, and is the movement expected to continue?`,
      });
    } else {
      questions.push({
        category: "Revenue",
        question: `Revenue moved from ${currency.format(context.previousRevenue)} to ${currency.format(context.revenue)} (${formatPercent(context.revenueChange)}). What changed in customer volume, pricing, or mix to produce that movement?${!detailReports.incomeByCustomer ? " ClearCFO could not access customer-level QuickBooks detail, so we cannot identify which customers drove the change." : ""}`,
      });
    }
  }

  const vendors = topReportRows(detailReports.expenseByVendor, 3);
  if (vendors.length) {
    const top = vendors[0];
    questions.push({
      category: "Expenses",
      question: `Which vendor relationships are driving spending? ${top.label} is the largest reported vendor at ${currency.format(Math.abs(top.value))}; review whether the spend is recurring, necessary, or unusual versus prior periods.`,
    });
  }

  const expenseSectionIndex = pnlRows.findIndex((row) =>
    row.type === "Section" &&
    (/^expenses?$|^operating expenses?$/.test(clean(row.label)) || /^expenses?$|^operatingexpenses?$/.test(clean(row.group)))
  );
  const netIncomeIndex = pnlRows.findIndex((row, index) =>
    index > expenseSectionIndex && /^(net income|net operating income)$/.test(clean(row.label))
  );
  const expenseAccountRows = expenseSectionIndex >= 0
    ? pnlRows.slice(expenseSectionIndex + 1, netIncomeIndex > expenseSectionIndex ? netIncomeIndex : undefined)
        .filter((row) =>
          row.type !== "Section" &&
          row.label &&
          !/^total|^net income|^net operating income|^gross profit|^operating income|^payroll expenses?$|^expenses?$/i.test(row.label)
        )
    : [];
  const expenseChanges = expenseAccountRows
    .map((row) => ({
      label: row.label,
      current: row.values[pnlPeriods.length - 1] || 0,
      previous: pnlPeriods.length > 1 ? row.values[pnlPeriods.length - 2] || 0 : 0,
    }))
    .map((row) => ({ ...row, change: row.current - row.previous }))
    .filter((row) => row.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  if (expenseChanges.length) {
    const top = expenseChanges[0];
    questions.push({
      category: "Profitability",
      question: `Operating expenses moved from ${currency.format(context.previousExpense)} to ${currency.format(context.currentExpense)} (${formatPercent(context.expenseChange)}). ${top.label} is the largest current-period expense at ${currency.format(Math.abs(top.current))}. Is this a recurring cost, a one-time expense, or something that needs to be reviewed?`,
    });
  } else if (Number.isFinite(context.expenseChange)) {
    questions.push({
      category: "Expenses",
      question: `Operating expenses moved from ${currency.format(context.previousExpense)} to ${currency.format(context.currentExpense)} (${formatPercent(context.expenseChange)}). What accounts or costs should management review to understand the change?`,
    });
  }

  const receivables = topReportRows(detailReports.agedReceivables, 3);
  if (receivables.length) {
    const top = receivables[0];
    questions.push({
      category: "Cash",
      question: `Which receivables need attention? ${top.label} is the largest customer balance returned in the aged-receivables detail at ${currency.format(Math.abs(top.value))}; review age and collection timing before relying on the balance as available cash.`,
    });
  } else if (context.cashChange < 0) {
    questions.push({
      category: "Cash",
      question: `Cash declined from ${currency.format(context.previousCash)} to ${currency.format(context.currentCash)} (${formatPercent(context.cashChange)}). How much of the decline came from receivables, inventory, payables, debt, capital spending, or owner distributions?`,
    });
  }

  const inventory = topReportRows(detailReports.inventoryValuation, 3);
  if (inventory.length) {
    const top = inventory[0];
    questions.push({
      category: "Inventory",
      question: `What is tying up the most inventory cash? ${top.label} has the largest reported inventory value at ${currency.format(Math.abs(top.value))}; compare its value with recent sales velocity and aging.`,
    });
  } else if (context.inventoryChange > 0 || context.marginChange < -2) {
    questions.push({
      category: "Inventory",
      question: `Inventory is ${currency.format(context.currentInventory)} and its period-over-period change is ${Number.isFinite(context.inventoryChange) ? formatPercent(context.inventoryChange) : "unavailable"}. How does inventory movement relate to the ${Number.isFinite(context.marginChange) ? Math.abs(context.marginChange).toFixed(1) : "current"}-point gross-margin change and recent sales?`,
    });
  }

  return questions.slice(0, 5);
}

// Indirect-method operating cash flow bridge for the latest synced period.
// Starts from net income and adjusts for working-capital changes. The
// "other operating changes" line is the plug that reconciles the bridge to
// the reported change in cash — it is labeled as such, never hidden.
function buildCashFlow(args: {
  pnlRows: ReportNode[];
  pnlPeriods: string[];
  currentLabel: string;
  balanceRows: ReportNode[];
  balancePeriods: string[];
  previousLabel: string | null;
  currentCash: number;
  previousCash: number;
  cashKnown: boolean;
}): { bridge: CashFlowBridge | null; unknowns: string[] } {
  const unknowns: string[] = [];
  const { pnlRows, pnlPeriods, currentLabel, balanceRows, balancePeriods, previousLabel, currentCash, previousCash, cashKnown } = args;
  const netRow = pnlRows.find((row) => row.type === "Section" && clean(row.label) === "net income");
  const netSeries = netRow ? netRow.values : pickSeries(pnlRows, [/^netincome$/], [/^net income$/], pnlPeriods.length);
  const netByLabel = new Map<string, number>();
  if (netSeries) pnlPeriods.forEach((label, index) => { if (Number.isFinite(netSeries[index])) netByLabel.set(label, netSeries[index]); });
  const netIncome = netByLabel.get(currentLabel);
  if (netIncome === undefined) {
    unknowns.push("QuickBooks did not return a net income figure, so ClearCFO could not build the cash flow bridge.");
    return { bridge: null, unknowns };
  }
  const point = (labels: RegExp[]) => balancePoint(balanceRows, balancePeriods, [], labels, currentLabel, previousLabel);
  const receivables = point([/^accounts receivable$/, /^total accounts receivable$/]);
  const payables = point([/^accounts payable$/, /^total accounts payable$/]);
  const inventoryPt = point([/^inventory asset$/, /^inventory$/, /^total inventory asset$/, /^total inventory$/]);
  const lines: CashFlowLine[] = [{ label: "Net income", value: netIncome }];
  const both = (p: BalancePoint) => p.hasCurrent && p.hasPrevious;
  if (both(receivables)) {
    const delta = receivables.current - receivables.previous;
    lines.push({ label: delta >= 0 ? "Increase in accounts receivable" : "Decrease in accounts receivable", value: -delta });
  }
  if (both(inventoryPt)) {
    const delta = inventoryPt.current - inventoryPt.previous;
    lines.push({ label: delta >= 0 ? "Increase in inventory" : "Decrease in inventory", value: -delta });
  }
  if (both(payables)) {
    const delta = payables.current - payables.previous;
    lines.push({ label: delta >= 0 ? "Increase in accounts payable" : "Decrease in accounts payable", value: delta });
  }
  const cashChange = cashKnown ? currentCash - previousCash : null;
  const subtotal = lines.reduce((sum, line) => sum + line.value, 0);
  if (cashChange !== null) lines.push({ label: "Other operating changes", value: cashChange - subtotal });
  const operatingCashFlow = lines.reduce((sum, line) => sum + line.value, 0);
  return { bridge: { lines, operatingCashFlow, cashChange }, unknowns };
}

export function buildQuickBooksBriefing(profitAndLoss: any, balanceSheet: any, companyName: string | null, detailReports: Record<string, any> = {}): BriefingData {
  const pnlPeriods = reportPeriods(profitAndLoss);
  const pnlRows = collectRows(profitAndLoss?.Rows, pnlPeriods.length);
  if (!pnlPeriods.length) throw new Error("ClearCFO received a QuickBooks P&L report, but no reporting periods were returned.");

  const revenue = pickSeries(pnlRows, [/^income$/, /^revenue$/, /^sales$/], [/^total income$/, /^total revenue$/, /^net revenue$/, /^total sales$/, /^net sales$/], pnlPeriods.length) || sumDataRows(pnlRows, [/revenue/, /^sales$/], pnlPeriods.length);
  const cogs = pickSeries(pnlRows, [/^cogs$/, /^costofgoodssold$/, /^costofsales$/, /^costofrevenue$/], [/^total cost of goods sold$/, /^cost of goods sold$/, /^cost of sales$/, /^cost of revenue$/], pnlPeriods.length) || Array.from({ length: pnlPeriods.length }, () => 0);
  const expenses = pickSeries(pnlRows, [/^expenses$/, /^operatingexpenses$/], [/^total operating expenses$/, /^operating expenses$/, /^total expenses$/, /^expenses$/], pnlPeriods.length) || sumDataRows(pnlRows, [/expense/], pnlPeriods.length);
  const netIncome = pickSeries(pnlRows, [/^netincome$/, /^netoperatingincome$/], [/^net income$/, /^net operating income$/], pnlPeriods.length);
  const grossProfit = pnlPeriods.map((_, index) => (revenue[index] || 0) - (cogs[index] || 0));

  const dataIndex = latestPopulatedIndex([revenue, cogs, expenses]);
  if (dataIndex < 0) throw new Error("QuickBooks is connected, but ClearCFO could not identify a non-zero income or expense period in the returned P&L.");

  let endIndex = dataIndex;
  if (endIndex > 0 && isPartialCurrentMonth(pnlPeriods[endIndex])) endIndex -= 1;
  const activePeriods = pnlPeriods.slice(0, endIndex + 1);
  const activeRevenue = revenue.slice(0, endIndex + 1);
  const activeCogs = cogs.slice(0, endIndex + 1);
  const activeExpenses = expenses.slice(0, endIndex + 1);
  const activeGrossProfit = grossProfit.slice(0, endIndex + 1);

  const balancePeriods = reportPeriods(balanceSheet);
  const balanceRows = collectRows(balanceSheet?.Rows, balancePeriods.length);
  // Use account-level liquid cash first. QuickBooks can expose a "Total Bank
  // Accounts" row whose value does not reliably equal the sum of the account
  // rows returned underneath it. ClearCFO should therefore calculate Cash
  // Position from the actual accounts and only use a total as a fallback.
  const cashAccounts = balancePeriods.length
    ? sumDataRows(balanceRows, [/^checking$/, /^savings$/, /^cash$/, /^cash on hand$/, /^undeposited funds$/], balancePeriods.length)
    : [];
  const cashTotal = balancePeriods.length
    ? findAnyByLabel(balanceRows, [/^total bank accounts$/, /^total cash and cash equivalents$/, /^total cash and bank$/, /^total cash$/])
    : null;
  const cash = cashAccounts.some((value) => Number.isFinite(value) && value !== 0)
    ? cashAccounts
    : cashTotal?.values?.some((value) => Number.isFinite(value) && value !== 0)
      ? cashTotal.values.slice(0, balancePeriods.length)
      : null;
  const inventory = balancePeriods.length ? pickSeries(balanceRows, [/^inventoryasset$/, /^inventory$/], [/^total inventory asset$/, /^total inventory$/, /^inventory asset$/, /^inventory$/], balancePeriods.length) : null;
  const cashSeries = cash;

  // Align balance-sheet values to P&L periods by period LABEL, not position.
  // A shorter (or differently ordered) balance series must never fabricate
  // changes: periods with no balance-sheet value are NaN (unavailable), never 0.
  const cashByPeriod = new Map<string, number>();
  if (cashSeries) balancePeriods.forEach((label, index) => { if (Number.isFinite(cashSeries[index])) cashByPeriod.set(label, cashSeries[index]); });
  const inventoryByPeriod = new Map<string, number>();
  if (inventory) balancePeriods.forEach((label, index) => { if (Number.isFinite(inventory[index])) inventoryByPeriod.set(label, inventory[index]); });
  const cashAligned = activePeriods.map((label) => (cashByPeriod.has(label) ? cashByPeriod.get(label) as number : Number.NaN));
  const inventoryAligned = activePeriods.map((label) => (inventoryByPeriod.has(label) ? inventoryByPeriod.get(label) as number : Number.NaN));
  const current = activePeriods.length - 1;
  const previous = current - 1;

  const currentRevenue = activeRevenue[current] || 0;
  const previousRevenue = previous >= 0 ? activeRevenue[previous] || 0 : 0;
  const currentGrossProfit = activeGrossProfit[current] || 0;
  const previousGrossProfit = previous >= 0 ? activeGrossProfit[previous] || 0 : 0;
  const currentCash = Number.isFinite(cashAligned[current]) ? cashAligned[current] : 0;
  const previousCash = previous >= 0 && Number.isFinite(cashAligned[previous]) ? cashAligned[previous] : 0;
  const currentInventory = Number.isFinite(inventoryAligned[current]) ? inventoryAligned[current] : 0;
  const previousInventory = previous >= 0 && Number.isFinite(inventoryAligned[previous]) ? inventoryAligned[previous] : 0;
  const currentExpense = activeExpenses[current] || 0;
  const previousExpense = previous >= 0 ? activeExpenses[previous] || 0 : 0;

  const revenueChange = previous >= 0 ? changePercent(currentRevenue, previousRevenue) : Number.NaN;
  const grossMargin = currentRevenue ? (currentGrossProfit / currentRevenue) * 100 : 0;
  const previousMargin = previous >= 0 && previousRevenue ? (previousGrossProfit / previousRevenue) * 100 : Number.NaN;
  const marginChange = Number.isFinite(previousMargin) ? grossMargin - previousMargin : Number.NaN;
  const cashChange = previous >= 0 && Number.isFinite(cashAligned[current]) && Number.isFinite(cashAligned[previous]) ? changePercent(currentCash, previousCash) : Number.NaN;
  const inventoryChange = previous >= 0 && Number.isFinite(inventoryAligned[current]) && Number.isFinite(inventoryAligned[previous]) ? changePercent(currentInventory, previousInventory) : Number.NaN;
  const expenseChange = previous >= 0 ? changePercent(currentExpense, previousExpense) : Number.NaN;
  const previousCogs = previous >= 0 ? activeCogs[previous] || 0 : 0;
  const currentCogsValue = activeCogs[current] || 0;
  const drivers = buildDrivers(revenueChange, marginChange, cashChange, inventoryChange, expenseChange, previousCogs, currentCogsValue, previousExpense, currentExpense, previousCash, currentCash, previousInventory, currentInventory, currentRevenue, previousRevenue);
  const classificationReview = buildClassificationReview(pnlRows, currentRevenue, currentCogsValue, currentExpense);
  const pnlReconciliation = findPnlReconciliationIssue(pnlRows, activePeriods, activeRevenue, activeCogs, activeExpenses, netIncome);
  const ratioResult = buildRatios({
    balanceRows,
    balancePeriods,
    currentLabel: activePeriods[current],
    previousLabel: previous >= 0 ? activePeriods[previous] : null,
    revenue: currentRevenue,
    cogs: currentCogsValue,
    operatingExpense: currentExpense,
    inventory: Number.isFinite(inventoryAligned[current]) ? inventoryAligned[current] : Number.NaN,
  });
  const cashFlowResult = buildCashFlow({
    pnlRows,
    pnlPeriods,
    currentLabel: activePeriods[current],
    balanceRows,
    balancePeriods,
    previousLabel: previous >= 0 ? activePeriods[previous] : null,
    currentCash,
    previousCash,
    cashKnown: Number.isFinite(cashAligned[current]) && (previous < 0 || Number.isFinite(cashAligned[previous])),
  });
  const alerts = buildAlerts(revenueChange, cashChange, inventoryChange, expenseChange);
  const detailed = buildDetailedDrivers(detailReports);
  const reconciliationDriver: FinancialDriver | null = pnlReconciliation
    ? {
        id: "pnl-reconciliation",
        category: "Unusual Spend",
        title: "P&L totals need reconciliation",
        observation: `QuickBooks reported net income of ${currency.format(pnlReconciliation.reportedNetIncome)} for ${pnlReconciliation.period}, while the reported revenue, COGS, expenses, and other income/expense imply ${currency.format(pnlReconciliation.expectedNetIncome)}. ClearCFO is not changing the source value.`,
        evidence: [
          `Period: ${pnlReconciliation.period}`,
          `Reported net income: ${currency.format(pnlReconciliation.reportedNetIncome)}`,
          `Calculated net income: ${currency.format(pnlReconciliation.expectedNetIncome)}`,
          `Unexplained variance: ${currency.format(Math.abs(pnlReconciliation.variance))}`,
        ],
        direction: "watch",
        severity: Math.abs(pnlReconciliation.variance) >= 5000 ? "High" : "Medium",
        impact: Math.min(10, Math.max(2, Math.round(Math.abs(pnlReconciliation.variance) / 5000))),
        confidence: 0.98,
        managementQuestion: "Why does the QuickBooks P&L not reconcile for this period, and which source line should be used before relying on the result?",
        estimatedImpact: Math.abs(pnlReconciliation.variance),
      }
    : null;
  const kpiBreakdowns = buildKpiBreakdowns({ pnlRows, activePeriods, activeRevenue, activeCogs, activeGrossProfit, balanceRows, balancePeriods, cashByPeriod, inventoryByPeriod, netIncome });
  const latestBalanceLabel = balancePeriods[balancePeriods.length - 1] || activePeriods[current];
  const hasNewerLiveCashColumn = latestBalanceLabel !== activePeriods[current] && cashByPeriod.has(latestBalanceLabel);
  const liveCashLabel = hasNewerLiveCashColumn ? latestBalanceLabel : activePeriods[current];
  const liveCash = cashByPeriod.get(liveCashLabel) ?? currentCash;
  const liveCashChange = liveCash - currentCash;
  const liveCashChangePct = currentCash === 0 ? Number.NaN : (liveCashChange / Math.abs(currentCash)) * 100;
  const liveCashNote = hasNewerLiveCashColumn
    ? "Live: " + currency.format(liveCash) + " · " + formatCashAsOfDate(liveCashLabel, true)
    : undefined;
  const liveCashAsOf = hasNewerLiveCashColumn
    ? formatCashAsOfDate(liveCashLabel, true).replace(/^as of /, "")
    : null;

  const mergedDrivers = [...detailed.drivers, ...drivers, ...(classificationReview.driver ? [classificationReview.driver] : []), ...(reconciliationDriver ? [reconciliationDriver] : [])].sort((a, b) => b.impact - a.impact);

  const trendSeries: Series[] = [
    { name: "Revenue", values: activeRevenue.slice(-12), periods: activePeriods.slice(-12) },
    { name: "Gross Margin", values: activePeriods.slice(-12).map((_, index) => { const sourceIndex = Math.max(0, activePeriods.length - Math.min(12, activePeriods.length)) + index; return activeRevenue[sourceIndex] ? (activeGrossProfit[sourceIndex] / activeRevenue[sourceIndex]) * 100 : 0; }), periods: activePeriods.slice(-12) },
    { name: "Operating Expenses", values: activeExpenses.slice(-12), periods: activePeriods.slice(-12) },
    { name: "Cash Position", values: cashAligned.slice(-12), periods: activePeriods.slice(-12) },
    { name: "Inventory", values: inventoryAligned.slice(-12), periods: activePeriods.slice(-12) },
  ];
  const nonEmptySeries = trendSeries.filter((series) => series.values.length && series.values.some((value) => value !== 0));

  return {
    companyName: companyName || "Your business",
    revenue: currentRevenue,
    revenueChange,
    grossMargin,
    marginChange,
    cash: currentCash,
    cashChange,
    liveCash,
    liveCashChange,
    liveCashChangePct,
    liveCashAsOf,
    cashAsOfDate: formatCashAsOfDate(activePeriods[current], false).replace(/^as of /, ""),
    liveCashNote,
    inventory: currentInventory,
    inventoryChange,
    operatingExpense: currentExpense,
    previousOperatingExpense: previousExpense,
    attention: mergedDrivers.length,
    alerts,
    recommendation: mergedDrivers[0]?.observation || "Review the latest QuickBooks financial signals and determine the most important management action.",
    impact: mergedDrivers[0]?.impact || 0,
    impactReason: mergedDrivers[0]?.observation || "No major exceptions were detected.",
    trend: trendSeries[0].values,
    periods: trendSeries[0].periods,
    health: mergedDrivers.some((driver) => driver.severity === "High") ? "attention" : mergedDrivers.length ? "watch" : "strong",
    confidence: nonEmptySeries.length >= 3 ? 0.92 : 0.82,
    source: "quickbooks",
    drivers: mergedDrivers,
    // Driver "current period" must be the latest COMPLETE month. activePeriods excludes
    // the partial current month; the full pnlPeriods made drivers read the empty
    // partial month ($0) as current, e.g. "largest current-period revenue stream at $0".
    managementQuestions: buildManagementQuestions(detailReports, pnlRows, activePeriods, { revenue: currentRevenue, previousRevenue, revenueChange, currentExpense, previousExpense, expenseChange, currentCash, previousCash, cashChange, currentInventory, previousInventory, inventoryChange, marginChange }),
    relationships: mergedDrivers.map((driver) => driver.observation),
    detailDrivers: detailed.details,
    trendInsights: [],
    trendSeries,
    mtdComparison: buildDayMatchedComparison(detailReports.mtdCurrent, detailReports.mtdPrevious),
    ratios: ratioResult.ratios,
    cashFlow: cashFlowResult.bridge,
    kpiBreakdowns,
    unknowns: [
      ...cashFlowResult.unknowns,
      ...ratioResult.unknowns,
      ...(cashSeries ? [] : ["QuickBooks did not return a cash balance series for the requested periods."]),
      ...(inventory ? [] : ["QuickBooks did not return an inventory balance series for the requested periods."]),
      ...(classificationReview.unknown ? [classificationReview.unknown] : []),
      ...detailed.unknowns,
    ],
  };
}
