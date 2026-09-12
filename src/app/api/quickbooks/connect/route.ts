import { NextResponse } from "next/server";
import { createQuickBooksConnectUrl, requireCurrentUser } from "../../../../lib/quickbooks";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
    const url = await createQuickBooksConnectUrl(user.id);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Connect failed:", error);
    return NextResponse.redirect(new URL("/customer?quickbooks=error", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }
}
