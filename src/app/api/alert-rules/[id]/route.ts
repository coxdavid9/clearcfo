import { NextResponse } from "next/server";
import { getActiveCompany, requireCurrentCompanyUser } from "../../../../lib/company";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireCurrentCompanyUser();
    const company = await getActiveCompany(userId);
    if (!company) return NextResponse.json({ error: "No business is configured for this account." }, { status: 400 });
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid rule id." }, { status: 400 });
    const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase server configuration is missing.");
    const response = await fetch(`${url}/rest/v1/alert_rules?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(company.id)}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Could not delete alert rule (${response.status}).`);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Could not delete alert rule." }, { status });
  }
}
