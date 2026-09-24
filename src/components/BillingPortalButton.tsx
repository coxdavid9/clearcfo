"use client";

export default function BillingPortalButton() {
  async function openPortal() {
    const r = await fetch("/api/billing/portal", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (d?.url) window.location.href = d.url;
    else alert("Couldn't open the billing portal. Please try again.");
  }

  return (
    <button
      type="button"
      onClick={openPortal}
      className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
    >
      Manage billing
    </button>
  );
}
