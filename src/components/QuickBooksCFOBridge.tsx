"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

type SyncReport = {
  Columns?: { Column?: { ColTitle?: string }[] };
  Rows?: unknown;
};

type SyncPayload = {
  ok: boolean;
  syncedAt: string;
  periods: string[];
  reports: {
    profitAndLoss: SyncReport;
    balanceSheet: SyncReport;
    balanceSheetPrior?: SyncReport;
  };
};

function columns(report: SyncReport): string[] {
  return (report.Columns?.Column ?? []).slice(1).map((column) => String(column.ColTitle ?? "").trim());
}

function rows(node: any, output: { label: string; values: number[] }[] = []) {
  if (!node) return output;
  if (Array.isArray(node)) {
    node.forEach((item) => rows(item, output));
    return output;
  }
  if (typeof node !== "object") return output;
  if (Array.isArray(node.Row)) {
    node.Row.forEach((row: any) => {
      const cells = Array.isArray(row?.ColData) ? row.ColData : [];
      const label = String(cells[0]?.value ?? "").trim();
      const values = cells.slice(1).map((cell: any) => Number(String(cell?.value ?? "").replace(/[$,()%]/g, "")) || 0);
      if (label && values.some((value: number) => value !== 0)) output.push({ label, values });
      rows(row, output);
    });
  }
  if (node.Rows) rows(node.Rows, output);
  return output;
}

function canonicalPnlLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (normalized === "income") return "Revenue";
  if (normalized === "expenses") return "Operating Expenses";
  if (normalized === "cost of goods sold") return "Cost of Goods Sold";
  if (normalized === "gross profit") return "Gross Profit";
  return label;
}

function canonicalBalanceLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (/^total cash and cash equivalents$|^cash and cash equivalents$|^cash equivalents$/.test(normalized)) return "Cash";
  if (/^inventory asset$|^total inventory$|^inventory$/.test(normalized)) return "Inventory";
  return label;
}

function makeWorkbook(payload: SyncPayload, companyName: string) {
  const pnlPeriods = columns(payload.reports.profitAndLoss);
  const pnlRows = rows(payload.reports.profitAndLoss);
  const pnl: (string | number)[][] = [["Company", companyName || "QuickBooks Online company"], ["Metric", ...pnlPeriods]];
  pnlRows.forEach((row) => pnl.push([canonicalPnlLabel(row.label), ...row.values]));

  const current = rows(payload.reports.balanceSheet);
  const prior = rows(payload.reports.balanceSheetPrior);
  const priorMap = new Map(prior.map((row) => [canonicalBalanceLabel(row.label).toLowerCase(), row.values[0] ?? 0]));
  const balance: (string | number)[][] = [["Account", "Current", "Prior"]];
  current.forEach((row) => balance.push([canonicalBalanceLabel(row.label), row.values[row.values.length - 1] ?? 0, priorMap.get(canonicalBalanceLabel(row.label).toLowerCase()) ?? 0]));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(pnl), "Monthly P&L");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(balance), "Balance Sheet");
  return workbook;
}

function loadIntoBriefing(payload: SyncPayload, companyName: string) {
  const bytes = XLSX.write(makeWorkbook(payload, companyName), { bookType: "xlsx", type: "array" });
  const file = new File([bytes], "clearcfo-quickbooks.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const input = document.querySelector<HTMLInputElement>('input[type="file"][accept=".xlsx,.xls,.csv"]');
  if (!input) throw new Error("CFO Briefing is not ready to receive QuickBooks data.");
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function QuickBooksCFOBridge() {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const statusResponse = await fetch("/api/quickbooks/status", { cache: "no-store" });
        const status = await statusResponse.json();
        if (!statusResponse.ok || !status.connection) return;

        const syncResponse = await fetch("/api/quickbooks/sync", { cache: "no-store" });
        const payload = (await syncResponse.json()) as SyncPayload;
        if (!syncResponse.ok) throw new Error((payload as any).error || "QuickBooks sync failed.");

        if (cancelled) return;
        loadIntoBriefing(payload, status.connection.companyName || "QuickBooks Online company");
      } catch (bridgeError) {
        if (!cancelled) setError(bridgeError instanceof Error ? bridgeError.message : "QuickBooks data could not be loaded into the CFO Briefing.");
      }
    };

    const timer = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!error) return null;
  return <p className="mx-auto w-full max-w-7xl px-5 pt-3 text-xs text-red-600 sm:px-8 lg:px-10">{error}</p>;
}
