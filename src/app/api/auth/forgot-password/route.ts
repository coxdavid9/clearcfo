import { NextResponse } from "next/server";
import { authRateLimit, checkRateLimit } from "../../../../lib/rate-limit";

export const runtime = "nodejs";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Supabase authentication is not configured.");
  return { url: url.replace(/\/$/, ""), publishableKey };
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, authRateLimit);
  if (limited) return limited;

  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return NextResponse.json({ error: "Email address is required." }, { status: 400 });

    const { url, publishableKey } = getSupabaseConfig();
    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/reset-password`;

    const response = await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.error("[ClearCFO Auth] Password recovery failed:", payload?.msg || payload?.message || "Unknown error");
    }

    // Do not reveal whether the email belongs to a ClearCFO account.
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ClearCFO Auth] Password recovery error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Password reset is not configured correctly." }, { status: 503 });
  }
}
