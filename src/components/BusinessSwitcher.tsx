"use client";

import { useEffect, useState } from "react";

type Membership = {
  company_id: string;
  role: string;
  company: { id: string; name: string; industry: string | null };
};

export default function BusinessSwitcher() {
  const [companies, setCompanies] = useState<Membership[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/companies", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Unable to load businesses.");
        if (cancelled) return;
        setCompanies(Array.isArray(data?.companies) ? data.companies : []);
        setActiveCompanyId(
          typeof data?.activeCompanyId === "string" ? data.activeCompanyId : null,
        );
      })
      .catch(() => {
        if (!cancelled) setCompanies([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function switchCompany(companyId: string) {
    setSwitchingId(companyId);
    setSwitchError("");
    try {
      const response = await fetch("/api/companies/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to switch businesses.");
      window.location.reload();
    } catch {
      setSwitchError("Unable to switch businesses.");
      setSwitchingId(null);
    }
  }

  if (companies.length <= 1) return null;

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-1">
      <select
        value={activeCompanyId || ""}
        onChange={(event) => void switchCompany(event.target.value)}
        disabled={switchingId !== null}
        aria-label="Select business"
        className="max-w-[12rem] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-600/10 disabled:opacity-60"
      >
        {companies.map((membership) => (
          <option key={membership.company_id} value={membership.company_id}>
            {membership.company.name}
          </option>
        ))}
      </select>
      {switchError ? (
        <p className="text-[11px] font-medium text-red-600">{switchError}</p>
      ) : switchingId ? (
        <p className="text-[11px] font-medium text-slate-500">Switching…</p>
      ) : null}
    </div>
  );
}
