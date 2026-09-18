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

    // Day-matched MTD: daily P&L for the elapsed days of the current month
    // and the same days of the previous month (capped at the previous
    // month's length, e.g. Mar 31 -> Feb 1-28).
    const currentMonthStart = new Date(end.getFullYear(), end.getMonth(), 1);
    const prevMonthStart = new Date(end.getFullYear(), end.getMonth() - 1, 1);
    const prevMonthLength = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    const prevMonthEnd = new Date(end.getFullYear(), end.getMonth() - 1, Math.min(end.getDate(), prevMonthLength));

    const [pnl, balanceSheet, connection] = await Promise.all([
      quickBooksReport(user.id, "ProfitAndLoss", reportParams),
      quickBooksReport(user.id, "BalanceSheet", reportParams),
      getQuickBooksConnection(user.id),
    ]);

    const detailReportRequests = {
      profitAndLossDetail: quickBooksReport(user.id, "ProfitAndLossDetail", reportParams),
      incomeByCustomer: quickBooksReport(user.id, "IncomeByCustomerSummary", reportParams),
      expenseByVendor: quickBooksReport(user.id, "ExpenseByVendorSummary", reportParams),
      agedReceivables: quickBooksReport(user.id, "AgedReceivableDetail", { end_date: reportParams.end_date }),
      agedPayables: quickBooksReport(user.id, "AgedPayableDetail", { end_date: reportParams.end_date }),
      inventoryValuation: quickBooksReport(user.id, "InventoryValuationSummary", { end_date: reportParams.end_date }),
      mtdCurrent: quickBooksReport(user.id, "ProfitAndLoss", { start_date: isoDate(currentMonthStart), end_date: isoDate(end), summarize_column_by: "Day" }),
      mtdPrevious: quickBooksReport(user.id, "ProfitAndLoss", { start_date: isoDate(prevMonthStart), end_date: isoDate(prevMonthEnd), summarize_column_by: "Day" }),
    } as const;

    const detailEntries = await Promise.all(
      Object.entries(detailReportRequests).map(async ([name, request]) => {
        try {
          return [name, await request] as const;
        } catch (error) {
          console.warn(`[ClearCFO QuickBooks] Optional detail report skipped: ${name}`, error instanceof Error ? error.message : error);
          return [name, null] as const;
        }
      })
    );
    const detailReports = Object.fromEntries(detailEntries);

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

    const briefing = buildQuickBooksBriefing(pnl, balanceSheet, connection?.companyName || null, detailReports);
    // Raw reports are not consumed by the client and can be megabytes of JSON. Keep the diagnostics summary, which is the inspectable record.
    return NextResponse.json({ ok: true, syncedAt: new Date().toISOString(), source: "quickbooks", companyId: connection?.companyId || null, periods: briefing.periods, trendSeries: briefing.trendSeries, briefing, diagnostics }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Sync failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "QuickBooks sync failed." }, { status: 500 });
  }
}
