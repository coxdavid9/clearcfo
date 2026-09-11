"use client";

import Image from "next/image";
import { type FormEvent, useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      if (mode === "signup" && data.requiresEmailConfirmation) {
        setMessage("Account created. Check your email to confirm your account, then come back here to sign in.");
        setMode("login");
        return;
      }

      window.location.href = "/customer";
    } catch {
      setError("We could not reach ClearCFO. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 sm:py-16">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <a href="/" aria-label="ClearCFO home" className="mb-8">
          <Image src="/logo.png" alt="ClearCFO" width={224} height={57} className="h-10 w-auto" priority />
        </a>

        <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">Customer Portal</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{mode === "login" ? "Log in to ClearCFO" : "Create your ClearCFO account"}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {mode === "login" ? "Access your financial intelligence workspace." : "Start with a secure ClearCFO customer account."}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="you@company.com"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="At least 8 characters"
              />
            </label>

            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>

          <div className="mt-7 text-center text-sm text-slate-500">
            {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setMessage("");
              }}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              {mode === "login" ? "Create one" : "Log in"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-slate-400">Your password is handled by ClearCFO's authentication provider and is never stored by the ClearCFO application itself.</p>
      </div>
    </main>
  );
}
