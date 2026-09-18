import { NextResponse } from "next/server";
import { createCompany, getActiveCompany, listUserCompanies, requireCurrentCompanyUser } from "../../../lib/company";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireCurrentCompanyUser();
    const companies = await listUserCompanies(userId);
    // Resolve the active company without creating one: getActiveCompany
    // auto-creates when the user has none, so only call it when memberships
    // already exist.
    const activeCompany = companies.length ? await getActiveCompany(userId) : null;
    return NextResponse.json(
      { companies, activeCompanyId: activeCompany?.id || null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load businesses.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentCompanyUser();
    const body = await request.json().catch(() => ({}));
    const company = await createCompany(userId, {
      name: typeof body?.name === "string" ? body.name : "",
      industry: typeof body?.industry === "string" ? body.industry : undefined,
      companySize: typeof body?.companySize === "string" ? body.companySize : undefined,
      contactPhone: typeof body?.contactPhone === "string" ? body.contactPhone : undefined,
    });
    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create business.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
