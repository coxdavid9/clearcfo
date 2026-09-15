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

function parseProfitAndLoss(report: any) {
  const columns = report?.Columns?.Column || [];
  const periods = columns.slice(1).map((column: any) => column?.ColTitle || "");
  const rows = collectRows(report?.Rows);
  const wanted = new Set(["Income", "Total Income", "Revenue", "Sales", "Cost of Goods Sold", "Gross Profit", "Expenses", "Total Expenses", "Operating Expenses", "Net Operating Income", "Other Income", "Other Expense", "Net Income"]);
  const metrics: Record<string, number[]> = {};

  for (const row of rows) {
    const cells = row?.ColData || [];
    const label = String(cells[0]?.value || "").trim();
    if (!wanted.has(label)) continue;
    metrics[label] = cells.slice(1).map((cell: any) => Number(cell?.value || 0) || 0);
  }

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
    const isSandbox = process.env.QUICKBOOKS_ENVIRONMENT === "sandbox";
    // Intuit sandbox companies can contain sample transactions that pre-date
    // the current calendar year. Production customers should see a focused
    // recent history; sandbox testing gets a wider window so the sample data
    // can actually exercise the financial engine.
    const start = new Date(end);
    start.setMonth(start.getMonth() - (isSandbox ? 60 : 12));
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

    if (!reportHasFinancialValues(pnl)) {
      throw new Error(
        isSandbox
          ? "QuickBooks is connected, but the sandbox company has no financial activity in the last five years. Add a few sample transactions in the Intuit sandbox, then sync again."
          : "QuickBooks is connected, but no financial activity was returned for the selected period."
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
