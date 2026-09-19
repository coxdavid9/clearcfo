import { NextResponse } from "next/server";
import { getActiveCompany, requireCurrentCompanyUser } from "../../../../lib/company";

export const runtime = "nodejs";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return { url, key };
}

export async function GET() {
  try {
    const userId = await requireCurrentCompanyUser();
    const company = await getActiveCompany(userId);
    if (!company) {
      return NextResponse.json(
        { error: "No business is configured for this account." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { url, key } = config();
    const response = await fetch(
      `${url}/rest/v1/synced_briefings?company_id=eq.${encodeURIComponent(company.id)}&select=briefing,synced_at&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Could not read synced briefing (${response.status}).`);
    }

    const rows = await response.json() as Array<{ briefing: unknown; synced_at: string }>;
    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        { error: "No synced briefing yet." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true, briefing: row.briefing, syncedAt: row.synced_at },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof Error && error.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Could not load the latest synced briefing." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
