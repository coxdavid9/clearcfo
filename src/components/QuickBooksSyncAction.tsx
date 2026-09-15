"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function QuickBooksSyncAction() {
  const [connected, setConnected] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const findTarget = () => {
      const nextTarget = document.getElementById("quickbooks-sync-target");
      if (active) setTarget(nextTarget);
    };

    const checkConnection = async () => {
      try {
        const response = await fetch("/api/quickbooks/status", { cache: "no-store" });
        const payload = await response.json();
        if (active) setConnected(response.ok && payload?.connection?.connected === true);
      } catch {
        if (active) setConnected(false);
      }
    };

    findTarget();
    void checkConnection();

    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(findTarget, 500);

    const handleDisconnect = () => {
      setConnected(false);
      setError("");
    };
    window.addEventListener("clearcfo:quickbooks-disconnected", handleDisconnect);

    return () => {
      active = false;
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("clearcfo:quickbooks-disconnected", handleDisconnect);
    };
  }, []);

  async function syncNow() {
    setSyncing(true);
    setError("");
    try {
      const response = await fetch("/api/quickbooks/sync", {
        cache: "no-store",
        headers: { "x-clearcfo-manual-sync": "true" },
      });
      const payload = await response.json();
      if (!response.ok || !payload?.briefing) {
        throw new Error(payload?.error || "QuickBooks sync failed.");
      }
      if (payload.syncedAt) window.localStorage.setItem("clearcfo_qb_last_synced_at", payload.syncedAt);
      window.localStorage.setItem("clearcfo_qb_initial_sync", "complete");
      window.dispatchEvent(new CustomEvent("clearcfo:quickbooks-sync", { detail: payload }));
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "QuickBooks sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  if (!connected || !target) return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={syncNow}
        disabled={syncing}
        title={error || "Refresh your connected QuickBooks data"}
        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-sm disabled:cursor-wait disabled:opacity-60"
      >
        {syncing ? "Syncing…" : "Sync now"}
      </button>
      {error && <span className="basis-full text-xs font-medium text-red-600">{error}</span>}
    </>,
    target
  );
}
