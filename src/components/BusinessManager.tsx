"use client";

import { useEffect, useState, type FormEvent } from "react";

type Membership = {
  company_id: string;
  role: string;
  company: { id: string; name: string; industry: string | null };
};

export default function BusinessManager() {
  const [companies, setCompanies] = useState<Membership[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/companies", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Unable to load businesses.");
        if (cancelled) return;
        setCompanies(Array.isArray(data?.companies) ? data.companies : []);
        setActiveCompanyId(typeof data?.activeCompanyId === "string" ? data.activeCompanyId : null);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load businesses.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Unable to switch businesses.");
    } finally {
      setSwitchingId(null);
    }
  }

  function startRename(membership: Membership) {
    setRenamingId(membership.company_id);
    setRenameName(membership.company.name);
    setRenameError("");
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameName("");
    setRenameError("");
  }

  async function saveRename(event: FormEvent, companyId: string) {
    event.preventDefault();
    const trimmedName = renameName.trim();
    if (!trimmedName) {
      setRenameError("Business name is required.");
      return;
    }
    setRenameBusy(true);
    setRenameError("");
    try {
      const response = await fetch("/api/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, name: trimmedName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to rename business.");
      // Reload so the new name appears everywhere (list, navbar switcher).
      window.location.reload();
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "Unable to rename business.");
    } finally {
      setRenameBusy(false);
    }
  }
\n  function startDelete(companyId: string) {
    setConfirmingDeleteId(companyId);
    setDeleteError("");
  }

  function cancelDelete() {
    setConfirmingDeleteId(null);
    setDeleteError("");
  }

  async function confirmDelete(companyId: string) {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/companies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to delete business.");
      window.location.reload();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete business.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function addBusiness(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setCreateError("Business name is required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, industry: industry.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to add business.");
      // The new business becomes the active one; reload so the whole page
      // (briefing, connection status, caches) picks it up.
      window.location.reload();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Unable to add business.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">Businesses</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        Each business keeps its own QuickBooks connection and CFO briefing. Switch between them anytime.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading businesses…</p>
      ) : loadError ? (
        <p className="mt-4 text-sm font-medium text-red-600">{loadError}</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {companies.map((membership) => {
            const isActive = membership.company_id === activeCompanyId;
            const switching = switchingId === membership.company_id;
            const renaming = renamingId === membership.company_id;
            const confirmingDelete = confirmingDeleteId === membership.company_id;
            const canDelete = companies.length > 1;
            return (
              <li key={membership.company_id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {confirmingDelete ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Delete {membership.company.name}?</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">
                        Its QuickBooks connection, briefings, alerts, and settings go with it. This can&apos;t be undone.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void confirmDelete(membership.company_id)}
                          disabled={deleteBusy}
                          className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                        >
                          {deleteBusy ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelDelete}
                          disabled={deleteBusy}
                          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : renaming ? (
                    <form onSubmit={(event) => void saveRename(event, membership.company_id)} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameName}
                        onChange={(event) => setRenameName(event.target.value)}
                        maxLength={200}
                        autoFocus
                        aria-label="Business name"
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-600/10"
                      />
                      <button
                        type="submit"
                        disabled={renameBusy}
                        className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        {renameBusy ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        disabled={renameBusy}
                        className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-400 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <p className="truncate text-sm font-semibold text-slate-900">{membership.company.name}</p>
                      <p className="mt-0.5 text-xs capitalize text-slate-500">{membership.role}</p>
                    </>
                  )}
                </div>
                {!renaming && !confirmingDelete && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startRename(membership)}
                      className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:text-blue-700"
                    >
                      Rename
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => startDelete(membership.company_id)}
                        className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                    {isActive ? (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Active</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void switchCompany(membership.company_id)}
                        disabled={switching}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:text-blue-700 disabled:opacity-60"
                      >
                        {switching ? "Switching…" : "Switch"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {switchError ? <p className="mt-3 text-sm font-medium text-red-600">{switchError}</p> : null}
      {renameError ? <p className="mt-3 text-sm font-medium text-red-600">{renameError}</p> : null}
      {deleteError ? <p className="mt-3 text-sm font-medium text-red-600">{deleteError}</p> : null}

      <form onSubmit={(event) => void addBusiness(event)} className="mt-5 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">Add another business</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Business name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              placeholder="Acme LLC"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-600/10"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              Industry <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              type="text"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              maxLength={200}
              placeholder="e.g. Retail"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-600/10"
            />
          </label>
        </div>
        {createError ? <p className="mt-3 text-sm font-medium text-red-600">{createError}</p> : null}
        <button
          type="submit"
          disabled={creating}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          {creating ? "Adding…" : "Add business"}
        </button>
      </form>
    </section>
  );
}
