import type { BriefingData, FinancialDriver, DetailDriver } from "./briefing/engine";
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

function buildDrivers(revenueChange: number, marginChange: number, cashChange: number, inventoryChange: number, expenseChange: number, previousCogs: number, currentCogs: number, previousExpense: number, currentExpense: number): FinancialDriver[] {
  const drivers: FinancialDriver[] = [];
  if (Number.isFinite(expenseChange) && expenseChange > (Number.isFinite(revenueChange) ? revenueChange : 0) + 2) {
    drivers.push({ id: "opex-growth", category: "Operating Expense", title: "Operating expenses are rising faster than revenue", observation: `Operating expenses changed ${formatPercent(expenseChange)} while revenue changed ${formatPercent(revenueChange)}.`, evidence: [`Operating expense change: ${formatPercent(expenseChange)}`, `Operating expense dollars: ${Math.round(previousExpense).toLocaleString()} to ${Math.round(currentExpense).toLocaleString()} (${currentExpense - previousExpense >= 0 ? "+" : ""}${Math.round(currentExpense - previousExpense).toLocaleString()})`, `Revenue change: ${formatPercent(revenueChange)}`], direction: "up", severity: expenseChange > 20 ? "High" : "Medium", impact: Math.min(10, Math.max(1, Math.round(Math.abs(expenseChange - (Number.isFinite(revenueChange) ? revenueChange : 0)) / 5))), confidence: 0.9, managementQuestion: "Which expense categories are driving the increase, and which are controllable or temporary?" });
  }
  if (Number.isFinite(cashChange) && cashChange < -5) {
    drivers.push({ id: "cash-pressure", category: "Cash", title: "Cash is under pressure", observation: `Cash declined ${formatPercent(Math.abs(cashChange))} from the prior period.`, evidence: [`Cash change: ${formatPercent(cashChange)}`], direction: "down", severity: cashChange < -15 ? "High" : "Medium", impact: 5, confidence: 0.94, managementQuestion: "What near-term cash commitments could create additional pressure?" });
  }
  if (Number.isFinite(inventoryChange) && Number.isFinite(revenueChange) && inventoryChange > revenueChange + 2) {
    drivers.push({ id: "inventory-growth", category: "Inventory", title: "Inventory is outpacing revenue", observation: `Inventory changed ${formatPercent(inventoryChange)}, ahead of revenue at ${formatPercent(revenueChange)}.`, evidence: [`Inventory change: ${formatPercent(inventoryChange)}`, `Revenue change: ${formatPercent(revenueChange)}`], direction: "up", severity: "Medium", impact: 3, confidence: 0.9, managementQuestion: "What is driving the inventory build, and how quickly can it be converted to sales?" });
  }
  if (Number.isFinite(marginChange) && marginChange < -2) {
    if ((previousCogs || 0) === 0 && (currentCogs || 0) > 0) {
      drivers.push({ id: "margin-baseline", category: "Margin", title: "COGS appeared this period after none in the prior period", observation: `COGS of ${Math.round(currentCogs).toLocaleString()} was recorded this period versus $0 in the prior period. That change coincides with the margin movement, but the prior-period baseline should be validated before treating it as a recurring margin driver.`, evidence: [`Current COGS: $${Math.round(currentCogs).toLocaleString()}`, `Prior COGS: $0`], direction: "down", severity: "Medium", impact: 2, confidence: 0.88, managementQuestion: "Was prior-period COGS omitted, or is this the beginning of a recurring COGS pattern?" });
    } else {
      drivers.push({ id: "margin-pressure", category: "Margin", title: "Gross margin has weakened", observation: `Gross margin changed ${formatPercent(marginChange)} from the prior period.`, evidence: [`Margin change: ${formatPercent(marginChange)}`], direction: "down", severity: marginChange < -5 ? "High" : "Medium", impact: 4, confidence: 0.88, managementQuestion: "Is the margin change coming from pricing, product mix, or direct costs?" });
    }
  }
  return drivers;
}

function buildAlerts(revenueChange: number, cashChange: number, inventoryChange: number, expenseChange: number): string[] {
  const alerts: string[] = [];
  if (Number.isFinite(revenueChange)) alerts.push(`Revenue changed ${formatPercent(revenueChange)} from the prior period.`);
  if (Number.isFinite(expenseChange)) alerts.push(`Operating expenses changed ${formatPercent(expenseChange)} from the prior period.`);
  if (Number.isFinite(cashChange)) alerts.push(`Cash changed ${formatPercent(cashChange)} from the prior period.`);
  if (Number.isFinite(inventoryChange)) alerts.push(`Inventory changed ${formatPercent(inventoryChange)} from the prior period.`);
  return alerts;
}

type ManagementQuestion = { category: string; question: string };

function latestNonZeroValue(values: number[]): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index]) && values[index] !== 0) return values[index];
  }
  return 0;
}

function topReportRows(report: any, limit = 3): Array<{ label: string; value: number }> {
  if (!report) return [];
  const periods = reportPeriods(report);
  if (!periods.length) return [];
  return collectRows(report?.Rows, periods.length)
    .filter((row) => row.type !== "Section")
    .map((row) => ({ label: row.label, value: latestNonZeroValue(row.values) }))
    .filter((row) => row.label && Number.isFinite(row.value) && row.value !== 0 && !/^total|^net income|^gross profit|^operating income/i.test(row.label))
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
    .filter((row) => row.label && Number.isFinite(row.current) && row.current !== 0)
    .filter((row) => !/^total|^net income|^gross profit|^operating income/i.test(row.label));
}

function detailDriverFromRow(row: { label: string; current: number; previous: number }, direction: "up" | "down"): DetailDriver {
  const change = row.current - row.previous;
  return {
    name: row.label,
    current: row.current,
    previous: row.previous,
    change,
    percentChange: row.previous === 0 ? 0 : (change / Math.abs(row.previous)) * 100,
    direction,
    impact: Math.abs(change),
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
  customerUps.forEach((row) => details.push(detailDriverFromRow(row, "up")));
  customerDowns.forEach((row) => details.push(detailDriverFromRow(row, "down")));
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
  expenseUps.forEach((row) => details.push(detailDriverFromRow(row, "up")));
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
      managementQuestion: `What caused ${expenseUps[0].label} to increase by ${currency.format(expenseUps[0].change)} versus the prior period?`,
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
  vendorUps.forEach((row) => details.push(detailDriverFromRow(row, "up")));
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

  const receivables = reportRowsWithPeriods(detailReports.agedReceivables).sort((a, b) => Math.abs(b.current) - Math.abs(a.current));
  if (receivables.length) {
    const top = receivables[0];
    drivers.push({
      id: "receivables-concentration",
      category: "Cash",
      title: "Receivables are concentrated",
      observation: `${top.label} has the largest reported receivables balance at ${currency.format(Math.abs(top.current))}.`,
      evidence: receivables.slice(0, 3).map((row) => `${row.label}: ${currency.format(Math.abs(row.current))}`),
      direction: "watch",
      severity: "Medium",
      impact: Math.min(10, Math.max(1, Math.round(Math.abs(top.current) / 10000))),
      confidence: 0.9,
      managementQuestion: `How old is ${top.label}'s ${currency.format(Math.abs(top.current))} receivables balance, and when is it expected to convert to cash?`,
    });
    relationships.push(`The largest reported receivables balance is ${top.label} at ${currency.format(Math.abs(top.current))}.`);
  } else {
    unknowns.push("Accounts-receivable detail was not available, so ClearCFO cannot attribute cash pressure to specific customers.");
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

function buildManagementQuestions(detailReports: Record<string, any>): ManagementQuestion[] {
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
  }

  const vendors = topReportRows(detailReports.expenseByVendor, 3);
  if (vendors.length) {
    const top = vendors[0];
    questions.push({
      category: "Expenses",
      question: `Which vendor relationships are driving spending? ${top.label} is the largest reported vendor at ${currency.format(Math.abs(top.value))}; review whether the spend is recurring, necessary, or unusually high versus prior periods.`,
    });
  }

  const expenses = topReportRows(detailReports.profitAndLossDetail, 5)
    .filter((row) => !/income|revenue|sales|cost of goods|gross profit/i.test(row.label));
  if (expenses.length) {
    const top = expenses[0];
    questions.push({
      category: "Profitability",
      question: `What is driving the expense line ${top.label}? QuickBooks shows ${currency.format(Math.abs(top.value))} in the latest reported period; compare it with the prior period before deciding whether the movement is structural or temporary.`,
    });
  }

  const receivables = topReportRows(detailReports.agedReceivables, 3);
  if (receivables.length) {
    const top = receivables[0];
    questions.push({
      category: "Cash",
      question: `Which receivables need attention? ${top.label} is the largest customer balance returned in the aged-receivables detail at ${currency.format(Math.abs(top.value))}; review age and collection timing before relying on the balance as available cash.`,
    });
  }

  const inventory = topReportRows(detailReports.inventoryValuation, 3);
  if (inventory.length) {
    const top = inventory[0];
    questions.push({
      category: "Inventory",
      question: `What is tying up the most inventory cash? ${top.label} has the largest reported inventory value at ${currency.format(Math.abs(top.value))}; compare its value with recent sales velocity and aging.`,
    });
  }

  return questions.slice(0, 5);
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
  const cash = balancePeriods.length ? pickSeries(balanceRows, [/^cashandcashequivalents$/, /^cash$/, /^cashandbank$/, /^bankaccounts$/], [/^total cash and cash equivalents$/, /^cash and cash equivalents$/, /^total cash$/, /^total bank accounts$/], balancePeriods.length) : null;
  const inventory = balancePeriods.length ? pickSeries(balanceRows, [/^inventoryasset$/, /^inventory$/], [/^total inventory asset$/, /^total inventory$/, /^inventory asset$/, /^inventory$/], balancePeriods.length) : null;
  const checkingSavings = balancePeriods.length ? sumDataRows(balanceRows, [/^checking$/, /^savings$/, /^undeposited funds$/, /^cash on hand$/], balancePeriods.length) : [];
  const cashSeries = cash || (checkingSavings.some((value) => value !== 0) ? checkingSavings : null);

  const cashAligned = cashSeries ? cashSeries.slice(0, activePeriods.length) : [];
  const inventoryAligned = inventory ? inventory.slice(0, activePeriods.length) : [];
  const current = activePeriods.length - 1;
  const previous = current - 1;

  const currentRevenue = activeRevenue[current] || 0;
  const previousRevenue = previous >= 0 ? activeRevenue[previous] || 0 : 0;
  const currentGrossProfit = activeGrossProfit[current] || 0;
  const previousGrossProfit = previous >= 0 ? activeGrossProfit[previous] || 0 : 0;
  const currentCash = cashAligned[current] || 0;
  const previousCash = previous >= 0 ? cashAligned[previous] || 0 : 0;
  const currentInventory = inventoryAligned[current] || 0;
  const previousInventory = previous >= 0 ? inventoryAligned[previous] || 0 : 0;
  const currentExpense = activeExpenses[current] || 0;
  const previousExpense = previous >= 0 ? activeExpenses[previous] || 0 : 0;

  const revenueChange = previous >= 0 ? changePercent(currentRevenue, previousRevenue) : Number.NaN;
  const grossMargin = currentRevenue ? (currentGrossProfit / currentRevenue) * 100 : 0;
  const previousMargin = previous >= 0 && previousRevenue ? (previousGrossProfit / previousRevenue) * 100 : Number.NaN;
  const marginChange = Number.isFinite(previousMargin) ? grossMargin - previousMargin : Number.NaN;
  const cashChange = previous >= 0 ? changePercent(currentCash, previousCash) : Number.NaN;
  const inventoryChange = previous >= 0 ? changePercent(currentInventory, previousInventory) : Number.NaN;
  const expenseChange = previous >= 0 ? changePercent(currentExpense, previousExpense) : Number.NaN;
  const previousCogs = previous >= 0 ? activeCogs[previous] || 0 : 0;
  const currentCogsValue = activeCogs[current] || 0;
  const drivers = buildDrivers(revenueChange, marginChange, cashChange, inventoryChange, expenseChange, previousCogs, currentCogsValue, previousExpense, currentExpense);
  const alerts = buildAlerts(revenueChange, cashChange, inventoryChange, expenseChange);

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
    inventory: currentInventory,
    inventoryChange,
    operatingExpense: currentExpense,
    previousOperatingExpense: previousExpense,
    attention: drivers.length,
    alerts,
    recommendation: drivers[0]?.observation || "Review the latest QuickBooks financial signals and determine the most important management action.",
    impact: drivers[0]?.impact || 0,
    impactReason: drivers[0]?.observation || "No major exceptions were detected.",
    trend: trendSeries[0].values,
    periods: trendSeries[0].periods,
    health: drivers.some((driver) => driver.severity === "High") ? "attention" : drivers.length ? "watch" : "strong",
    confidence: nonEmptySeries.length >= 3 ? 0.92 : 0.82,
    source: "upload",
    drivers,
    managementQuestions: buildManagementQuestions(detailReports),
    relationships: drivers.map((driver) => driver.observation),
    detailDrivers: [],
    trendInsights: [],
    trendSeries,
    unknowns: [
      ...(cashSeries ? [] : ["QuickBooks did not return a cash balance series for the requested periods."]),
      ...(inventory ? [] : ["QuickBooks did not return an inventory balance series for the requested periods."]),
    ],
  };
}
