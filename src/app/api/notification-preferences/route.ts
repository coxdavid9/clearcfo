import { NextResponse } from "next/server";
import { getActiveCompany, requireCurrentCompanyUser } from "../../../lib/company";
import { isValidScheduleTime, isValidTimezone } from "../../../lib/jobs/schedule-validation";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 16 * 1024;
const EMAIL_RE = /^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/;

const DEFAULTS = {
  alerts_enabled: true,
  weekly_report_enabled: true,
  weekly_report_day: 1,
  report_recipient_email: null as string | null,
  auto_sync_enabled: true,
  alert_delivery_time: "07:00",
  weekly_report_time: "07:30",
  timezone: "America/Chicago",
  last_alert_delivery_at: null as string | null,
  last_weekly_delivery_at: null as string | null,
};

async function activeCompany() {
  const userId = await requireCurrentCompanyUser();
  const company = await getActiveCompany(userId);
  if (!company) throw new Error("No business is configured for this account.");
  return company;
}
function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return { url, key };
}

export async function GET() {
  try {
    const company = await activeCompany();
    const { url, key } = config();
    const response = await fetch(`${url}/rest/v1/notification_preferences?company_id=eq.${encodeURIComponent(company.id)}&select=alerts_enabled,weekly_report_enabled,weekly_report_day,report_recipient_email,auto_sync_enabled,alert_delivery_time,weekly_report_time,timezone,last_alert_delivery_at,last_weekly_delivery_at&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error(`Could not read notification preferences (${response.status}).`);
    const rows = await response.json();
    return NextResponse.json({ preferences: { ...DEFAULTS, ...(rows[0] || {}) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Could not load notification preferences." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_REQUEST_BYTES) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = JSON.parse(raw);
    const updates: Record<string, unknown> = {};
    for (const key of ["alerts_enabled", "weekly_report_enabled", "auto_sync_enabled"]) {
      if (body?.[key] !== undefined) {
        if (typeof body[key] !== "boolean") return NextResponse.json({ error: `${key} must be a boolean.` }, { status: 400 });
        updates[key] = body[key];
      }
    }
    if (body?.weekly_report_day !== undefined) {
      const day = Number(body.weekly_report_day);
      if (!Number.isInteger(day) || day < 1 || day > 7) return NextResponse.json({ error: "weekly_report_day must be 1–7." }, { status: 400 });
      updates.weekly_report_day = day;
    }
    if (body?.alert_delivery_time !== undefined) {
      if (!isValidScheduleTime(body.alert_delivery_time)) return NextResponse.json({ error: "alert_delivery_time must use HH:MM in 24-hour time." }, { status: 400 });
      updates.alert_delivery_time = body.alert_delivery_time;
    }
    if (body?.weekly_report_time !== undefined) {
      if (!isValidScheduleTime(body.weekly_report_time)) return NextResponse.json({ error: "weekly_report_time must use HH:MM in 24-hour time." }, { status: 400 });
      updates.weekly_report_time = body.weekly_report_time;
    }
    if (body?.timezone !== undefined) {
      if (!isValidTimezone(body.timezone)) return NextResponse.json({ error: "timezone must be a valid IANA timezone." }, { status: 400 });
      updates.timezone = body.timezone;
    }
    if (body?.report_recipient_email !== undefined) {
      if (body.report_recipient_email !== null && (typeof body.report_recipient_email !== "string" || body.report_recipient_email.length > 254 || !EMAIL_RE.test(body.report_recipient_email))) {
        return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
      }
      updates.report_recipient_email = typeof body.report_recipient_email === "string" ? body.report_recipient_email.trim() : null;
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    const company = await activeCompany();
    const { url, key } = config();
    const response = await fetch(`${url}/rest/v1/notification_preferences?on_conflict=company_id`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ company_id: company.id, ...updates }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Could not update notification preferences (${response.status}).`);
    const rows = await response.json();
    return NextResponse.json({ preferences: { ...DEFAULTS, ...(rows[0] || {}) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    const status = error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Could not update notification preferences." }, { status });
  }
}
