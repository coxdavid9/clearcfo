import { NextResponse } from "next/server";
import { disconnectQuickBooks, requireCurrentUser } from "../../../../lib/quickbooks-company";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await disconnectQuickBooks(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Disconnect failed:", error);
    return NextResponse.json({ error: "Unable to disconnect QuickBooks." }, { status: 500 });
  }
}
