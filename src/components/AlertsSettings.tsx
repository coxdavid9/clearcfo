"use client";

import { useEffect, useState } from "react";

type Rule = {
  id: string;
  metric: "cash" | "grossMargin" | "revenue" | "operatingExpense" | "inventory";
  operator: "below" | "above";
  value: number;
  enabled: boolean;
};

type Preferences = {
  alerts_enabled: boolean;
  weekly_report_enabled: boolean;
  weekly_report_day: number;
  report_recipient_email: string | null;
  auto_sync_enabled: boolean;
  alert_delivery_time: string;
  weekly_report_time: string;
  timezone: string;
};

const DEFAULTS: Preferences = {
  alerts_enabled: true,
  weekly_report_enabled: true,
  weekly_report_day: 1,
  report_recipient_email: null,
  auto_sync_enabled: true,
  alert_delivery_time: "07:00",
  weekly_report_time: "07:30",
  timezone: "America/Chicago",
};

const metrics = [
  ["cash", "Cash"],
  ["grossMargin", "Gross margin"],
  ["revenue", "Revenue"],
  ["operatingExpense", "Operating expenses"],
  ["inventory", "Inventory"],
] as const;

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timezones = [["America/Chicago", "Central Time"], ["America/New_York", "Eastern Time"], ["America/Denver", "Mountain Time"], ["America/Los_Angeles", "Pacific Time"], ["America/Anchorage", "Alaska Time"], ["Pacific/Honolulu", "Hawaii Time"], ["UTC", "UTC"]];
const metricDefaults: Record<string, string> = {
  cash: "10000",
  grossMargin: "25",
  revenue: "100000",
  operatingExpense: "25000",
  inventory: "10000",
};

// Tap-to-apply threshold presets per metric, rendered as chips under the
// threshold field. (A <datalist> was used first, but browsers filter its
// suggestions against the input's current value, so with the prefilled
// defaults cash only ever offered $10,000 and revenue only $100,000.
// Chips always show every option, and they work on mobile Safari where
// datalist support is unreliable.) The field stays a free-type input.
const dollarPresets: Record<string, number[]> = {
  cash: [1000, 5000, 10000, 25000, 50000],
  revenue: [10000, 50000, 100000, 250000, 500000],
  operatingExpense: [5000, 10000, 25000, 50000, 100000],
  inventory: [1000, 5000, 10000, 25000, 50000],
};
const percentPresets: number[] = [10, 15, 20, 25, 30];

export default function AlertsSettings() {
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [ruleForm, setRuleForm] = useState({ metric: "cash", operator: "below", value: "10000" });
  // While the threshold field is focused it shows raw digits for easy editing;
  // on blur, dollar thresholds render with comma grouping (10,000) so the
  // zeros are easy to count.
  const [thresholdFocused, setThresholdFocused] = useState(false);
  const formatThresholdDisplay = (raw: string) => {
    if (raw === "" || ruleForm.metric === "grossMargin") return raw;
    const num = Number(raw);
    return Number.isFinite(num) ? num.toLocaleString("en-US") : raw;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [prefsResponse, rulesResponse] = await Promise.all([
        fetch("/api/notification-preferences", { cache: "no-store" }),
        fetch("/api/alert-rules", { cache: "no-store" }),
      ]);
      const prefs = await prefsResponse.json();
      const ruleData = await rulesResponse.json();
      if (!prefsResponse.ok) throw new Error(prefs?.error || "Could not load settings.");
      if (!rulesResponse.ok) throw new Error(ruleData?.error || "Could not load alert rules.");
      setPreferences({ ...DEFAULTS, ...(prefs.preferences || {}) });
      setRules(ruleData.rules || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (patch: Partial<Preferences>) => {
    setSaving(true);
    setMessage("");
    const next = { ...preferences, ...patch };
    try {
      const response = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not save settings.");
      setPreferences({ ...DEFAULTS, ...(data.preferences || next) });
      setMessage("Saved.");
      window.setTimeout(() => setMessage(""), 1800);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const addRule = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric: ruleForm.metric,
          operator: ruleForm.operator,
          value: Number(ruleForm.value),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not add alert rule.");
      setRules((current) => [...current, data.rule]);
      setMessage("Alert rule added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add alert rule.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    setSaving(true);
    try {
      const response = await fetch("/api/alert-rules/" + id, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not delete alert rule.");
      setRules((current) => current.filter((rule) => rule.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete alert rule.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-500">Loading alert settings…</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Pro</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Alerts &amp; reports</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Choose what ClearCFO sends you and how often it keeps watch.</p>
        </div>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <h3 className="font-semibold text-slate-900">Email schedule</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Send alerts at
              <input type="time" value={preferences.alert_delivery_time} onChange={(e) => setPreferences((p) => ({ ...p, alert_delivery_time: e.target.value }))} onBlur={() => void save({ alert_delivery_time: preferences.alert_delivery_time })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-700" />
              <span className="mt-1 block text-xs font-normal text-slate-400">Alerts are delivered once per day, after this time.</span>
            </label>
            <div className="text-sm font-semibold text-slate-700">
              <span>Weekly CFO report</span>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <select value={preferences.weekly_report_day} onChange={(e) => void save({ weekly_report_day: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-700">
                  {days.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
                </select>
                <input type="time" value={preferences.weekly_report_time} onChange={(e) => setPreferences((p) => ({ ...p, weekly_report_time: e.target.value }))} onBlur={() => void save({ weekly_report_time: preferences.weekly_report_time })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-700" />
              </div>
            </div>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Timezone
              <select value={preferences.timezone} onChange={(e) => void save({ timezone: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-700">
                {timezones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-400">All times use this timezone; daylight saving is handled automatically.</span>
            </label>
          </div>
        </div>
        <div className="mt-6 divide-y divide-slate-100">
          {[
            ["alerts_enabled", "Proactive alerts", "Get warned when a material financial issue deserves attention."],
            ["weekly_report_enabled", "Weekly CFO report", "Receive the key numbers in your inbox each week."],
            ["auto_sync_enabled", "Automatic syncing", "Keep QuickBooks data current without a manual refresh."],
          ].map(([key, label, description]) => {
            const enabled = preferences[key as keyof Preferences] as boolean;
            return (
              <div key={key} className="flex items-center justify-between gap-5 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="mt-1 text-sm text-slate-500">{description}</p>
                </div>
                <button
                  type="button"
                  aria-pressed={enabled}
                  disabled={saving}
                  onClick={() => void save({ [key]: !enabled })}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-blue-600" : "bg-slate-300"} disabled:opacity-50`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Recipient email
            <input
              value={preferences.report_recipient_email || ""}
              onChange={(e) => setPreferences((p) => ({ ...p, report_recipient_email: e.target.value || null }))}
              onBlur={() => void save({ report_recipient_email: preferences.report_recipient_email })}
              placeholder="you@company.com"
              type="email"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-700"
            />
            <span className="mt-1 block text-xs font-normal text-slate-400">Leave blank to use the business owner's email.</span>
          </label>
        </div>
        {message && <p className="mt-4 text-sm font-medium text-blue-700">{message}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Custom alerts</h2>
        <p className="mt-1 text-sm text-slate-500">Set thresholds that matter specifically to your business.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[["Cash below $10,000", "cash", "below", "10000"], ["Gross margin below 25%", "grossMargin", "below", "25"], ["Revenue above $100,000", "revenue", "above", "100000"]].map(([label, metric, operator, value]) => (
            <button key={label} type="button" onClick={() => setRuleForm({ metric, operator, value })} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{label}</button>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_1.6fr_auto]">
          <select value={ruleForm.metric} onChange={(e) => setRuleForm((f) => ({ ...f, metric: e.target.value, value: metricDefaults[e.target.value] ?? "" }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            {metrics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={ruleForm.operator} onChange={(e) => setRuleForm((f) => ({ ...f, operator: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            <option value="below">Below</option><option value="above">Above</option>
          </select>
          <div>
            <div className="relative">
            <input type="text" inputMode="decimal" value={thresholdFocused ? ruleForm.value : formatThresholdDisplay(ruleForm.value)} onFocus={() => setThresholdFocused(true)} onBlur={() => setThresholdFocused(false)} onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9.]/g, "");
              const [head, ...rest] = cleaned.split(".");
              const normalized = rest.length > 0 ? `${head}.${rest.join("")}` : head;
              const capped = ruleForm.metric === "grossMargin" && normalized !== "" && Number(normalized) > 100 ? "100" : normalized;
              setRuleForm((f) => ({ ...f, value: capped }));
            }} className={`w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm ${ruleForm.metric === "grossMargin" ? "pr-8" : "pl-7"}`} placeholder={ruleForm.metric === "grossMargin" ? "e.g. 25" : "Threshold"} />
            <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 ${ruleForm.metric === "grossMargin" ? "right-3" : "left-3"}`}>{ruleForm.metric === "grossMargin" ? "%" : "$"}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {(ruleForm.metric === "grossMargin" ? percentPresets : dollarPresets[ruleForm.metric] ?? []).map((amount) => (
                <button key={amount} type="button" onClick={() => setRuleForm((f) => ({ ...f, value: String(amount) }))} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                  {ruleForm.metric === "grossMargin" ? amount + "%" : "$" + amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <button type="button" disabled={saving} onClick={() => void addRule()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Add alert</button>
        </div>

        <div className="mt-6 space-y-3">
          {rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">No custom alerts yet. Start with one of the examples above.</div>
          ) : rules.map((rule) => (
            <div key={rule.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{metrics.find(([value]) => value === rule.metric)?.[1]} {rule.operator} {rule.metric === "grossMargin" ? rule.value + "%" : "$" + Number(rule.value).toLocaleString()}</p>
              </div>
              <button type="button" disabled={saving} onClick={() => void deleteRule(rule.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50">Delete</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
