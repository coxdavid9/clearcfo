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

  if (Array.isArray(node.Row)) {
    for (const row of node.Row) {
      const cells = row?.ColData || [];
      const label = String(cells[0]?.value || "").trim();
      if (label) output.push({ label, values: cells.slice(1).map((cell: any) => toNumber(cell?.value)) });

      // QuickBooks puts important report totals in Summary.ColData rather than
      // Row.ColData (for example Total Income, Total Expenses, Gross Profit,
      // and Net Income). The old adapter ignored these rows, so the API was
      // returning real financial data but ClearCFO was building zero KPIs.
      const summaryCells = row?.Summary?.ColData || [];
      const summaryLabel = String(summaryCells[0]?.value || "").trim();
      if (summaryLabel) {
        output.push({
          label: summaryLabel,
          values: summaryCells.slice(1).map((cell: any) => toNumber(cell?.value)),
        });
      }

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
  const collected = collectRows(report?.Rows);
  const rows = mappings.flatMap(({ name, patterns }) => {
    const row = findRow(collected, patterns);
    return row ? [[name, ...align(row.values, reportPeriods.length)]] : [];
  });
  return trimTrailingEmptyPeriods(reportPeriods, rows);
}

/**
 * Convert the QuickBooks report response into the same normalized input shape
 * used by Excel uploads. This keeps the financial calculations and management
 * logic in one place instead of creating a second CFO engine for QuickBooks.
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

  const balance = reportMatrix(balanceSheet, [
    { name: "Cash", patterns: [/^total cash and cash equivalents$/, /^cash and cash equivalents$/, /^total cash$/, /^cash$/] },
    { name: "Inventory", patterns: [/^total inventory asset$/, /^total inventory$/, /^inventory asset$/, /^inventory$/] },
  ]);

  const workbook = XLSX.utils.book_new();
  const pnlSheet = XLSX.utils.aoa_to_sheet([
    ["Metric", ...pnl.periods],
    ...pnl.rows,
  ]);
  XLSX.utils.book_append_sheet(workbook, pnlSheet, "Monthly P&L");

  if (balance.rows.length) {
    const currentIndex = Math.max(0, balance.periods.length - 1);
    const priorIndex = Math.max(0, currentIndex - 1);
    const normalizedBalanceRows = balance.rows.map(([name, ...values]) => [
      name,
      toNumber(values[currentIndex]),
      toNumber(values[priorIndex]),
    ]);

    const balanceSheet = XLSX.utils.aoa_to_sheet([
      ["Account", "Current", "Prior"],
      ...normalizedBalanceRows,
    ]);
    XLSX.utils.book_append_sheet(workbook, balanceSheet, "Balance Sheet");
  }

  const briefing = analyzeWorkbook(workbook);
  return {
    ...briefing,
    companyName: companyName || briefing.companyName || "Your business",
  };
}
