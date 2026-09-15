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
  if (Array.isArray(node.Row)) {
    for (const row of node.Row) {
      output.push(row);
      collectRows(row, output);
    }
  }
  if (node.Rows) collectRows(node.Rows, output);
  return output;
}

function summarizeReport(report: any) {
  const columns = report?.Columns?.Column || [];
  const rows = collectRows(report?.Rows);
  const labels = rows
    .map((row) => String(row?.ColData?.[0]?.value || "").trim())
    .filter(Boolean);
  const nonZeroCells = rows.reduce((count, row) => {
    const values = (row?.ColData || []).slice(1);
    return count + values.filter((cell: any) => {
      const value = Number(cell?.value || 0);
      return Number.isFinite(value) && value !== 0;
    }).length;
  }, 0);

  return {
    header: report?.Header
      ? {
          startPeriod: report.Header.StartPeriod || null,
          endPeriod: report.Header.EndPeriod || null,
          time: report.Header.Time || null,
          reportName: report.Header.ReportName || null,
        }
      : null,
    columns: columns.map((column: any) => column?.ColTitle || ""),
    rowCount: rows.length,
    nonZeroCells,
    sampleLabels: labels.slice(0, 30),
  };
}

function parseProfitAndLoss(report: any) {
  const columns = report?.Columns?.Column || [];
  const rawPeriods = columns.slice(1).map((column: any) => column?.ColTitle || "");
  const rows = collectRows(report?.Rows);
  const wanted = new Set([
    "Income", "Total Income", "Revenue", "Sales",
    "Cost of Goods Sold", "Gross Profit", "Expenses", "Total Expenses", "Operating Expenses",
    "Net Operating Income", "Other Income", "Other Expense", "Net Income",
  ]);
  const metrics: Record<string, number[]> = {};

  for (const row of rows) {
    const cells = row?.ColData || [];
    const label = String(cells[0]?.value || "").trim();
    if (!wanted.has(label)) continue;
    metrics[label] = cells.slice(1).map((cell: any) => Number(cell?.value || 0) || 0);
  }

  // QuickBooks can include the current partial month as the last column.
  // Do not report that empty period as the "latest" financial result.
  let end = rawPeriods.length;
  while (end > 1) {
    const hasValue = Object.values(metrics).some((values) => {
      const value = values[end - 1];
      return typeof value === "number" && Number.isFinite(value) && value !== 0;
    });
    if (hasValue) break;
    end -= 1;
  }

  const periods = rawPeriods.slice(0, end);
  for (const key of Object.keys(metrics)) metrics[key] = metrics[key].slice(0, end);

  return { periods, metrics };
}

function reportHasFinancialValues(report: any) {
  const rows = collectRows(report?.Rows);
  return rows.some((row) => {
    const values = (row?.ColData || []).slice(1);
    return values.some((cell: any) => {
      const value = Number(cell?.value || 0);
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
    start.setMonth(start.getMonth() - 12);
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

    const pnlSummary = summarizeReport(pnl);
    const balanceSummary = summarizeReport(balanceSheet);
    console.info("[ClearCFO QuickBooks] Report diagnostics", {
      environment: process.env.QUICKBOOKS_ENVIRONMENT || "unknown",
      company: connection?.companyName || null,
      realmId: connection?.realmId || null,
      reportParams,
      profitAndLoss: pnlSummary,
      balanceSheet: balanceSummary,
    });

    if (!reportHasFinancialValues(pnl)) {
      throw new Error(
        "QuickBooks is connected, but no financial activity was returned for the selected period."
      );
    }

    const parsed = parseProfitAndLoss(pnl);
    const briefing = buildQuickBooksBriefing(pnl, balanceSheet, connection?.companyName || null);

    return NextResponse.json(
      {
        ok: true,
        syncedAt: new Date().toISOString(),
        source: "quickbooks",
        periods: parsed.periods,
        metrics: parsed.metrics,
        briefing,
        reports: { profitAndLoss: pnl, balanceSheet },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Sync failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "QuickBooks sync failed." }, { status: 500 });
  }
}
