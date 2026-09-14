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
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!accessToken || password.length < 8) {
      return NextResponse.json({ error: "A valid reset link and password of at least 8 characters are required." }, { status: 400 });
    }

    const { url, publishableKey } = getSupabaseConfig();
    const response = await fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: payload?.msg || payload?.message || "Unable to update your password." }, { status: response.status >= 400 && response.status < 500 ? 400 : 503 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ClearCFO Auth] Password update failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Password reset is not configured correctly." }, { status: 503 });
  }
}
