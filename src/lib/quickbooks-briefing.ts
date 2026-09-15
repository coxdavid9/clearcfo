import * as XLSX from "xlsx";
import { analyzeWorkbook } from "./briefing/engine";
import type { BriefingData } from "./briefing/engine";

type ReportRow = {
  label: string;
  values: number[];
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

function collectRows(node: any, output: ReportRow[] = []): ReportRow[] {
  if (!node) return output;
  if (Array.isArray(node)) {
    for (const item of node) collectRows(item, output);
    return output;
  }
  if (typeof node !== "object") return output;

  const summaryCells = node.Summary?.ColData || [];
  const summaryLabel = String(summaryCells[0]?.value || "").trim();
  if (summaryLabel) {
    output.push({
      label: summaryLabel,
      values: summaryCells.slice(1).map((cell: any) => toNumber(cell?.value)),
    });
  }

  if (Array.isArray(node.Row)) {
    for (const row of node.Row) {
      const cells = row?.ColData || [];
      const label = String(cells[0]?.value || "").trim();
      if (label) output.push({ label, values: cells.slice(1).map((cell: any) => toNumber(cell?.value)) });
      collectRows(row, output);
    }
  }
  if (node.Rows) collectRows(node.Rows, output);
  return output;
}

function periods(report: any): string[] {
  return (report?.Columns?.Column || [])
    .slice(1)
    .map((column: any) => String(column?.ColTitle || "").trim())
    .filter(Boolean);
}

function findRow(rows: ReportRow[], patterns: RegExp[]): ReportRow | null {
  for (const row of rows) {
    const normalized = clean(row.label);
    if (!patterns.some((pattern) => pattern.test(normalized))) continue;
    if (row.values.some((value) => Number.isFinite(value) && value !== 0)) return row;
  }
  return null;
}

function findAggregateRow(
  rows: ReportRow[],
  preferredPatterns: RegExp[],
  componentPatterns: RegExp[]
): ReportRow | null {
  const preferred = findRow(rows, preferredPatterns);
  if (preferred) return preferred;

  const components = rows.filter((row) => {
    const normalized = clean(row.label);
    return componentPatterns.some((pattern) => pattern.test(normalized));
  });

  if (!components.length) return null;

  const length = Math.max(...components.map((row) => row.values.length));
  return {
    label: "Cash",
    values: Array.from({ length }, (_, index) =>
      components.reduce((sum, row) => sum + (row.values[index] || 0), 0)
    ),
  };
}

function align(values: number[], length: number): number[] {
  if (values.length === length) return values;
  if (values.length > length) return values.slice(-length);
  return Array.from({ length }, (_, index) => values[index] ?? 0);
}

function trimTrailingEmptyPeriods(
  reportPeriods: string[],
  rows: (string | number)[][]
): { periods: string[]; rows: (string | number)[][] } {
  let end = reportPeriods.length;

  while (end > 1) {
    const hasValue = rows.some((row) => {
      const value = row[end];
      return typeof value === "number" && Number.isFinite(value) && value !== 0;
    });
    if (hasValue) break;
    end -= 1;
  }

  return {
    periods: reportPeriods.slice(0, end),
    rows: rows.map((row) => row.slice(0, end + 1)),
  };
}

function reportMatrix(report: any, mappings: { name: string; patterns: RegExp[] }[]): { periods: string[]; rows: (string | number)[][] } {
  const reportPeriods = periods(report);
  const collected = collectRows(report);
  const rows = mappings.flatMap(({ name, patterns }) => {
    const row = findRow(collected, patterns);
    return row ? [[name, ...align(row.values, reportPeriods.length)]] : [];
  });
  return trimTrailingEmptyPeriods(reportPeriods, rows);
}

/**
 * Convert the QuickBooks report response into the same normalized input shape
 * used by Excel uploads. Balance-sheet metrics are merged into the normalized
 * monthly sheet so the shared briefing engine can calculate KPIs and changes
 * from the same current/prior periods.
 */
export function buildQuickBooksBriefing(
  profitAndLoss: any,
  balanceSheet: any,
  companyName: string | null
): BriefingData {
  const pnl = reportMatrix(profitAndLoss, [
    { name: "Revenue", patterns: [/^total income$/, /^total revenue$/, /^net revenue$/, /^total sales$/, /^net sales$/, /^income$/, /^revenue$/, /^sales$/] },
    { name: "Gross Profit", patterns: [/^gross profit$/] },
    { name: "Cost of Goods Sold", patterns: [/^total cost of goods sold$/, /^cost of goods sold$/, /^cost of sales$/, /^cost of goods$/, /^cost of revenue$/] },
    { name: "Operating Expenses", patterns: [/^total operating expenses$/, /^operating expenses$/, /^total expenses$/, /^expenses$/] },
    { name: "Net Income", patterns: [/^net income$/, /^net operating income$/] },
  ]);

  if (!pnl.periods.length || !pnl.rows.length) {
    throw new Error("ClearCFO received a QuickBooks P&L report, but could not normalize its reporting periods or financial rows.");
  }

  const balancePeriods = periods(balanceSheet);
  const balanceCollected = collectRows(balanceSheet);
  const cash = findAggregateRow(
    balanceCollected,
    [/^total cash and cash equivalents$/, /^cash and cash equivalents$/, /^total cash$/],
    [/^checking$/, /^savings$/, /^cash$/, /^undeposited funds$/, /^cash on hand$/]
  );
  const inventory = findRow(balanceCollected, [
    /^total inventory asset$/, /^total inventory$/, /^inventory asset$/, /^inventory$/
  ]);

  const cashValues = cash ? align(cash.values, pnl.periods.length) : null;
  const inventoryValues = inventory ? align(inventory.values, pnl.periods.length) : null;

  const mergedRows: (string | number)[][] = [...pnl.rows];
  if (cashValues) mergedRows.push(["Cash", ...cashValues]);
  if (inventoryValues) mergedRows.push(["Inventory", ...inventoryValues]);

  const workbook = XLSX.utils.book_new();
  const pnlSheet = XLSX.utils.aoa_to_sheet([
    ["Metric", ...pnl.periods],
    ...mergedRows,
  ]);
  XLSX.utils.book_append_sheet(workbook, pnlSheet, "Monthly P&L");

  const briefing = analyzeWorkbook(workbook);
  return {
    ...briefing,
    companyName: companyName || briefing.companyName || "Your business",
    source: "upload",
  };
}
