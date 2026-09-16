import { NextResponse } from "next/server";
import { quickBooksReport, requireCurrentUser, getQuickBooksConnection } from "../../../../lib/quickbooks";
import { buildQuickBooksBriefing } from "../../../../lib/quickbooks-briefing";

export const runtime = "nodejs";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function collectRows(node: any, output: any[] = []) {
  if (!node) return output;
  if (Array.isArray(node)) {
    for (const item of node) collectRows(item, output);
    return output;
  }
  if (typeof node !== "object") return output;
  if (node.ColData) output.push(node);
  if (node.Summary?.ColData) output.push(node);
  if (node.Rows) collectRows(node.Rows, output);
  if (Array.isArray(node.Row)) {
    for (const row of node.Row) collectRows(row, output);
  }
  return output;
}

function summarizeReport(report: any) {
  const columns = report?.Columns?.Column || [];
  const rows = collectRows(report?.Rows);
  const labels = rows
    .map((row) => String(row?.ColData?.[0]?.value || row?.Summary?.ColData?.[0]?.value || "").trim())
    .filter(Boolean);
  const nonZeroCells = rows.reduce((count, row) => {
    const cells = row?.ColData || row?.Summary?.ColData || [];
    const values = cells.slice(1);
    return count + values.filter((cell: any) => {
      const value = Number(String(cell?.value ?? "").replace(/,/g, ""));
      return Number.isFinite(value) && value !== 0;
    }).length;
  }, 0);
  return {
    header: report?.Header ? {
      startPeriod: report.Header.StartPeriod || null,
      endPeriod: report.Header.EndPeriod || null,
      time: report.Header.Time || null,
      reportName: report.Header.ReportName || null,
    } : null,
    columns: columns.map((column: any) => column?.ColTitle || ""),
    rowCount: rows.length,
    nonZeroCells,
    sampleLabels: Array.from(new Set(labels)).slice(0, 40),
  };
}

function reportHasFinancialValues(report: any) {
  const rows = collectRows(report?.Rows);
  return rows.some((row) => {
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

    const reportParams = {
      start_date: isoDate(start),
      end_date: isoDate(end),
      summarize_column_by: "Month",
    };

    const [pnl, balanceSheet, connection] = await Promise.all([
      quickBooksReport(user.id, "ProfitAndLoss", reportParams),
      quickBooksReport(user.id, "BalanceSheet", reportParams),
      getQuickBooksConnection(user.id),
    ]);

    console.info("[ClearCFO QuickBooks] Report diagnostics", {
      environment: process.env.QUICKBOOKS_ENVIRONMENT || "unknown",
      company: connection?.companyName || null,
      realmId: connection?.realmId || null,
      reportParams,
      profitAndLoss: summarizeReport(pnl),
      balanceSheet: summarizeReport(balanceSheet),
    });

    if (!reportHasFinancialValues(pnl)) {
      throw new Error("QuickBooks is connected, but no financial activity was returned for the selected period.");
    }

    const briefing = buildQuickBooksBriefing(pnl, balanceSheet, connection?.companyName || null);

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      source: "quickbooks",
      periods: briefing.periods,
      trendSeries: briefing.trendSeries,
      briefing,
      reports: { profitAndLoss: pnl, balanceSheet },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Sync failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "QuickBooks sync failed." }, { status: 500 });
  }
}
