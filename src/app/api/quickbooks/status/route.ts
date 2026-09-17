import { NextResponse } from "next/server";
import { getQuickBooksConnection, requireCurrentUser } from "../../../../lib/quickbooks-company";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(
      { connection: await getQuickBooksConnection(user.id) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Status failed:", error);
    return NextResponse.json({ error: "Unable to check QuickBooks connection." }, { status: 500 });
  }
}
