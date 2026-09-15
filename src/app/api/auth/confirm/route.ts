import { NextResponse } from "next/server";
import { getAuthCookieNames, getSupabaseUser } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: "Confirmation session is incomplete." }, { status: 400 });
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
