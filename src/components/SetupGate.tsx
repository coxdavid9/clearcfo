"use client";

import { useEffect, useState } from "react";
import QuickBooksConnection from "./QuickBooksConnection";

const SETUP_STATE_KEY = "clearcfo_setup_state";

type SetupState = "complete" | null;

export default function SetupGate() {
  const [state, setState] = useState<SetupState>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SETUP_STATE_KEY);
    if (saved === "complete") setState("complete");
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

  if (!ready) return null;

  return <QuickBooksConnection setupComplete={state === "complete"} />;
}
