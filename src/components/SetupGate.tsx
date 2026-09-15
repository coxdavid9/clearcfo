"use client";

import { useEffect, useState } from "react";
import QuickBooksConnection from "./QuickBooksConnection";

const SETUP_STATE_KEY = "clearcfo_setup_state";
type SetupState = "complete" | "minimized" | null;

export default function SetupGate() {
  const [state, setState] = useState<SetupState>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SETUP_STATE_KEY);
    if (saved === "complete" || saved === "minimized") {
      setState(saved);
    }
    setReady(true);

    const handleSync = () => {
      window.localStorage.setItem(SETUP_STATE_KEY, "complete");
      setState("complete");
    };

    const handleDisconnect = () => {
      window.localStorage.removeItem(SETUP_STATE_KEY);
      setState(null);
    };

    window.addEventListener("clearcfo:quickbooks-sync", handleSync);
    window.addEventListener("clearcfo:quickbooks-disconnected", handleDisconnect);

    return () => {
      window.removeEventListener("clearcfo:quickbooks-sync", handleSync);
      window.removeEventListener("clearcfo:quickbooks-disconnected", handleDisconnect);
    };
  }, []);

  if (!ready || state === "complete") return null;

  if (state === "minimized") {
    return (
      <section className="mx-auto w-full max-w-7xl px-5 pt-4 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-800">ClearCFO setup</p>
            <p className="text-xs text-slate-500">Your setup is not finished yet.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem(SETUP_STATE_KEY);
              setState(null);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
          >
            Show setup
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="relative">
      <div className="absolute right-5 top-8 z-10 sm:right-8 lg:right-10">
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(SETUP_STATE_KEY, "minimized");
            setState("minimized");
          }}
          className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur transition hover:text-slate-800"
        >
          Minimize
        </button>
      </div>
      <QuickBooksConnection />
    </div>
  );
}
