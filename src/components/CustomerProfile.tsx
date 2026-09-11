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

export default function CustomerProfile({ email, initialProfile }: Props) {
  const [profile, setProfile] = useState<Profile>({ ...emptyProfile, ...initialProfile });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">Customer information</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Your business profile</h2>
          <p className="mt-1 text-sm text-slate-500">Keep your company details current so ClearCFO can tailor your experience.</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => { setMessage(""); setEditing(true); }}
            className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
          >
            Edit profile
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={save} className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <label className="text-sm font-medium text-slate-700">
            Company name
            <input value={profile.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder="Your company" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Industry
            <input value={profile.industry} onChange={(e) => update("industry", e.target.value)} placeholder="e.g. Professional services" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Company size
            <select value={profile.companySize} onChange={(e) => update("companySize", e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-500">
              <option value="">Select size</option>
              <option value="1-10">1–10 employees</option>
              <option value="11-50">11–50 employees</option>
              <option value="51-200">51–200 employees</option>
              <option value="201-500">201–500 employees</option>
              <option value="501+">501+ employees</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Primary contact
            <input value={profile.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Name" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Contact phone
            <input value={profile.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} placeholder="Optional" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Account email
            <input value={email} disabled className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal text-slate-500" />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : "Save profile"}
            </button>
            <button type="button" onClick={() => { setEditing(false); setMessage(""); }} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            {message && <span className="text-sm text-slate-500">{message}</span>}
          </div>
        </form>
      ) : (
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3 sm:px-6">
          <ProfileItem label="Company" value={profile.companyName || "Add company name"} empty={!profile.companyName} />
          <ProfileItem label="Industry" value={profile.industry || "Add industry"} empty={!profile.industry} />
          <ProfileItem label="Company size" value={profile.companySize ? `${profile.companySize} employees` : "Add company size"} empty={!profile.companySize} />
          <ProfileItem label="Primary contact" value={profile.contactName || "Add contact name"} empty={!profile.contactName} />
          <ProfileItem label="Contact phone" value={profile.contactPhone || "Optional"} empty={!profile.contactPhone} />
          <ProfileItem label="Account email" value={email} />
        </div>
      )}
    </section>
  );
}

function ProfileItem({ label, value, empty = false }: { label: string; value: string; empty?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-medium ${empty ? "text-slate-400" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
