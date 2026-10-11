"use client";

export default function BillingPortalButton() {
  async function openPortal() {
    try {
    const r = await fetch("/api/billing/portal", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (d?.url) window.location.href = d.url;
    else if (d?.code === "BILLING_NOT_CONNECTED") window.location.href = "/#pricing";
    else alert(d?.error || "Couldn't open the billing portal. Please try again.");
    } catch {
      alert("We could not reach ClearCFO. Please try again.");
    }
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
