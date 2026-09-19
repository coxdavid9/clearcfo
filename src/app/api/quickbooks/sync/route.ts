import { NextResponse } from "next/server";
import { requireCurrentUser } from "../../../../lib/quickbooks-company";
import { getActiveCompany } from "../../../../lib/company";
import { syncCompanyBriefing } from "../../../../lib/jobs/company-sync";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const company = await getActiveCompany(user.id);
    if (!company) return NextResponse.json({ error: "No business is configured for this account." }, { status: 400 });

    const result = await syncCompanyBriefing(company.id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Sync failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "QuickBooks sync failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
