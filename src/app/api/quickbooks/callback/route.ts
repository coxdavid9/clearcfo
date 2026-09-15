import { NextResponse } from "next/server";
import { completeQuickBooksCallback } from "../../../../lib/quickbooks";

export const runtime = "nodejs";

const APP_URL = process.env.NODE_ENV === "production"
  ? "https://theclearcfo.com"
  : null;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = APP_URL || url.origin;
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");

  if (error) {
    return NextResponse.redirect(new URL(`/customer?quickbooks=cancelled&message=${encodeURIComponent(errorDescription || error)}`, origin));
  }

  if (!code || !realmId || !state) {
    return NextResponse.redirect(new URL("/customer?quickbooks=error&message=Missing%20QuickBooks%20authorization%20response", origin));
  }

  try {
    const result = await completeQuickBooksCallback(code, realmId, state);
    const message = result.companyName ? `Connected%20to%20${encodeURIComponent(result.companyName)}` : "QuickBooks%20connected";
    return NextResponse.redirect(new URL(`/customer?quickbooks=connected&message=${message}`, origin));
  } catch (callbackError) {
    console.error("[ClearCFO QuickBooks] Callback failed:", callbackError);
    return NextResponse.redirect(new URL(`/customer?quickbooks=error&message=${encodeURIComponent(callbackError instanceof Error ? callbackError.message : "QuickBooks connection failed")}`, origin));
  }
}
