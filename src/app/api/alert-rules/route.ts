import { NextResponse } from "next/server";
import { getActiveCompany, requireCurrentCompanyUser } from "../../../lib/company";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 16 * 1024;
const METRICS = new Set(["cash", "grossMargin", "revenue", "operatingExpense", "inventory"]);
const OPERATORS = new Set(["below", "above"]);
const SEVERITIES = new Set(["high", "medium", "watch"]);

async function activeCompany() {
  const userId = await requireCurrentCompanyUser();
  const company = await getActiveCompany(userId);
  if (!company) throw new Error("No business is configured for this account.");
  return company;
}

export async function GET() {
  try {
    const company = await activeCompany();
    const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase server configuration is missing.");
    const response = await fetch(`${url}/rest/v1/alert_rules?company_id=eq.${encodeURIComponent(company.id)}&select=id,metric,operator,value,severity,enabled,created_at,updated_at&order=created_at.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error(`Could not read alert rules (${response.status}).`);
    return NextResponse.json({ rules: await response.json() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Could not load alert rules." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }
    const body = JSON.parse(raw);
    const metric = typeof body?.metric === "string" ? body.metric : "";
    const operator = typeof body?.operator === "string" ? body.operator : "";
    // Severity is no longer user-selectable (the user picking the alert already
    // knows its importance). Default custom rules to "medium"; the column is
    // kept because delivery dedupe/escalation still keys on it.
    const rawSeverity = typeof body?.severity === "string" ? body.severity : "medium";
    const severity = SEVERITIES.has(rawSeverity) ? rawSeverity : "medium";
    const value = Number(body?.value);
    if (!METRICS.has(metric) || !OPERATORS.has(operator)) {
      return NextResponse.json({ error: "Invalid alert rule." }, { status: 400 });
    }
    if (!Number.isFinite(value) || value < 0 || value > 1e9 || (metric === "grossMargin" && value > 100)) {
      return NextResponse.json({ error: "Alert threshold is out of range." }, { status: 400 });
    }
    const company = await activeCompany();
    const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase server configuration is missing.");
    const response = await fetch(`${url}/rest/v1/alert_rules`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ company_id: company.id, metric, operator, value, severity, enabled: true }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Could not create alert rule (${response.status}).`);
    const rows = await response.json();
    return NextResponse.json({ rule: rows[0] || null }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    const status = error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Could not create alert rule." }, { status });
  }
}
