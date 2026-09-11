"use client";

import { FormEvent, useMemo, useState } from "react";

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

export default function CustomerProfile({ email, initialProfile }: Props) {
  const [profile, setProfile] = useState<Profile>({ ...emptyProfile, ...initialProfile });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const completion = useMemo(() => {
    const fields = [profile.companyName, profile.industry, profile.companySize, profile.contactName, profile.contactPhone];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [profile]);

  function update(field: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

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
      setMessage("Profile saved successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                <path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-5h6v5M9 10h.01M12 10h.01M15 10h.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Account &amp; business profile</p>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Customer portal</span>
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Business information</h2>
              <p className="mt-1 text-sm text-slate-500">Your account and company details used to personalize ClearCFO.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:min-w-[245px]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Profile completion</span>
                <span className="text-slate-700">{completion}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${completion}%` }} />
              </div>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => { setMessage(""); setEditing(true); }}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-400 hover:text-blue-700"
              >
                Edit profile
              </button>
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <form onSubmit={save} className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-7">
          <Field label="Company name" value={profile.companyName} placeholder="Your company" onChange={(value) => update("companyName", value)} />
          <Field label="Industry" value={profile.industry} placeholder="e.g. Professional services" onChange={(value) => update("industry", value)} />
          <label className="text-sm font-medium text-slate-700">
            Company size
            <select value={profile.companySize} onChange={(e) => update("companySize", e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
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
            <button type="button" onClick={() => { setEditing(false); setMessage(""); }} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            {message && <span className="text-sm text-slate-500">{message}</span>}
          </div>
        </form>
      ) : (
        <div className="px-5 py-5 sm:px-7">
          <div className="grid overflow-hidden rounded-xl border border-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileItem label="Company" value={profile.companyName || "Not provided"} empty={!profile.companyName} />
            <ProfileItem label="Industry" value={profile.industry || "Not provided"} empty={!profile.industry} />
            <ProfileItem label="Company size" value={profile.companySize ? `${profile.companySize} employees` : "Not provided"} empty={!profile.companySize} />
            <ProfileItem label="Primary contact" value={profile.contactName || "Not provided"} empty={!profile.contactName} />
            <ProfileItem label="Contact phone" value={profile.contactPhone || "Not provided"} empty={!profile.contactPhone} />
            <ProfileItem label="Account email" value={email} />
          </div>
          {message && <p className="mt-3 text-right text-xs font-medium text-emerald-600">{message}</p>}
        </div>
      )}
    </section>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}

function ProfileItem({ label, value, empty = false }: { label: string; value: string; empty?: boolean }) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-4 last:border-b-0 sm:nth-[n+3]:border-b-0 lg:border-b-0 lg:nth-[n+4]:border-t lg:nth-[n+4]:border-slate-200 lg:nth-[n+4]:border-l">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-1.5 truncate text-sm font-semibold ${empty ? "text-slate-400" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
