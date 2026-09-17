"use client";

import { useEffect, useState } from "react";

type Membership = {
  company_id: string;
  role: string;
  company: { id: string; name: string };
};

export default function CompanySwitcher() {
  const [companies, setCompanies] = useState<Membership[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/companies", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!Array.isArray(data?.companies)) return;
        setCompanies(data.companies);
        if (data.companies[0]) setSelected(data.companies[0].company_id);
      })
      .catch(() => undefined);
  }, []);

  if (companies.length <= 1) return null;

  async function selectCompany(companyId: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/companies/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!response.ok) return;
      setSelected(companyId);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="hidden items-center gap-2 sm:flex">
      <span className="sr-only">Active business</span>
      <select
        value={selected}
        onChange={(event) => void selectCompany(event.target.value)}
        disabled={busy}
        className="max-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-600/10 disabled:opacity-60"
      >
        {companies.map((membership) => (
          <option key={membership.company_id} value={membership.company_id}>{membership.company.name}</option>
        ))}
      </select>
    </label>
  );
}
