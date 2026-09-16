"use client";

import { useEffect, useMemo, useState } from "react";

const DIAGNOSTICS_KEY = "clearcfo_qb_diagnostics";

function money(value: string) {
  const number = Number(String(value ?? "").replace(/[$,%(),]/g, (match) => match === "(" ? "-" : ""));
  if (!Number.isFinite(number)) return value || "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(number);
}

function compactRows(report: any) {
  const rows = Array.isArray(report?.rows) ? report.rows : [];
  return rows.filter((row: any) => row?.label).map((row: any) => ({
    label: String(row.label),
    group: String(row.group || "—"),
    type: String(row.type || "—"),
    values: Array.isArray(row.values) ? row.values.map((value: any) => String(value ?? "")) : [],
  }));
}

export default function QuickBooksDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      try {
        const cached = window.localStorage.getItem(DIAGNOSTICS_KEY);
        setDiagnostics(cached ? JSON.parse(cached) : null);
      } catch {
        setDiagnostics(null);
      }
    };
    load();
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail) setDiagnostics(detail);
      else load();
    };
    window.addEventListener("clearcfo:quickbooks-diagnostics", handleUpdate);
    return () => window.removeEventListener("clearcfo:quickbooks-diagnostics", handleUpdate);
  }, []);

  const pnl = diagnostics?.profitAndLoss;
  const balance = diagnostics?.balanceSheet;
  const pnlRows = useMemo(() => compactRows(pnl), [pnl]);
  const balanceRows = useMemo(() => compactRows(balance), [balance]);

  if (!diagnostics) return null;

  const renderReport = (title: string, report: any, rows: any[]) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-400">{rows.length} parsed rows</span>
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Row</th>
              <th className="px-3 py-2 font-semibold">Group</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              {(report?.columns || []).slice(1).map((column: string, index: number) => <th key={`${column}-${index}`} className="px-3 py-2 text-right font-semibold whitespace-nowrap">{column || `Period ${index + 1}`}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => <tr key={`${row.label}-${rowIndex}`} className="hover:bg-slate-50">
              <td className="max-w-64 px-3 py-2 font-medium text-slate-700">{row.label}</td>
              <td className="px-3 py-2 text-slate-400">{row.group}</td>
              <td className="px-3 py-2 text-slate-400">{row.type}</td>
              {(report?.columns || []).slice(1).map((_: string, index: number) => <td key={index} className="px-3 py-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{money(row.values[index] ?? "")}</td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-5 pb-8 sm:px-8">
      <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Developer diagnostic</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">QuickBooks data received by ClearCFO</h2>
            <p className="mt-1 text-sm text-slate-600">Temporary diagnostic view. It shows the report structure and aggregate values returned by QuickBooks so we can find where the numbers change.</p>
          </div>
          <button type="button" onClick={() => setOpen((value) => !value)} className="w-fit rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-amber-100">{open ? "Hide diagnostics" : "Show diagnostics"}</button>
        </div>

        {open && <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-4"><p className="text-xs font-semibold text-slate-400">Company</p><p className="mt-1 font-semibold text-slate-900">{diagnostics.company || "—"}</p></div>
            <div className="rounded-2xl bg-white p-4"><p className="text-xs font-semibold text-slate-400">Environment</p><p className="mt-1 font-semibold text-slate-900">{diagnostics.environment || "—"}</p></div>
            <div className="rounded-2xl bg-white p-4"><p className="text-xs font-semibold text-slate-400">Requested range</p><p className="mt-1 font-semibold text-slate-900">{diagnostics.requestedRange?.start_date || "—"} → {diagnostics.requestedRange?.end_date || "—"}</p></div>
            <div className="rounded-2xl bg-white p-4"><p className="text-xs font-semibold text-slate-400">Last diagnostic</p><p className="mt-1 font-semibold text-slate-900">{diagnostics.generatedAt ? new Date(diagnostics.generatedAt).toLocaleString() : "—"}</p></div>
          </div>

          {renderReport("Profit & Loss — raw report structure", pnl, pnlRows)}
          {renderReport("Balance Sheet — raw report structure", balance, balanceRows)}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">What this tells us</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>These are the aggregate values ClearCFO received from QuickBooks, not values invented by the dashboard.</li>
              <li>The column headers let us verify whether periods are actually aligned.</li>
              <li>Group and type values let us see whether ClearCFO is selecting the intended Income, COGS, Expense, Cash, and Inventory rows.</li>
              <li>If QuickBooks shows historical values here but the KPI still shows 0%, the bug is downstream in ClearCFO's parser or comparison logic.</li>
            </ul>
          </div>
        </div>}
      </div>
    </section>
  );
}
