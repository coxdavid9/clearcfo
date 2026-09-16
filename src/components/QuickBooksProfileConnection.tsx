"use client";

import { useEffect, useState } from "react";

type Connection = {
  connected: boolean;
  companyName: string | null;
  connectedAt: string;
};

export default function QuickBooksProfileConnection() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStatus() {
    try {
      const response = await fetch("/api/quickbooks/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to check QuickBooks connection.");
      setConnection(data.connection);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to check QuickBooks connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function disconnect() {
    setDisconnecting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/quickbooks/disconnect", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to disconnect QuickBooks.");
      setConnection(null);
      window.localStorage.removeItem("clearcfo_qb_initial_sync");
      window.localStorage.removeItem("clearcfo_qb_last_synced_at");
      window.dispatchEvent(new Event("clearcfo:quickbooks-disconnected"));
      setMessage("QuickBooks disconnected.");
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Unable to disconnect QuickBooks.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">QuickBooks</p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">Connected financial source</h2>
          {loading ? (
            <p className="mt-1 text-sm text-slate-500">Checking connection…</p>
          ) : connection?.connected ? (
            <p className="mt-1 text-sm text-slate-600">
              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Connected to {connection.companyName || "QuickBooks Online"}.
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">No QuickBooks company is currently connected.</p>
          )}
        </div>

        {!loading &&
          (connection?.connected ? (
            <button
              type="button"
              onClick={disconnect}
              disabled={disconnecting}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect QuickBooks"}
            </button>
          ) : (
            <a
              href="/api/quickbooks/connect"
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Connect QuickBooks
            </a>
          ))}
      </div>

      {message && <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">{message}</p>}
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p>}
    </section>
  );
}
