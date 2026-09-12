import { NextResponse } from "next/server";
import { quickBooksReport, requireCurrentUser } from "../../../../lib/quickbooks";

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
  const wanted = new Set(["Income", "Cost of Goods Sold", "Gross Profit", "Expenses", "Net Operating Income", "Other Income", "Other Expense", "Net Income"]);
  const metrics: Record<string, number[]> = {};

  for (const row of rows) {
    const cells = row?.ColData || [];
    const label = String(cells[0]?.value || "").trim();
    if (!wanted.has(label)) continue;
    metrics[label] = cells.slice(1).map((cell: any) => Number(cell?.value || 0) || 0);
  }

  return { periods, metrics };
}

export async function GET() {
  try {
    const user = await requireCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - 5);
    start.setDate(1);

    const pnl = await quickBooksReport(user.id, "ProfitAndLoss", {
      start_date: isoDate(start),
      end_date: isoDate(end),
      summarize_column_by: "Month",
    });

    const balanceSheet = await quickBooksReport(user.id, "BalanceSheet", {
      start_date: isoDate(end),
      end_date: isoDate(end),
    });

    const parsed = parseProfitAndLoss(pnl);

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      periods: parsed.periods,
      metrics: parsed.metrics,
      reports: { profitAndLoss: pnl, balanceSheet },
    });
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Sync failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "QuickBooks sync failed." }, { status: 500 });
  }
}
