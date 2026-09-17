import { NextResponse } from "next/server";
import { createCompany, listUserCompanies, requireCurrentCompanyUser } from "../../../lib/company";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireCurrentCompanyUser();
    return NextResponse.json(
      { companies: await listUserCompanies(userId) },
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
