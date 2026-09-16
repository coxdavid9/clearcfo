import type { BriefingData, FinancialDriver } from "./briefing/engine";

type Series = { name: string; values: number[]; periods: string[] };
type ReportNode = {
  label: string;
  values: number[];
  group: string;
  type: string;
};

function clean(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toNumber(value: unknown): number {
  const text = String(value ?? "")
    .trim()
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function valuesFromCells(cells: any[] | undefined): number[] {
  return (cells || []).slice(1).map((cell: any) => toNumber(cell?.value));
}

function labelFromCells(cells: any[] | undefined): string {
  return String(cells?.[0]?.value || "").trim();
}

function collectRows(node: any, output: ReportNode[] = []): ReportNode[] {
  if (!node) return output;
  if (Array.isArray(node)) {
    for (const item of node) collectRows(item, output);
    return output;
  }
  if (typeof node !== "object") return output;

  const group = String(node.group || "");
  const type = String(node.type || "");

  if (node.Summary?.ColData) {
    const cells = node.Summary.ColData;
    const label = labelFromCells(cells);
    if (label) output.push({ label, values: valuesFromCells(cells), group, type });
  }

  if (node.ColData) {
    const cells = node.ColData;
    const label = labelFromCells(cells);
    if (label) output.push({ label, values: valuesFromCells(cells), group, type });
  }

  if (node.Header?.ColData) {
    const label = labelFromCells(node.Header.ColData);
    if (label) output.push({ label, values: valuesFromCells(node.Header.ColData), group, type: "Header" });
  }

  if (node.Rows) collectRows(node.Rows, output);
  if (Array.isArray(node.Row)) {
    for (const row of node.Row) collectRows(row, output);
  }
  return output;
}

function reportPeriods(report: any): string[] {
  return (report?.Columns?.Column || [])
    .slice(1)
    .map((column: any) => String(column?.ColTitle || "").trim())
    .filter((title: string) => title && !/^total$/i.test(title));
}

function align(values: number[], length: number): number[] {
  if (values.length === length) return values;
  if (values.length > length) return values.slice(-length);
  return Array.from({ length }, (_, index) => values[index] ?? 0);
}

function findByGroup(rows: ReportNode[], patterns: RegExp[]): ReportNode | null {
  return rows.find((row) => row.group && patterns.some((pattern) => pattern.test(clean(row.group))) && row.values.some((value) => value !== 0)) || null;
}

function findByLabel(rows: ReportNode[], patterns: RegExp[]): ReportNode | null {
  return rows.find((row) => patterns.some((pattern) => pattern.test(clean(row.label))) && row.values.some((value) => value !== 0)) || null;
}

function findSummary(rows: ReportNode[], patterns: RegExp[]): ReportNode | null {
  return rows.find((row) => row.type === "Section" && patterns.some((pattern) => pattern.test(clean(row.label))) && row.values.some((value) => value !== 0)) || null;
}

function pickSeries(rows: ReportNode[], groupPatterns: RegExp[], labelPatterns: RegExp[], length: number): number[] | null {
  const row = findByGroup(rows, groupPatterns) || findSummary(rows, labelPatterns) || findByLabel(rows, labelPatterns);
  return row ? align(row.values, length) : null;
}

function sumMatching(rows: ReportNode[], patterns: RegExp[], length: number): number[] {
  const matches = rows.filter((row) => patterns.some((pattern) => pattern.test(clean(row.label))) && row.type !== "Section");
  return Array.from({ length }, (_, index) => matches.reduce((sum, row) => sum + (row.values[index] || 0), 0));
}

function changePercent(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Number(value.toFixed(1))}%`;
}

function buildDrivers(
  revenueChange: number,
  marginChange: number,
  cashChange: number,
  inventoryChange: number,
  expenseChange: number,
): FinancialDriver[] {
  const drivers: FinancialDriver[] = [];
  if (expenseChange > revenueChange + 2) {
    drivers.push({
      id: "opex-growth",
      category: "Operating Expense",
      title: "Operating expenses are rising faster than revenue",
      observation: `Operating expenses changed ${formatPercent(expenseChange)} while revenue changed ${formatPercent(revenueChange)}.`,
      evidence: [`Operating expense change: ${formatPercent(expenseChange)}`, `Revenue change: ${formatPercent(revenueChange)}`],
      direction: "up",
      severity: expenseChange > 20 ? "High" : "Medium",
      impact: Math.min(10, Math.max(1, Math.round(Math.abs(expenseChange - revenueChange) / 5))),
      confidence: 0.9,
      managementQuestion: "Which expense categories are driving the increase, and which are controllable or temporary?",
    });
  }
  if (cashChange < -5) {
    drivers.push({
      id: "cash-pressure",
      category: "Cash",
      title: "Cash is under pressure",
      observation: `Cash declined ${formatPercent(Math.abs(cashChange))} from the prior period.`,
      evidence: [`Cash change: ${formatPercent(cashChange)}`],
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
      observation: `Inventory changed ${formatPercent(inventoryChange)}, ahead of revenue at ${formatPercent(revenueChange)}.`,
      evidence: [`Inventory change: ${formatPercent(inventoryChange)}`, `Revenue change: ${formatPercent(revenueChange)}`],
      direction: "up",
      severity: "Medium",
      impact: 3,
      confidence: 0.9,
      managementQuestion: "What is driving the inventory build, and how quickly can it be converted to sales?",
    });
  }
  if (marginChange < -2) {
    drivers.push({
      id: "margin-pressure",
      category: "Margin",
      title: "Gross margin has weakened",
      observation: `Gross margin changed ${formatPercent(marginChange)} from the prior period.`,
      evidence: [`Margin change: ${formatPercent(marginChange)}`],
      direction: "down",
      severity: marginChange < -5 ? "High" : "Medium",
      impact: 4,
      confidence: 0.88,
      managementQuestion: "Is the margin change coming from pricing, product mix, or direct costs?",
    });
  }
  return drivers;
}

export function buildQuickBooksBriefing(
  profitAndLoss: any,
  balanceSheet: any,
  companyName: string | null,
): BriefingData {
  const pnlPeriods = reportPeriods(profitAndLoss);
  const pnlRows = collectRows(profitAndLoss?.Rows);
  if (!pnlPeriods.length) {
    throw new Error("ClearCFO received a QuickBooks P&L report, but no reporting periods were returned.");
  }

  // QuickBooks P&L sections expose stable group identifiers such as Income,
  // COGS and Expenses. Prefer those summaries over account-name guessing.
  const revenue = pickSeries(
    pnlRows,
    [/^income$/, /^revenue$/, /^sales$/],
    [/^total income$/, /^total revenue$/, /^net revenue$/, /^total sales$/, /^net sales$/],
    pnlPeriods.length,
  ) || sumMatching(pnlRows, [/revenue/, /^sales$/], pnlPeriods.length);

  const cogs = pickSeries(
    pnlRows,
    [/^cogs$/, /^costofgoodssold$/, /^costofsales$/, /^costofrevenue$/],
    [/^total cost of goods sold$/, /^cost of goods sold$/, /^cost of sales$/, /^cost of revenue$/],
    pnlPeriods.length,
  ) || Array.from({ length: pnlPeriods.length }, () => 0);

  const expenses = pickSeries(
    pnlRows,
    [/^expenses$/, /^operatingexpenses$/],
    [/^total operating expenses$/, /^operating expenses$/, /^total expenses$/, /^expenses$/],
    pnlPeriods.length,
  ) || sumMatching(pnlRows, [/expense/], pnlPeriods.length);

  const netIncome = pickSeries(
    pnlRows,
    [/^netincome$/, /^netoperatingincome$/],
    [/^net income$/, /^net operating income$/],
    pnlPeriods.length,
  );

  const grossProfit = pnlPeriods.map((_, index) => {
    const revenueValue = revenue[index] || 0;
    const cogsValue = cogs[index] || 0;
    return revenueValue - cogsValue;
  });

  const balancePeriods = reportPeriods(balanceSheet);
  const balanceRows = collectRows(balanceSheet?.Rows);
  const cash = balancePeriods.length
    ? pickSeries(
        balanceRows,
        [/^cashandcashequivalents$/, /^cash$/, /^cashandbank$/],
        [/^total cash and cash equivalents$/, /^cash and cash equivalents$/, /^total cash$/],
        balancePeriods.length,
      )
    : null;
  const inventory = balancePeriods.length
    ? pickSeries(
        balanceRows,
        [/^inventoryasset$/, /^inventory$/],
        [/^total inventory asset$/, /^total inventory$/, /^inventory asset$/, /^inventory$/],
        balancePeriods.length,
      )
    : null;

  const checkingSavings = balancePeriods.length
    ? sumMatching(balanceRows, [/^checking$/, /^savings$/, /^undeposited funds$/, /^cash on hand$/], balancePeriods.length)
    : [];
  const cashSeries = cash || (checkingSavings.some((value) => value !== 0) ? checkingSavings : null);
  const inventorySeries = inventory;

  const cashAligned = cashSeries ? align(cashSeries, pnlPeriods.length) : [];
  const inventoryAligned = inventorySeries ? align(inventorySeries, pnlPeriods.length) : [];
  const expenseSeries = expenses;
  const current = Math.max(0, pnlPeriods.length - 1);
  const previous = Math.max(0, current - 1);
  const currentRevenue = revenue[current] || 0;
  const previousRevenue = revenue[previous] || 0;
  const currentGrossProfit = grossProfit[current] || 0;
  const previousGrossProfit = grossProfit[previous] || 0;
  const currentCash = cashAligned[current] || 0;
  const previousCash = cashAligned[previous] || 0;
  const currentInventory = inventoryAligned[current] || 0;
  const previousInventory = inventoryAligned[previous] || 0;
  const currentExpense = expenseSeries[current] || 0;
  const previousExpense = expenseSeries[previous] || 0;

  const revenueChange = changePercent(currentRevenue, previousRevenue);
  const grossMargin = currentRevenue ? (currentGrossProfit / currentRevenue) * 100 : 0;
  const previousMargin = previousRevenue ? (previousGrossProfit / previousRevenue) * 100 : grossMargin;
  const marginChange = grossMargin - previousMargin;
  const cashChange = changePercent(currentCash, previousCash);
  const inventoryChange = changePercent(currentInventory, previousInventory);
  const expenseChange = changePercent(currentExpense, previousExpense);
  const drivers = buildDrivers(revenueChange, marginChange, cashChange, inventoryChange, expenseChange);
  const alerts = drivers.map((driver) => driver.observation);

  const trendSeries: Series[] = [
    { name: "Revenue", values: revenue.slice(-12), periods: pnlPeriods.slice(-12) },
    { name: "Gross Margin", values: pnlPeriods.slice(-12).map((_, index) => {
      const sourceIndex = Math.max(0, pnlPeriods.length - Math.min(12, pnlPeriods.length)) + index;
      return revenue[sourceIndex] ? (grossProfit[sourceIndex] / revenue[sourceIndex]) * 100 : 0;
    }), periods: pnlPeriods.slice(-12) },
    { name: "Operating Expenses", values: expenseSeries.slice(-12), periods: pnlPeriods.slice(-12) },
    { name: "Cash Position", values: cashAligned.slice(-12), periods: pnlPeriods.slice(-12) },
    { name: "Inventory", values: inventoryAligned.slice(-12), periods: pnlPeriods.slice(-12) },
  ];

  const nonEmptySeries = trendSeries.filter((series) => series.values.length && series.values.some((value) => value !== 0));
  if (!revenue.some((value) => value !== 0) && !netIncome?.some((value) => value !== 0)) {
    throw new Error("QuickBooks is connected, but ClearCFO could not identify a non-zero income or net-income series in the returned P&L.");
  }

  return {
    companyName: companyName || "Your business",
    revenue: currentRevenue,
    revenueChange,
    grossMargin,
    marginChange,
    cash: currentCash,
    cashChange,
    inventory: currentInventory,
    inventoryChange,
    attention: alerts.length,
    alerts,
    recommendation: drivers[0]?.observation || "Review the latest QuickBooks financial signals and determine the most important management action.",
    impact: drivers[0]?.impact || 0,
    impactReason: drivers[0]?.observation || "No major exceptions were detected.",
    trend: trendSeries[0].values,
    periods: trendSeries[0].periods,
    health: drivers.some((driver) => driver.severity === "High") ? "attention" : alerts.length ? "watch" : "strong",
    confidence: nonEmptySeries.length >= 3 ? 0.92 : 0.82,
    source: "upload",
    drivers,
    relationships: drivers.map((driver) => driver.observation),
    detailDrivers: [],
    trendInsights: [],
    trendSeries,
    unknowns: [
      ...(cashSeries ? [] : ["QuickBooks did not return a cash balance series for the requested periods."]),
      ...(inventorySeries ? [] : ["QuickBooks did not return an inventory balance series for the requested periods."]),
    ],
  };
}
