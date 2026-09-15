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
  const parsed = Number(String(value ?? "").replace(/[$,%(),]/g, (match) => match === "(" ? "-" : ""));
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
  // QuickBooks can return matching summary/group rows whose values are all zero.
  // Only treat a row as normalized data when it contains an actual value.
  for (const row of rows) {
    const normalized = clean(row.label);
    if (!patterns.some((pattern) => pattern.test(normalized))) continue;
    if (row.values.some((value) => Number.isFinite(value) && value !== 0)) {
      return row;
    }
  }

  return null;
}

function align(values: number[], length: number): number[] {
  if (values.length === length) return values;
  if (values.length > length) return values.slice(-length);
  return Array.from({ length }, (_, index) => values[index] ?? 0);
}

function reportMatrix(report: any, mappings: { name: string; patterns: RegExp[] }[]): { periods: string[]; rows: (string | number)[][] } {
  const reportPeriods = periods(report);
  const rows = collectRows(report?.Rows);
  return {
    periods: reportPeriods,
    rows: mappings.flatMap(({ name, patterns }) => {
      const row = findRow(rows, patterns);
      return row ? [[name, ...align(row.values, reportPeriods.length)]] : [];
    }),
  };
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
    { name: "Revenue", patterns: [/^income$/, /^total income$/, /^revenue$/, /^sales$/] },
    { name: "Gross Profit", patterns: [/^gross profit$/] },
    { name: "Cost of Goods Sold", patterns: [/^cost of goods sold$/, /^cost of sales$/, /^cost of goods$/] },
    { name: "Operating Expenses", patterns: [/^expenses$/, /^total expenses$/, /^operating expenses$/] },
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

  // Balance-sheet data is optional. If QuickBooks does not expose a populated
  // cash/inventory row, do not create a partial Balance Sheet that the Excel
  // analyzer could misinterpret. The P&L can still produce a valid briefing.
  if (balance.periods.length && balance.rows.length) {
    const balanceSheet = XLSX.utils.aoa_to_sheet([
      ["Account", ...balance.periods],
      ...balance.rows,
    ]);
    XLSX.utils.book_append_sheet(workbook, balanceSheet, "Balance Sheet");
  }

  const briefing = analyzeWorkbook(workbook);
  return {
    ...briefing,
    companyName: companyName || briefing.companyName || "Your business",
  };
}
