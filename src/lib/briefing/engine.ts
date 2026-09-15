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
  inventory: number;
  inventoryChange: number;
  attention: number;
  alerts: string[];
  recommendation: string;
  impact: number;
  impactReason: string;
  trend: number[];
  periods: string[];
  health: string;
  confidence: number;
  source: "demo" | "upload";
  drivers: FinancialDriver[];
  relationships: string[];
  detailDrivers: DetailDriver[];
  trendInsights: string[];
  trendSeries: { name: string; values: number[]; periods: string[] }[];
  unknowns: string[];
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
};

export type AIAction = {
  title: string;
  rationale: string;
  priority: "High" | "Medium" | "Watch";
  score?: number;
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
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function safeTrend(values: number[], labels: string[]): { values: number[]; labels: string[] } {
  const length = Math.min(values.length, labels.length || values.length);
  return { values: values.slice(Math.max(0, values.length - length)), labels: labels.slice(Math.max(0, labels.length - length)) };
}

function buildDrivers(revenue: number, revenueChange: number, marginChange: number, cashChange: number, inventoryChange: number, expenseChange: number): FinancialDriver[] {
  const drivers: FinancialDriver[] = [];
  if (expenseChange > revenueChange + 2) {
    drivers.push({ id: "opex-growth", category: "Operating Expense", title: "Operating expenses are rising faster than revenue", observation: `Operating expenses increased ${formatPercentValue(expenseChange)} while revenue changed ${formatPercentValue(revenueChange)}.`, evidence: [`Operating expense change: ${formatPercentValue(expenseChange)}`, `Revenue change: ${formatPercentValue(revenueChange)}`], direction: "up", severity: expenseChange > 20 ? "High" : "Medium", impact: Math.min(10, Math.max(1, Math.round(Math.abs(expenseChange - revenueChange) / 5))), confidence: 0.9, managementQuestion: "Which expense categories are driving the increase, and which are controllable or temporary?" });
  }
  if (cashChange < -5) {
    drivers.push({ id: "cash-pressure", category: "Cash", title: "Cash is under pressure", observation: `Cash declined ${formatPercentValue(Math.abs(cashChange))} from the prior period.`, evidence: [`Cash change: ${formatPercentValue(cashChange)}`], direction: "down", severity: cashChange < -15 ? "High" : "Medium", impact: 5, confidence: 0.94, managementQuestion: "What near-term cash commitments could create additional pressure?" });
  }
  if (inventoryChange > revenueChange + 2) {
    drivers.push({ id: "inventory-growth", category: "Inventory", title: "Inventory is outpacing revenue", observation: `Inventory increased ${formatPercentValue(inventoryChange)}, outpacing revenue change of ${formatPercentValue(revenueChange)}.`, evidence: [`Inventory change: ${formatPercentValue(inventoryChange)}`, `Revenue change: ${formatPercentValue(revenueChange)}`], direction: "up", severity: "Medium", impact: 3, confidence: 0.9, managementQuestion: "What is driving the inventory build, and how quickly can it be converted to sales?" });
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

function buildBriefingFromRows(rows: unknown[][], sheetName: string): BriefingData {
  const headerIndex = findHeaderIndex(rows, ["Month", "Date", "Period", "Account"]);
  const labels = periodLabels(rows, headerIndex);
  const revenueRow = findDataRow(rows, [/^revenue$/i, /total revenue/i, /sales/i]);
  const grossProfitRow = findDataRow(rows, [/gross profit/i]);
  const cashRow = findDataRow(rows, [/cash/i]);
  const inventoryRow = findDataRow(rows, [/inventory/i]);
  const revenueValues = revenueRow ? rowValues(revenueRow, labels.length) : [];
  const grossProfitValues = grossProfitRow ? rowValues(grossProfitRow, labels.length) : [];
  const cashValues = cashRow ? rowValues(cashRow, labels.length) : [];
  const inventoryValues = inventoryRow ? rowValues(inventoryRow, labels.length) : [];
  const currentIndex = Math.max(0, labels.length - 1);
  const previousIndex = Math.max(0, currentIndex - 1);
  const revenue = revenueValues[currentIndex] ?? valueFromRow(revenueRow || [], ["Revenue", "Total Revenue", "Sales"]);
  const previousRevenue = revenueValues[previousIndex] ?? 0;
  const grossProfit = grossProfitValues[currentIndex] ?? 0;
  const previousGrossProfit = grossProfitValues[previousIndex] ?? 0;
  const cash = cashValues[currentIndex] ?? valueFromRow(cashRow || [], ["Cash"]);
  const previousCash = cashValues[previousIndex] ?? 0;
  const inventory = inventoryValues[currentIndex] ?? valueFromRow(inventoryRow || [], ["Inventory"]);
  const previousInventory = inventoryValues[previousIndex] ?? 0;
  const revenueChange = changePercent(revenue, previousRevenue);
  const margin = revenue !== 0 ? (grossProfit / revenue) * 100 : 0;
  const previousMargin = previousRevenue !== 0 ? (previousGrossProfit / previousRevenue) * 100 : margin;
  const marginChange = margin - previousMargin;
  const cashChange = changePercent(cash, previousCash);
  const inventoryChange = changePercent(inventory, previousInventory);
  const expenseChange = 0;
  const drivers = buildDrivers(revenue, revenueChange, marginChange, cashChange, inventoryChange, expenseChange);
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
    attention: alerts.length,
    alerts,
    recommendation: drivers[0]?.observation || "Review the latest financial signals and determine the most important management action.",
    impact: drivers[0]?.impact || 0,
    impactReason: drivers[0]?.observation || "No major exceptions were detected.",
    trend: trend.values,
    periods: trend.labels,
    health: healthFrom(alerts, drivers),
    confidence: 0.8,
    source: "upload",
    drivers,
    relationships: [],
    detailDrivers: [],
    trendInsights: [],
    trendSeries: [{ name: "Revenue", values: trend.values, periods: trend.labels }],
    unknowns: [],
  };
}

export function analyzeWorkbook(workbook: XLSX.WorkBook): BriefingData {
  const sheetName = workbook.SheetNames[0] || "Financial Data";
  const sheet = findSheet(workbook, ["P&L", "Profit and Loss", "Income Statement", sheetName]) || workbook.Sheets[sheetName];
  if (!sheet) throw new Error("No financial worksheet was found.");
  const rows = sheetRows(sheet);
  if (!rows.length) throw new Error("The financial worksheet is empty.");
  return buildBriefingFromRows(rows, sheetName);
}

export function buildDeterministicExecutiveSummary(data: BriefingData): string {
  if (!data.alerts.length) return "No major exceptions were detected in the latest financial data.";
  return data.alerts.slice(0, 2).join(" ");
}

export function scoreAIAction(action: AIAction, data: BriefingData): number {
  const severityWeight = action.priority === "High" ? 3 : action.priority === "Medium" ? 2 : 1;
  return severityWeight + data.alerts.length;
}
