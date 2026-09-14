"use client";

import { useEffect, useState } from "react";

type Connection = {
  connected: boolean;
  companyName: string | null;
  realmId: string;
  connectedAt: string;
};

export default function QuickBooksConnection() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStatus() {
    try {
      const response = await fetch("/api/quickbooks/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to check connection.");
      setConnection(data.connection);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to check QuickBooks connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("quickbooks");
    const queryMessage = params.get("message");
    if (result === "connected") setMessage(queryMessage || "QuickBooks connected successfully. Your CFO Briefing is ready for live data.");
    if (result === "cancelled") setMessage(queryMessage || "QuickBooks connection was cancelled. No financial data was imported.");
    if (result === "error") setError(queryMessage || "QuickBooks connection failed. Please try again.");
    if (result) window.history.replaceState({}, "", "/customer");
  }, []);

  async function testSync() {
    setSyncing(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/quickbooks/sync", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "QuickBooks sync failed.");
      const revenue = data.metrics?.Income?.at(-1);
      const netIncome = data.metrics?.["Net Income"]?.at(-1);
      setMessage(`Connection test passed. Latest period revenue: ${typeof revenue === "number" ? revenue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "available"}. Net income: ${typeof netIncome === "number" ? netIncome.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "available"}.`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "QuickBooks sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/quickbooks/disconnect", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to disconnect QuickBooks.");
      setConnection(null);
      setMessage("QuickBooks disconnected. Your stored connection credentials were removed from ClearCFO.");
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Unable to disconnect QuickBooks.");
    } finally {
      setDisconnecting(false);
    }
  }

  const setupStep = loading ? 2 : connection ? 3 : 2;

  return (
    <section className="mx-auto w-full max-w-7xl px-5 pt-6 sm:px-8 lg:px-10">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Welcome to ClearCFO</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Let’s get your CFO Briefing ready.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Connect your QuickBooks Online account and ClearCFO will use your financial history to identify what is driving performance, where money is being lost, and what deserves your attention.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm shadow-sm">
              <p className="font-semibold text-slate-800">Setup progress</p>
              <p className="mt-1 text-slate-500">Step {setupStep} of 3</p>
            </div>
          </div>

          <ol className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="ClearCFO setup progress">
            {[
              [1, "Create account", "Your ClearCFO workspace is ready."],
              [2, "Connect QuickBooks", connection ? "Your books are connected." : "Securely connect your books."],
              [3, "Review your briefing", connection ? "Your live financial analysis is next." : "Your briefing unlocks after connection."],
            ].map(([step, title, detail]) => {
              const number = Number(step);
              const complete = number < setupStep || (number === 2 && !!connection);
              const current = number === setupStep;
              return (
                <li key={number} className={`rounded-2xl border px-4 py-3 ${complete ? "border-emerald-200 bg-emerald-50/70" : current ? "border-blue-200 bg-blue-50/80" : "border-slate-200 bg-white/70"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${complete ? "bg-emerald-600 text-white" : current ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                      {complete ? "✓" : number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Financial data connection</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">QuickBooks Online</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                ClearCFO uses the QuickBooks accounting access needed to read your financial reports and build your analysis. It does not need to make changes to your books.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              {loading ? (
                <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500">Checking connection…</div>
              ) : connection ? (
                <>
                  <button onClick={testSync} disabled={syncing} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
                    {syncing ? "Testing sync…" : "Test sync"}
                  </button>
                  <button onClick={disconnect} disabled={disconnecting} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                    {disconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                </>
              ) : (
                <a href="/api/quickbooks/connect" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
                  Connect QuickBooks
                </a>
              )}
            </div>
          </div>

          {connection && (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <div>
                    <span className="font-semibold text-emerald-900">Connected</span>
                    <span className="ml-2 text-emerald-800">{connection.companyName || "QuickBooks Online company"}</span>
                  </div>
                </div>
                <span className="text-xs text-emerald-700">
                  Connected {new Date(connection.connectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-800">
                <span className="font-semibold">Next:</span>
                <span>Review your CFO Briefing below.</span>
              </div>
            </div>
          )}

          {!connection && !loading && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">1. Connect</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Sign in to QuickBooks and choose the company you want ClearCFO to analyze.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">2. Sync</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">ClearCFO retrieves the accounting reports it needs for your financial analysis.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">3. Understand</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Your CFO Briefing turns the numbers into the few things that deserve your attention.</p>
              </div>
            </div>
          )}

          {message && <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">{message}</p>}
          {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
