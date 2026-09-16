import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieNames, getSupabaseUser } from "../../../../lib/supabase-auth";
import { getStoredSubscription } from "../../../../lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const { AUTH_COOKIE } = getAuthCookieNames();
    const accessToken = cookieStore.get(AUTH_COOKIE)?.value;

    if (!accessToken) return NextResponse.json({ subscription: null }, { status: 401 });

    const user = await getSupabaseUser(accessToken);
    if (!user?.id) return NextResponse.json({ subscription: null }, { status: 401 });

    const subscription = await getStoredSubscription(String(user.id));
    return NextResponse.json({ subscription }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[ClearCFO Stripe] Subscription lookup failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to load billing status." }, { status: 500 });
  }
}
