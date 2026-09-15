import { NextResponse } from "next/server";
import { getAuthCookieNames, getSupabaseUser } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase authentication is not configured.");
  }

  return { url: url.replace(/\/$/, ""), publishableKey };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
    let refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";

    const tokenHash = typeof body?.tokenHash === "string" ? body.tokenHash : "";
    const type = typeof body?.type === "string" ? body.type : "email";

    if (!accessToken || !refreshToken) {
      if (!tokenHash) {
        return NextResponse.json({ error: "Confirmation link is incomplete." }, { status: 400 });
      }

      const { url, publishableKey } = getSupabaseConfig();
      const verifyResponse = await fetch(`${url}/auth/v1/verify`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type, token_hash: tokenHash }),
        cache: "no-store",
      });

      const payload = await verifyResponse.json().catch(() => ({}));

      if (!verifyResponse.ok || !payload?.access_token || !payload?.refresh_token) {
        return NextResponse.json(
          { error: payload?.msg || payload?.message || "The confirmation link is invalid or expired." },
          { status: 401 },
        );
      }

      accessToken = payload.access_token;
      refreshToken = payload.refresh_token;
    }

    const user = await getSupabaseUser(accessToken);
    if (!user) {
      return NextResponse.json({ error: "The confirmation link is invalid or expired." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
    const { AUTH_COOKIE, REFRESH_COOKIE } = getAuthCookieNames();
    const secure = process.env.NODE_ENV === "production";

    response.cookies.set(AUTH_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
    response.cookies.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error("[ClearCFO Auth] Email confirmation failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to complete email confirmation." }, { status: 500 });
  }
}
