import { NextResponse } from "next/server";
import { requireCurrentCompanyUser, setActiveCompany } from "../../../../lib/company";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentCompanyUser();
    const body = await request.json().catch(() => ({}));
    const companyId = typeof body?.companyId === "string" ? body.companyId : "";
    if (!companyId) return NextResponse.json({ error: "Company ID is required." }, { status: 400 });

    await setActiveCompany(userId, companyId);
    return NextResponse.json({ ok: true, companyId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to select business.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
