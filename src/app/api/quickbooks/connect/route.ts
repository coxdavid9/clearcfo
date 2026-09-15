import { NextResponse } from "next/server";
import { createQuickBooksConnectUrl, requireCurrentUser } from "../../../../lib/quickbooks";

export const runtime = "nodejs";

const APP_URL = process.env.NODE_ENV === "production"
  ? "https://theclearcfo.com"
  : (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

export async function GET() {
  try {
    const user = await requireCurrentUser();
    if (!user) return NextResponse.redirect(new URL("/login", APP_URL));
    const url = await createQuickBooksConnectUrl(user.id);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[ClearCFO QuickBooks] Connect failed:", error);
    return NextResponse.redirect(new URL("/customer?quickbooks=error", APP_URL));
  }
}
