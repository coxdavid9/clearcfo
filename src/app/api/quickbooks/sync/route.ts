import { NextResponse } from "next/server";
import { quickBooksReport, requireCurrentUser, getQuickBooksConnection } from "../../../../lib/quickbooks-company";
import { buildQuickBooksBriefing } from "../../../../lib/quickbooks-briefing";

export const runtime = "nodejs";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function collectRows(node: any, output: any[] = []) {
  if (!node) return output;
  if (Array.isArray(node)) { for (const item of node) collectRows(item, output); return output; }
  if (typeof node !== "object") return output;
  if (node.ColData) output.push(node);
  if (node.Summary?.ColData) output.push(node);
  if (node.Rows) collectRows(node.Rows, output);
  if (Array.isArray(node.Row)) for (const row of node.Row) collectRows(row, output);
  return output;
}

function cellValue(cell: any) { return cell?.value ?? ""; }
function numericCells(row: any) {
  const cells = row?.ColData || row?.Summary?.ColData || [];
  return cells.slice(1).map((cell: any) => cellValue(cell));
}
function rowLabel(row: any) {
  const cells = row?.ColData || row?.Summary?.ColData || [];
  return String(cells?.[0]?.value || "").trim();
}
function summarizeReport(report: any) {
  const columns = report?.Columns?.Column || [];
  const rows = collectRows(report?.Rows);
  const labels = rows.map((row) => rowLabel(row)).filter(Boolean);
  return {
    header: report?.Header ? { startPeriod: report.Header.StartPeriod || null, endPeriod: report.Header.EndPeriod || null, time: report.Header.Time || null, reportName: report.Header.ReportName || null } : null,
    columns: columns.map((column: any) => column?.ColTitle || ""),
    rows: rows.map((row) => ({ label: rowLabel(row), group: String(row?.group || ""), type: String(row?.type || ""), values: numericCells(row) })).filter((row) => row.label),
    uniqueLabels: Array.from(new Set(labels)).slice(0, 100),
  };
}
function reportHasFinancialValues(report: any) {
  return collectRows(report?.Rows).some((row) => {
    const cells = row?.ColData || row?.Summary?.ColData || [];
    return cells.slice(1).some((cell: any) => {
      const value = Number(String(cell?.value ?? "").replace(/,/g, ""));
      return Number.isFinite(value) && value !== 0;
    });
  });
}

export async function GET() {
  try {
    const user = await requireCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    const reportParams = { start_date: isoDate(start), end_date: isoDate(end), summarize_column_by: "Month" };

    const [pnl, balanceSheet, connection] = await Promise.all([
      quickBooksReport(user.id, "ProfitAndLoss", reportParams),
      quickBooksReport(user.id, "BalanceSheet", reportParams),
      getQuickBooksConnection(user.id),
    ]);

    const diagnostics = {
      generatedAt: new Date().toISOString(),
      environment: process.env.QUICKBOOKS_ENVIRONMENT || "unknown",
      company: connection?.companyName || null,
      companyId: connection?.companyId || null,
      realmId: connection?.realmId || null,
      requestedRange: reportParams,
      profitAndLoss: summarizeReport(pnl),
      balanceSheet: summarizeReport(balanceSheet),
    };
    console.info("[ClearCFO QuickBooks] Report diagnostics", diagnostics);

    if (!reportHasFinancialValues(pnl)) throw new Error("QuickBooks is connected, but no financial activity was returned for the selected period.");

    const briefing = buildQuickBooksBriefing(pnl, balanceSheet, connection?.companyName || null);
    return NextResponse.json({ ok: true, syncedAt: new Date().toISOString(), source: "quickbooks", periods: briefing.periods, trendSeries: briefing.trendSeries, briefing, diagnostics, reports: { profitAndLoss: pnl, balanceSheet } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Sync failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "QuickBooks sync failed." }, { status: 500 });
  }
}
