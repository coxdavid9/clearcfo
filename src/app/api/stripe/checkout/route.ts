import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieNames, getSupabaseUser } from "../../../../lib/supabase-auth";
import { createCheckoutSession, type BillingTier } from "../../../../lib/stripe";

export const runtime = "nodejs";

function parseTier(value: unknown): BillingTier | null {
  return value === "core" || value === "pro" ? value : null;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const { AUTH_COOKIE } = getAuthCookieNames();
    const accessToken = cookieStore.get(AUTH_COOKIE)?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const user = await getSupabaseUser(accessToken);
    if (!user?.id) {
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const tier = parseTier(body?.tier);
    if (!tier) {
      return NextResponse.json({ error: "Choose a valid ClearCFO plan." }, { status: 400 });
    }

    const session = await createCheckoutSession({
      tier,
      userId: String(user.id),
      email: typeof user.email === "string" ? user.email : null,
    });

    return NextResponse.json(session, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[ClearCFO Stripe] Checkout creation failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to start Stripe Checkout." }, { status: 500 });
  }
}
