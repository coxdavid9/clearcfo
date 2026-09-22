"use client";

import Link from "next/link";

export default function QuickBooksDisconnectedPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-16 text-slate-900">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
          ✓
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">
          QuickBooks disconnected
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Your QuickBooks connection has been disconnected.
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">
          ClearCFO will no longer use the disconnected QuickBooks connection.
          If you want to use ClearCFO again, sign in and reconnect QuickBooks
          from your customer dashboard.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Sign in to ClearCFO
        </Link>
      </div>
    </main>
  );
}
