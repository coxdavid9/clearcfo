"use client";

import { useState } from "react";

export default function StripeCheckoutButton({ tier, popular = false }: { tier: "core" | "pro"; popular?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = `/login?checkout=${tier}`;
        return;
      }

      if (!response.ok || typeof data.url !== "string") {
        throw new Error(data.error || "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start checkout.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={startCheckout}
        disabled={busy}
        className={`w-full rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 disabled:cursor-wait disabled:opacity-60 ${popular ? "bg-blue-600 text-white hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md" : "border border-slate-300 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm"}`}
      >
        {busy ? "Opening secure checkout…" : "Get Started"}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
