import { NextResponse } from "next/server";
import { checkRateLimit, authRateLimit } from "../../../../lib/rate-limit";
import { getSupabaseUser } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = checkRateLimit(request, authRateLimit);
  if (limited) return limited;

  try {
    const body = await request.json();
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
    const tokenHash = typeof body?.tokenHash === "string" ? body.tokenHash : "";
    const type = typeof body?.type === "string" ? body.type : "email";

    let sessionAccessToken = accessToken;
    let sessionRefreshToken = refreshToken;

    if (!sessionAccessToken && tokenHash) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: "Authentication service is not configured." }, { status: 500 });
      }

      const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type, token_hash: tokenHash }),
        cache: "no-store",
      });

      if (!verifyResponse.ok) {
        return NextResponse.json({ error: "Invalid or expired confirmation link." }, { status: 400 });
      }

      const session = await verifyResponse.json();
      sessionAccessToken = typeof session?.access_token === "string" ? session.access_token : "";
      sessionRefreshToken = typeof session?.refresh_token === "string" ? session.refresh_token : "";
    }

    if (!sessionAccessToken) {
      return NextResponse.json({ error: "Missing confirmation token." }, { status: 400 });
    }

    const user = await getSupabaseUser(sessionAccessToken);
    if (!user) {
      return NextResponse.json({ error: "Unable to verify your account." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, user });
    response.cookies.set("clearcfo-auth", sessionAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    if (sessionRefreshToken) {
      response.cookies.set("clearcfo-refresh", sessionRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid confirmation request." }, { status: 400 });
  }
}
