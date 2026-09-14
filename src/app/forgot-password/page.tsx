"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "We could not process that request. Please try again.");
        return;
      }
      setMessage("If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.");
    } catch {
      setError("We could not reach ClearCFO. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 sm:py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center">
        <a href="/" aria-label="ClearCFO home" className="mb-8">
          <Image src="/logo.png" alt="ClearCFO" width={224} height={57} className="h-10 w-auto" priority />
        </a>
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">Account security</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Reset your password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Enter the email address you use for ClearCFO and we’ll send you a secure reset link.</p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span>
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="you@company.com" />
            </label>
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">{message}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Sending…" : "Send Reset Link"}</button>
          </form>

          <div className="mt-7 text-center text-sm text-slate-500">
            <a href="/login" className="font-semibold text-blue-600 hover:text-blue-700">Back to login</a>
          </div>
        </div>
      </div>
    </main>
  );
}
