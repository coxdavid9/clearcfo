"use client";

import { FormEvent, useState } from "react";

type Profile = {
  companyName: string;
  industry: string;
  companySize: string;
  contactName: string;
  contactPhone: string;
};

type Props = {
  email: string;
  initialProfile?: Partial<Profile>;
};

const emptyProfile: Profile = {
  companyName: "",
  industry: "",
  companySize: "",
  contactName: "",
  contactPhone: "",
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function CustomerProfile({ email, initialProfile }: Props) {
  const [profile, setProfile] = useState<Profile>({ ...emptyProfile, ...initialProfile });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const editableFields = [
    profile.companyName,
    profile.industry,
    profile.companySize,
    profile.contactName,
    profile.contactPhone,
  ];
  const isEmpty = editableFields.every((field) => !field);

  const items = [
    { label: "Company", value: profile.companyName },
    { label: "Industry", value: profile.industry },
    { label: "Company size", value: profile.companySize ? `${profile.companySize} employees` : "" },
    { label: "Primary contact", value: profile.contactName },
    { label: "Contact phone", value: profile.contactPhone },
    { label: "Account email", value: email },
  ];

  function update(field: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function beginEdit() {
    setMessage("");
    setError("");
    setEditing(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to save your profile.");
      }

      setEditing(false);
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-5h6v5M9 10h.01M12 10h.01M15 10h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Business information</h2>
            <p className="mt-0.5 text-sm text-slate-500">The business details ClearCFO uses to personalize your briefings.</p>
          </div>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={beginEdit}
            className="shrink-0 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:text-blue-700 sm:self-center"
          >
            {isEmpty ? "Add details" : "Edit profile"}
          </button>
        )}
      </div>

      {(message || error) && (
        <div className="border-b border-slate-200 px-5 py-4 sm:px-7">
          {message && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</p>
          )}
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
          )}
        </div>
      )}

      {editing ? (
        <form onSubmit={save} className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-7">
          <Field label="Company name" value={profile.companyName} placeholder="Optional" onChange={(value) => update("companyName", value)} />
          <Field label="Industry" value={profile.industry} placeholder="e.g. Professional services" onChange={(value) => update("industry", value)} />
          <label className="text-sm font-medium text-slate-700">
            Company size
            <select value={profile.companySize} onChange={(e) => update("companySize", e.target.value)} className={inputClass}>
              <option value="">Select size</option>
              <option value="1-10">1–10 employees</option>
              <option value="11-50">11–50 employees</option>
              <option value="51-200">51–200 employees</option>
              <option value="201-500">201–500 employees</option>
              <option value="501+">501+ employees</option>
            </select>
          </label>
          <Field label="Primary contact" value={profile.contactName} placeholder="Name" onChange={(value) => update("contactName", value)} />
          <Field label="Contact phone" value={profile.contactPhone} placeholder="Optional" onChange={(value) => update("contactPhone", value)} />
          <label className="text-sm font-medium text-slate-700">
            Account email
            <input value={email} disabled className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-500" />
          </label>
          <div className="flex items-center gap-3 border-t border-slate-100 pt-5 sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : "Save profile"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setMessage("");
                setError("");
              }}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : isEmpty ? (
        <div className="px-5 py-8 sm:px-7">
          <div className="rounded-2xl border-2 border-dashed border-slate-200 px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
                <path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-5h6v5M9 10h.01M12 10h.01M15 10h.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-4 font-semibold text-slate-900">Add your business details</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
              A few details about your company help ClearCFO tailor your briefings.
            </p>
            <button
              type="button"
              onClick={beginEdit}
              className="mt-5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Complete profile
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 py-5 sm:px-7">
          <dl className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.label} className="bg-white px-4 py-4">
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.label}</dt>
                <dd
                  title={item.value || undefined}
                  className={`mt-1.5 truncate text-sm font-semibold ${item.value ? "text-slate-800" : "text-slate-300"}`}
                >
                  {item.value || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </label>
  );
}
