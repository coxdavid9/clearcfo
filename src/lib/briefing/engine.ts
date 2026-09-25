import * as XLSX from "xlsx";
import { detectExpenseSpikeRecovery } from "../../lib/scenario-detection";

export type BriefingData = {
  companyName: string;
  revenue: number;
  revenueChange: number;
  grossMargin: number;
  marginChange: number;
  cash: number;
  cashChange: number;
  liveCash?: number;
  liveCashChange?: number;
  liveCashChangePct?: number;
  liveCashAsOf?: string | null;
  cashAsOfDate?: string;
  dataAvailability?: { cash: boolean; inventory: boolean };
  cashDeltaLabel?: string;
  liveCashNote?: string;

  inventory: number;
  inventoryChange: number;
  operatingExpense?: number;
  previousOperatingExpense?: number;
  attention: number;
  alerts: string[];
  recommendation: string;
  impact: number;
  impactReason: string;
  trend: number[];
  periods: string[];
  health: string;
  confidence: number;
  source: "demo" | "upload" | "quickbooks";
  drivers: FinancialDriver[];
  managementQuestions?: Array<{ category: string; question: string }>;
  relationships: string[];
  detailDrivers: DetailDriver[];
  trendInsights: string[];
  trendSeries: { name: string; values: number[]; periods: string[] }[];
  unknowns: string[];
  mtdComparison?: MtdComparison | null;
  ratios?: FinancialRatio[];
  cashFlow?: CashFlowBridge | null;
  kpiBreakdowns?: KpiBreakdowns;
};

// Balance-sheet health ratios for the latest synced period. All values are
// computed deterministically from synced QuickBooks data — never estimated.
export type FinancialRatio = {
  id: string;
  label: string;
  value: string;
  interpretation: string;
  health: "strong" | "watch" | "attention";
};

// Indirect-method operating cash flow bridge: starts from net income and
// adjusts for working-capital changes. The "other" line is the plug that
// reconciles the bridge to the reported change in cash.
export type CashFlowLine = { label: string; value: number };
export type CashFlowBridge = {
  lines: CashFlowLine[];
  operatingCashFlow: number;
  cashChange: number | null;
};

export type KpiBreakdownRow = { label: string; current: number; previous: number };
export type KpiBreakdown = {
  title: string;
  periodLabel: string;
  asOfLabel?: string;
  variant: "bars" | "walk";
  rows: KpiBreakdownRow[];
  insight: string;
};
export type KpiBreakdowns = {
  revenue?: KpiBreakdown;
  margin?: KpiBreakdown;
  cash?: KpiBreakdown;
  inventory?: KpiBreakdown;
};

// Day-matched month-to-date comparison (e.g. Sep 1–18 vs Aug 1–18). Built
// from daily-granularity P&L data. Sums are computed from reported daily
// values only — never projected or filled in.
export type MtdMetricComparison = {
  current: number;
  previous: number;
  change: number;
};

export type MtdComparison = {
  currentLabel: string;
  previousLabel: string;
  revenue: MtdMetricComparison;
  grossProfit: MtdMetricComparison;
  operatingExpense: MtdMetricComparison;
  netIncome: MtdMetricComparison;
};

export type DetailDriver = {
  name: string;
  current: number;
  previous: number;
  change: number;
  percentChange: number;
  direction: "up" | "down";
  impact: number;
  contributionPct?: number;
  category?: "Revenue" | "Operating Expense";
};

export type FinancialDriver = {
  id: string;
  category: "Revenue" | "Margin" | "Cash" | "Inventory" | "Operating Expense" | "Unusual Spend" | "MRO";
  title: string;
  observation: string;
  evidence: string[];
  direction: "up" | "down" | "mixed" | "watch";
  severity: "High" | "Medium" | "Watch";
  impact: number;
  confidence: number;
  managementQuestion: string;
  estimatedImpact?: number;
};

export type AIAction = {
  title: string;
  rationale: string;
  priority: "High" | "Medium" | "Watch";
  score?: number;
  estimatedImpact?: number;
};

export type AIAnalysis = {
  executiveSummary: string;
  primaryDriver: string;
  whyItMatters: string;
  managementQuestion: string;
  recommendedAction: string;
  priority: "High" | "Medium" | "Watch";
  confidence: number;
  evidence: string[];
  actions: AIAction[];
  unknowns?: string[];
};

export type ExpandedMetric =
  | "revenue"
  | "margin"
  | "cash"
  | "inventory"
  | "attention"
  | null;

export const demoDrivers: FinancialDriver[] = [
  {
    id: "inventory-growth",
    category: "Inventory",
    title: "Inventory is outpacing revenue",
    observation: "Inventory has grown faster than revenue, increasing working-capital pressure.",
    evidence: ["Inventory growth: +14.2%", "Revenue growth: +12.4%", "Inventory: $587,000"],
    direction: "up",
    severity: "Medium",
    impact: 3,
    confidence: 0.91,
    managementQuestion: "What is driving the inventory build, and how quickly can we convert it to sales?",
  },
  {
    id: "opex-growth",
    category: "Operating Expense",
    title: "Operating expenses are rising faster than revenue",
    observation: "Operating expenses are increasing faster than revenue, putting pressure on operating profit.",
    evidence: ["Operating expense growth: +9.8%", "Revenue growth: +6.3%"],
    direction: "up",
    severity: "Medium",
    impact: 4,
    confidence: 0.88,
    managementQuestion: "Which expense categories are driving the increase, and which are discretionary?",
  },
  {
    id: "cash-pressure",
    category: "Cash",
    title: "Cash is under pressure",
    observation: "Cash has declined while operating requirements remain elevated.",
    evidence: ["Cash change: -8.4%", "Current cash: $412,000"],
    direction: "down",
    severity: "High",
    impact: 5,
    confidence: 0.94,
    managementQuestion: "What near-term cash commitments could create additional pressure?",
  },
];

export const demoData: BriefingData = {
  companyName: "Your Business",
  revenue: 1245000,
  revenueChange: 12.4,
  grossMargin: 31.8,
  marginChange: -2.1,
  cash: 412000,
  cashChange: -8.4,
  inventory: 587000,
  inventoryChange: 14.2,
  attention: 3,
  alerts: [
    "Operating expenses increased 9.8% while revenue increased 6.3%.",
    "Cash declined 8.4% from the prior period.",
    "Inventory increased 14.2%, outpacing revenue growth of 12.4%.",
  ],
  recommendation: "Protect cash while identifying the largest controllable operating expense increases.",
  impact: 5,
  impactReason: "Higher operating costs and lower cash reduce flexibility.",
  trend: [93000, 98000, 102000, 105000, 109000, 111000, 114000, 118000, 121000, 119000, 123000, 124500],
  periods: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
  health: "watch",
  confidence: 0.89,
  source: "demo",
  drivers: demoDrivers,
  relationships: ["Operating expense growth is outpacing revenue growth.", "Inventory growth is tying up additional working capital."],
  detailDrivers: [],
  trendInsights: ["Revenue has generally trended upward over the available period.", "Recent growth has slowed slightly."],
  trendSeries: [{ name: "Revenue", values: [93000, 98000, 102000, 105000, 109000, 111000, 114000, 118000, 121000, 119000, 123000, 124500], periods: ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"] }],
  unknowns: [],
};

export const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatPercentValue(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Number.isInteger(value) ? value : Number(value.toFixed(1))}%`;
}

export function percent(value: number): string {
  return formatPercentValue(value);
}

export function formatCurrency(value: number): string {
  return currency.format(Number.isFinite(value) ? value : 0);
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%(),]/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
}

function findSheet(workbook: XLSX.WorkBook, names: string[]): XLSX.WorkSheet | null {
  const normalized = names.map((name) => name.toLowerCase());
  for (const sheetName of workbook.SheetNames) {
    if (normalized.includes(sheetName.trim().toLowerCase())) return workbook.Sheets[sheetName];
  }
  return null;
}

function findHeaderIndex(rows: unknown[][], candidates: string[]): number {
  const normalized = candidates.map((candidate) => candidate.toLowerCase());
  return rows.findIndex((row) => row.some((cell) => normalized.includes(normalizeText(cell).toLowerCase())));
}

export function findPeriodHeaderIndex(rows: unknown[][]): number {
  const monthYearText = /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[ -]?\d{2,4}$/i;
  const numericMonthYear = /^(?:0?[1-9]|1[0-2])\/\d{2,4}$/;
  const isoMonth = /^\d{4}-\d{2}$/;
  const quarter = /^q[1-4][ -]?\d{2,4}$/i;
  const isPeriodLike = (cell: unknown): boolean => {
    if (cell instanceof Date && !Number.isNaN(cell.getTime())) return true;
    const text = normalizeText(cell);
    if (!text) return false;
    return monthYearText.test(text) || numericMonthYear.test(text) || isoMonth.test(text) || quarter.test(text);
  };
  const structuralIndex = rows.findIndex((row) => row.slice(1).filter(isPeriodLike).length >= 3);
  if (structuralIndex >= 0) return structuralIndex;
  return findHeaderIndex(rows, ["Month", "Date", "Period", "Account", "Metric", "Customer", "Vendor", "Balance"]);
}

function valueFromRow(row: unknown[], labelCandidates: string[]): number {
  const normalized = labelCandidates.map((candidate) => candidate.toLowerCase());
  const labelIndex = row.findIndex((cell) => normalized.includes(normalizeText(cell).toLowerCase()));
  if (labelIndex < 0) return 0;
  for (let i = row.length - 1; i > labelIndex; i -= 1) {
    const value = toNumber(row[i]);
    if (value !== 0) return value;
  }
  return 0;
}

function periodLabels(rows: unknown[][], headerIndex: number): string[] {
  if (headerIndex < 0) return [];
  return rows[headerIndex].slice(1).map((cell) => normalizeText(cell)).filter(Boolean);
}

function rowValues(row: unknown[], count: number): number[] {
  return row.slice(1, count + 1).map(toNumber);
}

function findDataRow(rows: unknown[][], patterns: RegExp[]): unknown[] | null {
  return rows.find((row) => patterns.some((pattern) => pattern.test(normalizeText(row[0])))) || null;
}

function changePercent(current: number, previous: number): number {
  // A percentage change is not meaningful when the prior period is zero or absent.
  // Return NaN (matching the QuickBooks implementation) so callers render
  // "comparison unavailable" instead of a fabricated 0%.
  if (previous === 0) return Number.NaN;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function safeTrend(values: number[], labels: string[]): { values: number[]; labels: string[] } {
  const length = Math.min(values.length, labels.length || values.length);
  return { values: values.slice(Math.max(0, values.length - length)), labels: labels.slice(Math.max(0, labels.length - length)) };
}

function buildDrivers(
  revenue: number,
  previousRevenue: number,
  revenueChange: number,
  marginChange: number,
  cash: number,
  previousCash: number,
  cashChange: number,
  inventory: number,
  previousInventory: number,
  inventoryChange: number,
  expense: number,
  previousExpense: number,
  expenseChange: number,
): FinancialDriver[] {
  const drivers: FinancialDriver[] = [];
  const expenseDelta = expense - previousExpense;
  const revenueDelta = revenue - previousRevenue;
  const cashDelta = cash - previousCash;
  const inventoryDelta = inventory - previousInventory;

  if (expenseChange > revenueChange + 2) {
    const usePercentage = Math.abs(previousExpense) >= 1000;
    const magnitude = Math.abs(expenseDelta);
    drivers.push({
      id: "opex-growth",
      category: "Operating Expense",
      title: "Operating expenses are rising faster than revenue",
      observation: usePercentage
        ? `Operating expenses increased ${formatPercentValue(expenseChange)} while revenue changed ${formatPercentValue(revenueChange)}.`
        : `Operating expenses increased ${formatCurrency(magnitude)} (${formatCurrency(previousExpense)} to ${formatCurrency(expense)}) while revenue increased ${formatCurrency(Math.abs(revenueDelta))} (${formatCurrency(previousRevenue)} to ${formatCurrency(revenue)}).`,
      evidence: [
        `Operating expenses: ${formatCurrency(previousExpense)} → ${formatCurrency(expense)} (${expenseDelta >= 0 ? "+" : ""}${formatCurrency(expenseDelta)})`,
        `Revenue: ${formatCurrency(previousRevenue)} → ${formatCurrency(revenue)} (${revenueDelta >= 0 ? "+" : ""}${formatCurrency(revenueDelta)})`,
        ...(usePercentage ? [`Operating expense change: ${formatPercentValue(expenseChange)}`, `Revenue change: ${formatPercentValue(revenueChange)}`] : []),
      ],
      direction: "up",
      severity: magnitude >= 10000 || expenseChange > 20 ? "High" : "Medium",
      impact: Math.min(10, Math.max(1, Math.round(Math.max(magnitude / 10000, Math.abs(revenueDelta) / 25000)))),
      confidence: 0.9,
      managementQuestion: "Which expense categories are driving the dollar increase, and which are recurring versus one-time?",
    });
  }
  if (cashChange < -5) {
    drivers.push({
      id: "cash-pressure",
      category: "Cash",
      title: "Cash is under pressure",
      observation: `Cash declined ${formatCurrency(Math.abs(cashDelta))} (${formatCurrency(previousCash)} to ${formatCurrency(cash)}) from the prior period.`,
      evidence: [`Cash: ${formatCurrency(previousCash)} → ${formatCurrency(cash)} (${cashDelta >= 0 ? "+" : ""}${formatCurrency(cashDelta)})`, `Cash change: ${formatPercentValue(cashChange)}`],
      direction: "down",
      severity: cashChange < -15 ? "High" : "Medium",
      impact: 5,
      confidence: 0.94,
      managementQuestion: "What near-term cash commitments could create additional pressure?",
    });
  }
  if (inventoryChange > revenueChange + 2) {
    drivers.push({
      id: "inventory-growth",
      category: "Inventory",
      title: "Inventory is outpacing revenue",
      observation: `Inventory increased ${formatCurrency(Math.abs(inventoryDelta))} (${formatCurrency(previousInventory)} to ${formatCurrency(inventory)}) while revenue changed ${formatCurrency(Math.abs(revenueDelta))} (${formatCurrency(previousRevenue)} to ${formatCurrency(revenue)}).`,
      evidence: [`Inventory: ${formatCurrency(previousInventory)} → ${formatCurrency(inventory)} (${inventoryDelta >= 0 ? "+" : ""}${formatCurrency(inventoryDelta)})`, `Revenue: ${formatCurrency(previousRevenue)} → ${formatCurrency(revenue)} (${revenueDelta >= 0 ? "+" : ""}${formatCurrency(revenueDelta)})`],
      direction: "up",
      severity: "Medium",
      impact: 3,
      confidence: 0.9,
      managementQuestion: "What is driving the inventory build, and how quickly can it be converted to sales?",
    });
  }
  if (marginChange < -2) {
    drivers.push({ id: "margin-pressure", category: "Margin", title: "Gross margin has weakened", observation: `Gross margin changed ${formatPercentValue(marginChange)} from the prior period.`, evidence: [`Margin change: ${formatPercentValue(marginChange)}`], direction: "down", severity: marginChange < -5 ? "High" : "Medium", impact: 4, confidence: 0.88, managementQuestion: "Is the margin change coming from pricing, product mix, or direct costs?" });
  }
  return drivers;
}

function buildAlerts(revenueChange: number, cashChange: number, inventoryChange: number, expenseChange: number): string[] {
  const alerts: string[] = [];
  if (expenseChange > revenueChange + 2) alerts.push(`Operating expenses increased ${formatPercentValue(expenseChange)} while revenue changed ${formatPercentValue(revenueChange)}.`);
  if (cashChange < -5) alerts.push(`Cash declined ${formatPercentValue(Math.abs(cashChange))} from the prior period.`);
  if (inventoryChange > revenueChange + 2) alerts.push(`Inventory increased ${formatPercentValue(inventoryChange)}, outpacing revenue change of ${formatPercentValue(revenueChange)}.`);
  return alerts;
}

function healthFrom(alerts: string[], drivers: FinancialDriver[]): string {
  if (drivers.some((driver) => driver.severity === "High")) return "attention";
  if (alerts.length) return "watch";
  return "strong";
}

function buildSustainedTrendDrivers(
  revenueValues: number[],
  grossProfitValues: number[],
  labels: string[],
  workbook: XLSX.WorkBook,
): FinancialDriver[] {
  const drivers: FinancialDriver[] = [];
  const revenue = revenueValues.slice(-6);
  const grossProfitValues6 = grossProfitValues.slice(-6);
  const periods = labels.slice(-6);
  if (revenue.length < 4 || periods.length < 4) return drivers;

  const moves = revenue.slice(1).map((value, index) => value - (revenue[index] ?? 0));
  const declineMoves = moves.filter((value) => value < 0).length;
  let consecutiveDeclines = 0;
  for (let index = moves.length - 1; index >= 0 && moves[index] < 0; index -= 1) consecutiveDeclines += 1;

  const peakRevenue = Math.max(...revenue);
  const latestRevenue = revenue[revenue.length - 1] ?? 0;
  const revenueDrop = Math.max(0, peakRevenue - latestRevenue);
  const revenueOffPeak = peakRevenue !== 0 ? (revenueDrop / Math.abs(peakRevenue)) * 100 : 0;

  if (consecutiveDeclines >= 3 || declineMoves >= 4) {
    drivers.push({
      id: "excel-revenue-decline-streak",
      category: "Revenue",
      title: "Revenue is in a sustained decline",
      observation: `Revenue declined from a trailing-6-period peak of ${formatCurrency(peakRevenue)} to ${formatCurrency(latestRevenue)} (${formatPercentValue(-revenueOffPeak)} from peak).`,
      evidence: [
        `Revenue peak: ${formatCurrency(peakRevenue)}`,
        `Revenue latest: ${formatCurrency(latestRevenue)}`,
        `Revenue declined in ${declineMoves} of the last ${moves.length} moves`,
      ],
      direction: "down",
      severity: revenueOffPeak >= 15 ? "High" : "Medium",
      impact: Math.min(10, Math.max(1, Math.round(revenueDrop / 25000))),
      confidence: 0.93,
      managementQuestion: "What is driving the sustained revenue decline, and which demand or customer trends need action?",
    });
  }

  const inventorySheet = findSheet(workbook, ["Inventory_Summary"]);
  if (inventorySheet) {
    const inventoryRows = sheetRows(inventorySheet);
    const inventoryHeaderIndex = findPeriodHeaderIndex(inventoryRows);
    const inventoryLabels = periodLabels(inventoryRows, inventoryHeaderIndex);
    const inventoryRow = findDataRow(inventoryRows, [/ending inventory/i, /^inventory$/i, /total inventory/i]);
    if (inventoryRow && inventoryLabels.length >= 5) {
      const inventoryTrend = safeTrend(rowValues(inventoryRow, inventoryLabels.length), inventoryLabels);
      const inventory = inventoryTrend.values.slice(-6);
      const alignedRevenue = revenueValues.slice(-inventory.length);
      const inventoryMoves = inventory.slice(1).map((value, index) => value - (inventory[index] ?? 0));
      const risingMoves = inventoryMoves.slice(-5).filter((value) => value > 0).length;
      const revenueWindowDrop = alignedRevenue.length >= 2
        ? (alignedRevenue[alignedRevenue.length - 1] ?? 0) < (alignedRevenue[0] ?? 0)
        : false;
      if (inventory.length >= 5 && risingMoves >= 4 && revenueWindowDrop) {
        const inventoryThen = inventory[0] ?? 0;
        const inventoryNow = inventory[inventory.length - 1] ?? 0;
        const revenueThen = alignedRevenue[0] ?? 0;
        drivers.push({
          id: "excel-inventory-into-soft-demand",
          category: "Inventory",
          title: "Inventory is building while demand softens",
          observation: `Ending inventory rose from ${formatCurrency(inventoryThen)} to ${formatCurrency(inventoryNow)} while revenue fell from ${formatCurrency(revenueThen)} to ${formatCurrency(latestRevenue)} over the same trailing window.`,
          evidence: [
            `Ending inventory: ${formatCurrency(inventoryThen)} → ${formatCurrency(inventoryNow)}`,
            `Revenue: ${formatCurrency(revenueThen)} → ${formatCurrency(latestRevenue)}`,
            `Inventory rose in ${risingMoves} of the last 5 moves`,
          ],
          direction: "up",
          severity: "High",
          impact: Math.min(10, Math.max(1, Math.round(Math.abs(inventoryNow - inventoryThen) / 25000))),
          confidence: 0.92,
          managementQuestion: "What is driving the inventory build while demand is weakening, and where can purchasing or production be slowed?",
        });
      }
    }
  }

  const margins = revenue.map((value, index) => {
    const gp = grossProfitValues6[index] ?? 0;
    return value !== 0 ? (gp / value) * 100 : Number.NaN;
  }).filter(Number.isFinite);

  if (margins.length >= 4) {
    const latestMargin = margins[margins.length - 1] ?? 0;
    const trailingHigh = Math.max(...margins);
    const compression = trailingHigh - latestMargin;
    if (compression >= 2) {
      drivers.push({
        id: "excel-sustained-margin-compression",
        category: "Margin",
        title: "Gross margin remains below its trailing high",
        observation: `Gross margin is ${formatPercentValue(-compression)} below its trailing-6-period high (${formatPercentValue(latestMargin)} latest vs ${formatPercentValue(trailingHigh)} high).`,
        evidence: [
          `Trailing-6-period high: ${formatPercentValue(trailingHigh)}`,
          `Latest gross margin: ${formatPercentValue(latestMargin)}`,
        ],
        direction: "down",
        severity: compression >= 5 ? "High" : "Medium",
        impact: Math.min(10, Math.max(1, Math.round(compression))),
        confidence: 0.9,
        managementQuestion: "What is sustaining the margin compression, and is it coming from pricing, mix, or direct costs?",
      });
    }
  }
  return drivers;
}

function buildBriefingFromRows(rows: unknown[][], sheetName: string, workbookForSeries: XLSX.WorkBook): BriefingData {
  const headerIndex = findHeaderIndex(rows, ["Month", "Date", "Period", "Account"]);
  const labels = periodLabels(rows, headerIndex);
  const revenueRow = findDataRow(rows, [/^revenue$/i, /total revenue/i, /sales/i]);
  const grossProfitRow = findDataRow(rows, [/gross profit/i]);
  const cashRow = findDataRow(rows, [/^cash$/i, /^total cash/i, /cash and cash equivalents/i]);
  const inventoryRow = findDataRow(rows, [/^inventory$/i, /total inventory/i, /inventory asset/i]);
  const expenseRow = findDataRow(rows, [/^operating expenses$/i, /total operating expenses/i, /^total expenses$/i, /^expenses$/i]);
  const revenueValues = revenueRow ? rowValues(revenueRow, labels.length) : [];
  const grossProfitValues = grossProfitRow ? rowValues(grossProfitRow, labels.length) : [];
  const cashValues = cashRow ? rowValues(cashRow, labels.length) : [];
  const inventoryValues = inventoryRow ? rowValues(inventoryRow, labels.length) : [];
  const expenseValues = expenseRow ? rowValues(expenseRow, labels.length) : [];
  const currentIndex = Math.max(0, labels.length - 1);
  const previousIndex = Math.max(0, currentIndex - 1);
  const hasPreviousPeriod = currentIndex > 0;
  const revenue = revenueValues[currentIndex] ?? valueFromRow(revenueRow || [], ["Revenue", "Total Revenue", "Sales"]);
  const previousRevenue = hasPreviousPeriod ? revenueValues[previousIndex] ?? 0 : 0;
  const grossProfit = grossProfitValues[currentIndex] ?? 0;
  const previousGrossProfit = hasPreviousPeriod ? grossProfitValues[previousIndex] ?? 0 : 0;
  const cash = cashValues[currentIndex] ?? valueFromRow(cashRow || [], ["Cash"]);
  const previousCash = hasPreviousPeriod ? cashValues[previousIndex] ?? 0 : 0;
  const inventory = inventoryValues[currentIndex] ?? valueFromRow(inventoryRow || [], ["Inventory"]);
  const previousInventory = hasPreviousPeriod ? inventoryValues[previousIndex] ?? 0 : 0;
  const expense = expenseValues[currentIndex] ?? valueFromRow(expenseRow || [], ["Operating Expenses", "Total Operating Expenses", "Expenses"]);
  const previousExpense = hasPreviousPeriod ? expenseValues[previousIndex] ?? 0 : 0;
  const revenueChange = changePercent(revenue, previousRevenue);
  const margin = revenue !== 0 ? (grossProfit / revenue) * 100 : 0;
  const previousMargin = hasPreviousPeriod && previousRevenue !== 0 ? (previousGrossProfit / previousRevenue) * 100 : Number.NaN;
  const marginChange = Number.isFinite(previousMargin) ? margin - previousMargin : Number.NaN;
  const cashChange = changePercent(cash, previousCash);
  const inventoryChange = changePercent(inventory, previousInventory);
  const expenseChange = changePercent(expense, previousExpense);
  const drivers = buildDrivers(revenue, previousRevenue, revenueChange, marginChange, cash, previousCash, cashChange, inventory, previousInventory, inventoryChange, expense, previousExpense, expenseChange);
  const sustainedDrivers = buildSustainedTrendDrivers(revenueValues, grossProfitValues, labels, workbookForSeries);
  const allDrivers = [...drivers, ...sustainedDrivers].sort((a, b) => b.impact - a.impact).slice(0, 8);
  const alerts = buildAlerts(revenueChange, cashChange, inventoryChange, expenseChange);
  const trend = safeTrend(revenueValues, labels);
  return {
    companyName: sheetName,
    revenue,
    revenueChange,
    grossMargin: margin,
    marginChange,
    cash,
    cashChange,
    inventory,
    inventoryChange,
    operatingExpense: expense,
    previousOperatingExpense: previousExpense,
    attention: alerts.length,
    alerts,
    recommendation: allDrivers[0]?.observation || "Review the latest financial signals and determine the most important management action.",
    impact: allDrivers[0]?.impact || 0,
    impactReason: allDrivers[0]?.observation || "No major exceptions were detected.",
    trend: trend.values,
    periods: trend.labels,
    health: healthFrom(alerts, allDrivers),
    confidence: 0.8,
    source: "upload",
    drivers: allDrivers,
    relationships: [],
    detailDrivers: [],
    trendInsights: [],
    trendSeries: (() => {
      const series: { name: string; values: number[]; periods: string[] }[] = [
        { name: "Revenue", values: trend.values, periods: trend.labels },
        {
          name: "Gross Margin",
          values: labels.map((_, index) => {
            const revenueValue = revenueValues[index] ?? 0;
            const grossProfitValue = grossProfitValues[index] ?? 0;
            return revenueValue !== 0 ? (grossProfitValue / revenueValue) * 100 : 0;
          }),
          periods: labels,
        },
      ];
      const inventorySheet = findSheet(workbookForSeries, ["Inventory_Summary"]);
      if (inventorySheet) {
        const inventoryRows = sheetRows(inventorySheet);
        const inventoryHeaderIndex = findPeriodHeaderIndex(inventoryRows);
        const inventoryLabels = periodLabels(inventoryRows, inventoryHeaderIndex);
        const inventoryRow = findDataRow(inventoryRows, [/ending inventory/i, /^inventory$/i, /total inventory/i]);
        if (inventoryRow && inventoryLabels.length) {
          const inventoryValues = rowValues(inventoryRow, inventoryLabels.length);
          const aligned = safeTrend(inventoryValues, inventoryLabels);
          series.push({ name: "Inventory", values: aligned.values, periods: aligned.labels });
        }
      }
      const balanceSheet = findSheet(workbookForSeries, ["Balance Sheet", "Balance_Sheet", "BalanceSheet"]);
      if (balanceSheet) {
        const balanceRows = sheetRows(balanceSheet);
        const balanceHeaderIndex = findPeriodHeaderIndex(balanceRows);
        const balanceLabels = periodLabels(balanceRows, balanceHeaderIndex);
        const cashRow = findDataRow(balanceRows, [/^cash$/i, /^total cash/i, /cash and cash equivalents/i]);
        if (cashRow && balanceLabels.length) {
          const cashValues = rowValues(cashRow, balanceLabels.length);
          const aligned = safeTrend(cashValues, balanceLabels);
          series.push({ name: "Cash Position", values: aligned.values, periods: aligned.labels });
        }
      }
      return series;
    })(),
    unknowns: [],
  };
}

function detailRowsFromSheet(sheet: XLSX.WorkSheet): Array<{ label: string; current: number; previous: number }> {
  const rows = sheetRows(sheet);
  if (!rows.length) return [];
  const headerIndex = findPeriodHeaderIndex(rows);
  const labels = periodLabels(rows, headerIndex);
  if (!labels.length) return [];

  return rows
    .filter((row) => row.length >= 2)
    .map((row) => {
      const label = normalizeText(row[0]);
      const values = rowValues(row, labels.length);
      return { label, current: values[values.length - 1] ?? 0, previous: values.length > 1 ? values[values.length - 2] ?? 0 : 0 };
    })
    .filter((row) => row.label && Number.isFinite(row.current) && row.current !== 0)
    .filter((row) => !/^total|^net income|^gross profit|^operating income|^revenue|^sales|^cogs/i.test(row.label));
}

function classifyExcelSheet(sheetName: string, rows: unknown[][]): "customer" | "vendor" | "ar" | "inventory" | "expense" | "other" {
  const text = `${sheetName} ${rows.slice(0, 8).flat().map(normalizeText).join(" ")}`.toLowerCase();
  if (/customer|client|sales by customer|income by customer/.test(text)) return "customer";
  if (/vendor|supplier|expense by vendor|spend by vendor/.test(text)) return "vendor";
  if (/receivable|accounts receivable|a\/r|ar aging|aged receivable/.test(text)) return "ar";
  if (/inventory|stock|item valuation/.test(text)) return "inventory";
  if (/expense|operating cost|op\.? ex\.?/.test(text)) return "expense";
  return "other";
}

function detailedExcelAnalysis(workbook: XLSX.WorkBook): {
  drivers: FinancialDriver[];
  details: DetailDriver[];
  relationships: string[];
  questions: Array<{ category: string; question: string }>;
  unknowns: string[];
} {
  const drivers: FinancialDriver[] = [];
  const details: DetailDriver[] = [];
  const relationships: string[] = [];
  const questions: Array<{ category: string; question: string }> = [];
  const questionSources = new Map<string, { sheetName: string; candidateCount: number }>();
  const unknowns: string[] = [];

  const addQuestion = (category: string, question: string, sheetName: string, candidateCount: number) => {
    const existing = questionSources.get(category);
    const isMoreGranular = /sku|item|detail/i.test(sheetName) && !(existing && /sku|item|detail/i.test(existing.sheetName));
    const isBetterFallback = !existing || (candidateCount > existing.candidateCount && !/sku|item|detail/i.test(existing.sheetName));
    if (!isMoreGranular && !isBetterFallback) return;
    if (existing) {
      const index = questions.findIndex((entry) => entry.category === category);
      if (index >= 0) questions[index] = { category, question };
    } else {
      questions.push({ category, question });
    }
    questionSources.set(category, { sheetName, candidateCount });
  };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = sheetRows(sheet);
    const type = classifyExcelSheet(sheetName, rows);
    const candidates = detailRowsFromSheet(sheet)
      .filter((row) => !/total|subtotal|ending|balance|units/i.test(row.label) && !row.label.includes("%"))
      .sort((a, b) => Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous));
    if (!candidates.length) continue;

    if (type === "customer") {
      const increases = candidates.filter((row) => row.current > row.previous).slice(0, 5);
      const decreases = candidates.filter((row) => row.current < row.previous).slice(0, 3);
      const movement = [...increases, ...decreases].reduce((sum, row) => sum + Math.abs(row.current - row.previous), 0);
      for (const row of [...increases, ...decreases].slice(0, 6)) {
        details.push({ name: row.label, current: row.current, previous: row.previous, change: row.current - row.previous, percentChange: changePercent(row.current, row.previous), direction: row.current >= row.previous ? "up" : "down", impact: Math.abs(row.current - row.previous) });
      }
      if (increases.length || decreases.length) {
        const top3 = [...increases, ...decreases].sort((a, b) => Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous)).slice(0, 3);
        drivers.push({
          id: `excel-customer-mix-${sheetName}`, category: "Revenue", title: "Customer revenue movement is concentrated",
          observation: `The largest reported customer movements are ${top3.map((row) => `${row.label} (${formatCurrency(row.current)})`).join(", ")}.`,
          evidence: [...increases.slice(0, 3), ...decreases.slice(0, 2)].map((row) => `${row.label}: ${formatCurrency(row.current - row.previous)} change`),
          direction: increases.length >= decreases.length ? "up" : "mixed", severity: movement > 50000 ? "High" : "Medium",
          impact: Math.min(10, Math.max(1, Math.round(movement / 10000))), confidence: 0.86,
          managementQuestion: "Are these customer movements recurring, or are they tied to one-time orders or timing?",
        });
        relationships.push("Customer-level revenue movement can be reviewed alongside total revenue to determine whether growth is broad-based or concentrated.");
        const top3 = [...increases, ...decreases].sort((a, b) => Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous)).slice(0, 3);
        addQuestion("Revenue", `The largest customer movements are ${top3.map((row) => `${row.label} (${formatCurrency(row.current)})`).join(", ")} — are they expected to continue, or are they tied to one-time orders or timing?`, sheetName, candidates.length);
      }
    }

    if (type === "expense") {
      const increases = candidates.filter((row) => row.current > row.previous).slice(0, 5);
      if (increases.length) {
        const totalIncrease = increases.reduce((sum, row) => sum + Math.max(0, row.current - row.previous), 0);
        for (const row of increases) {
          details.push({ name: row.label, current: row.current, previous: row.previous, change: row.current - row.previous, percentChange: changePercent(row.current, row.previous), direction: "up", impact: Math.abs(row.current - row.previous) });
        }
        const top3 = increases.slice(0, 3);
        drivers.push({
          id: `excel-expense-detail-${sheetName}`, category: "Operating Expense", title: "Specific expense accounts are driving the movement",
          observation: `The largest reported expense increases are ${top3.map((row) => `${row.label} (${formatCurrency(row.current)})`).join(", ")}.`,
          evidence: increases.slice(0, 4).map((row) => `${row.label}: +${formatCurrency(row.current - row.previous)}`),
          direction: "up", severity: totalIncrease > 50000 ? "High" : "Medium", impact: Math.min(10, Math.max(1, Math.round(totalIncrease / 10000))),
          confidence: 0.88, managementQuestion: "Are these expense increases recurring, discretionary, or timing-related?",
        });
        relationships.push("The largest expense-account movements should be compared with revenue growth to determine whether operating costs are scaling with the business.");
        const top3 = increases.slice(0, 3);
        addQuestion("Expenses", `The largest expense increases are ${top3.map((row) => `${row.label} (${formatCurrency(row.current)})`).join(", ")} — are they recurring, discretionary, or timing-related?`, sheetName, candidates.length);
      }
    }

    if (type === "vendor") {
      const increases = candidates.filter((row) => row.current > row.previous).slice(0, 5);
      if (increases.length) {
        const totalIncrease = increases.reduce((sum, row) => sum + Math.max(0, row.current - row.previous), 0);
        for (const row of increases) {
          details.push({ name: row.label, current: row.current, previous: row.previous, change: row.current - row.previous, percentChange: changePercent(row.current, row.previous), direction: "up", impact: Math.abs(row.current - row.previous) });
        }
        const top3 = increases.slice(0, 3);
        drivers.push({
          id: `excel-vendor-spend-${sheetName}`, category: "Operating Expense", title: "Vendor spend has identifiable concentration",
          observation: `The largest reported vendor increases are ${top3.map((row) => `${row.label} (${formatCurrency(row.current)})`).join(", ")}.`,
          evidence: increases.slice(0, 4).map((row) => `${row.label}: +${formatCurrency(row.current - row.previous)}`),
          direction: "up", severity: totalIncrease > 50000 ? "High" : "Medium", impact: Math.min(10, Math.max(1, Math.round(totalIncrease / 10000))),
          confidence: 0.84, managementQuestion: "What is driving these vendor spend increases, and are they expected to persist?",
        });
        relationships.push("Vendor-level spend detail can identify whether expense growth is concentrated in a small number of suppliers.");
        const top3 = increases.slice(0, 3);
        addQuestion("Vendors", `The largest vendor spend increases are ${top3.map((row) => `${row.label} (${formatCurrency(row.current)})`).join(", ")} — are they recurring, and are they expected to persist?`, sheetName, candidates.length);
      }
    }

    if (type === "ar") {
      const balances = candidates.sort((a, b) => b.current - a.current).slice(0, 5);
      const total = balances.reduce((sum, row) => sum + Math.max(0, row.current), 0);
      drivers.push({
        id: `excel-ar-detail-${sheetName}`, category: "Cash", title: "Accounts receivable detail is available",
        observation: `The largest reported receivable balances are ${balances.slice(0, 3).map((row) => `${row.label} (${formatCurrency(row.current)})`).join(", ")}.`,
        evidence: balances.slice(0, 4).map((row) => `${row.label}: ${formatCurrency(row.current)}`),
        direction: "watch", severity: "Watch", impact: Math.min(10, Math.max(1, Math.round(total / 50000))), confidence: 0.8,
        managementQuestion: "When are the largest balances expected to convert to cash, and which need collection action?",
      });
      relationships.push("Receivables detail provides a direct bridge between reported sales activity and the timing of cash collection.");
      addQuestion("Cash", `The largest receivable balances are ${balances.slice(0, 3).map((row) => `${row.label} (${formatCurrency(row.current)})`).join(", ")} — when are they expected to convert to cash, and which need collection action?`, sheetName, candidates.length);
      for (const row of balances) details.push({ name: row.label, current: row.current, previous: row.previous, change: row.current - row.previous, percentChange: changePercent(row.current, row.previous), direction: row.current >= row.previous ? "up" : "down", impact: Math.abs(row.current - row.previous) });
    }

    if (type === "inventory") {
      const balances = candidates.sort((a, b) => b.current - a.current).slice(0, 5);
      if (balances.length) {
        drivers.push({
          id: `excel-inventory-detail-${sheetName}`, category: "Inventory", title: "Inventory detail is available",
          observation: `The largest reported inventory balances are ${balances.slice(0, 3).map((row) => `${row.label} (${formatCurrency(row.current)})`).join(", ")}.`,
          evidence: balances.slice(0, 4).map((row) => `${row.label}: ${formatCurrency(row.current)}`),
          direction: "watch", severity: "Watch", impact: Math.min(10, Math.max(1, Math.round(balances[0].current / 50000))), confidence: 0.8,
          managementQuestion: "Are the largest-stock items moving at the expected rate, and should purchasing slow for any of them?",
        });
        relationships.push("Inventory detail can be compared with revenue growth to identify stock that may be building faster than demand.");
        addQuestion("Inventory", `The largest inventory balances are ${balances.slice(0, 3).map((row) => `${row.label} (${formatCurrency(row.current)})`).join(", ")} — are those items moving at the expected rate, and should purchasing slow for any of them?`, sheetName, candidates.length);
        for (const row of balances) details.push({ name: row.label, current: row.current, previous: row.previous, change: row.current - row.previous, percentChange: changePercent(row.current, row.previous), direction: row.current >= row.previous ? "up" : "down", impact: Math.abs(row.current - row.previous) });
      }
    }
  }

  if (!drivers.length) unknowns.push("No customer, vendor, receivables, inventory, or expense-detail sheet with usable period values was identified in the uploaded workbook.");

  return {
    drivers: drivers.sort((a, b) => b.impact - a.impact).slice(0, 8),
    details: details.sort((a, b) => b.impact - a.impact).slice(0, 12),
    relationships: relationships.slice(0, 8),
    questions: questions.slice(0, 8),
    unknowns: unknowns.slice(0, 10),
  };
}

export function analyzeWorkbook(workbook: XLSX.WorkBook): BriefingData {
  const sheetName = workbook.SheetNames[0] || "Financial Data";
  const sheet = findSheet(workbook, ["P&L", "Profit and Loss", "Income Statement", sheetName]) || workbook.Sheets[sheetName];
  if (!sheet) throw new Error("No financial worksheet was found.");
  const rows = sheetRows(sheet);
  if (!rows.length) throw new Error("The financial worksheet is empty.");

  const base = buildBriefingFromRows(rows, sheetName, workbook);
  const inventorySheet = findSheet(workbook, ["Inventory_Summary"]);
  let inventoryOverride: { inventory: number; previousInventory: number; inventoryChange: number } | null = null;
  if (inventorySheet) {
    const inventoryRows = sheetRows(inventorySheet);
    const inventoryHeaderIndex = findPeriodHeaderIndex(inventoryRows);
    const inventoryLabels = periodLabels(inventoryRows, inventoryHeaderIndex);
    const inventoryRow = findDataRow(inventoryRows, [/ending inventory/i, /^inventory$/i, /total inventory/i]);
    if (inventoryRow && inventoryLabels.length >= 2) {
      const values = rowValues(inventoryRow, inventoryLabels.length);
      const current = values[values.length - 1] ?? 0;
      const previous = values[values.length - 2] ?? 0;
      inventoryOverride = { inventory: current, previousInventory: previous, inventoryChange: changePercent(current, previous) };
    }
  }
  const balanceSheet = findSheet(workbook, ["Balance Sheet", "Balance_Sheet", "BalanceSheet"]);
  let cashOverride: { cash: number; previousCash: number; cashChange: number } | null = null;
  if (balanceSheet) {
    const balanceRows = sheetRows(balanceSheet);
    const balanceHeaderIndex = findPeriodHeaderIndex(balanceRows);
    const balanceLabels = periodLabels(balanceRows, balanceHeaderIndex);
    const cashRow = findDataRow(balanceRows, [/^cash$/i, /^total cash/i, /cash and cash equivalents/i]);
    if (cashRow && balanceLabels.length >= 2) {
      const values = rowValues(cashRow, balanceLabels.length);
      const current = values[values.length - 1] ?? 0;
      const previous = values[values.length - 2] ?? 0;
      cashOverride = { cash: current, previousCash: previous, cashChange: changePercent(current, previous) };
    }
  }
  const hasBalanceSheet = Boolean(balanceSheet);
  const dataAvailability = { cash: hasBalanceSheet, inventory: hasBalanceSheet || Boolean(inventoryOverride) };
  const detailed = detailedExcelAnalysis(workbook);
  const allDrivers = [...base.drivers, ...detailed.drivers].sort((a, b) => b.impact - a.impact).slice(0, 8);

  const resolvedInventory = inventoryOverride ?? { inventory: base.inventory, previousInventory: base.inventory, inventoryChange: base.inventoryChange };
  const resolvedCash = cashOverride ?? { cash: base.cash, previousCash: base.cash, cashChange: base.cashChange };
  const sustainedAlerts = allDrivers.map((driver) => driver.observation);
  const finalAlerts = Array.from(new Set([...base.alerts, ...sustainedAlerts]));
  return {
    ...base,
    cash: resolvedCash.cash,
    cashChange: resolvedCash.cashChange,
    inventory: resolvedInventory.inventory,
    inventoryChange: resolvedInventory.inventoryChange,
    drivers: allDrivers,
    alerts: finalAlerts,
    attention: finalAlerts.length,
    recommendation: allDrivers[0]?.observation || base.recommendation,
    impact: allDrivers[0]?.impact || base.impact,
    impactReason: allDrivers[0]?.observation || base.impactReason,
    managementQuestions: detailed.questions,
    relationships: [...base.relationships, ...detailed.relationships].slice(0, 8),
    detailDrivers: detailed.details,
    unknowns: Array.from(new Set([...detailed.unknowns, ...(!dataAvailability.cash ? ["The uploaded workbook does not include a balance sheet, so cash position is unknown (shown as $0)."] : [])])).slice(0, 10),
    dataAvailability,
  };
}

export function buildDeterministicExecutiveSummary(data: BriefingData): string {
  if (!data.alerts.length && !data.drivers.length) return "No major exceptions were detected in the latest financial data.";
  return (data.alerts.length ? data.alerts : data.drivers.map((driver) => driver.observation)).slice(0, 2).join(" ");
}

export function scoreAIAction(action: AIAction, data: BriefingData): number {
  const severityWeight = action.priority === "High" ? 3 : action.priority === "Medium" ? 2 : 1;
  return severityWeight + data.alerts.length;
}
