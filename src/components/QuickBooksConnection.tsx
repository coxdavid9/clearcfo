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
    if (result === "connected") setMessage(queryMessage || "QuickBooks connected successfully.");
    if (result === "cancelled") setMessage(queryMessage || "QuickBooks connection was cancelled.");
    if (result === "error") setError(queryMessage || "QuickBooks connection failed.");
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

  return (
    <section className="mx-auto w-full max-w-7xl px-5 pt-6 sm:px-8 lg:px-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Financial data connection</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Connect QuickBooks Online</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Securely connect your books so ClearCFO can replace demo data with live financial history and build your recurring CFO briefing.
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
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-emerald-900">Connected</span>
            <span className="text-emerald-800">{connection.companyName || "QuickBooks Online company"}</span>
          </div>
        )}

        {message && <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</p>}
        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </div>
    </section>
  );
}
