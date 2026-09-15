"use client";

import { useEffect, useState } from "react";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Confirming your email…");

  useEffect(() => {
    let cancelled = false;

    async function completeConfirmation() {
      const query = new URLSearchParams(window.location.search);
      const tokenHash = query.get("token_hash");
      const type = query.get("type") || "email";
      const hash = window.location.hash.replace(/^#/, "");
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const errorDescription = hashParams.get("error_description") || query.get("error_description");

      if (errorDescription) {
        if (!cancelled) setMessage("That confirmation link is no longer valid. Please request a new one.");
        return;
      }

      try {
        const response = await fetch("/api/auth/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: tokenHash
            ? JSON.stringify({ tokenHash, type })
            : JSON.stringify({ accessToken, refreshToken }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Confirmation failed.");
        }

        if (!cancelled) {
          window.location.replace("/customer");
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "We couldn't complete the confirmation.");
        }
      }
    }

    completeConfirmation();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">✓</div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to ClearCFO</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </div>
    </main>
  );
}
