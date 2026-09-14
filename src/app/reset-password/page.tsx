"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("access_token") || "";
    setAccessToken(token);
    setReady(true);
    if (!token) setError("This password reset link is missing or has expired. Please request a new one.");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!accessToken) return setError("This password reset link is missing or has expired. Please request a new one.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "We could not update your password. Please request a new reset link.");
        return;
      }
      setMessage("Your password has been updated. You can now log in with your new password.");
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      setError("We could not reach ClearCFO. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 sm:py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center">
        <a href="/" aria-label="ClearCFO home" className="mb-8"><Image src="/logo.png" alt="ClearCFO" width={224} height={57} className="h-10 w-auto" priority /></a>
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">Account security</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Choose a new password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Use a password of at least 8 characters. Your password is handled by the authentication provider.</p>

          {ready && accessToken && !message && (
            <form onSubmit={submit} className="mt-7 space-y-5">
              <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">New password</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Updating…" : "Update Password"}</button>
            </form>
          )}

          {message && <p className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">{message}</p>}
          {ready && !accessToken && <div className="mt-7"><a href="/forgot-password" className="font-semibold text-blue-600 hover:text-blue-700">Request a new reset link</a></div>}
          {message && <div className="mt-7"><a href="/login" className="font-semibold text-blue-600 hover:text-blue-700">Back to login</a></div>}
        </div>
      </div>
    </main>
  );
}
