import { NextResponse } from "next/server";
import { getQuickBooksConnection, requireCurrentUser } from "../../../../lib/quickbooks-company";
import { getActiveCompany } from "../../../../lib/company";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // The active company id is returned even when QuickBooks is not
    // connected, so the client can verify that a cached briefing belongs to
    // the business currently being viewed (multi-company isolation).
    const [connection, activeCompany] = await Promise.all([
      getQuickBooksConnection(user.id),
      getActiveCompany(user.id),
    ]);
    return NextResponse.json(
      { connection, activeCompanyId: activeCompany?.id || null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Status failed:", error);
    return NextResponse.json({ error: "Unable to check QuickBooks connection." }, { status: 500 });
  }
}
