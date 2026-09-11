import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthCookieNames, getSupabaseUser, refreshSession } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE, REFRESH_COOKIE } = getAuthCookieNames();
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    const user = await getSupabaseUser(accessToken);
    if (user) {
      return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email } }, { headers: { "Cache-Control": "no-store" } });
    }
  }

  if (!refreshToken) {
    return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const result = await refreshSession(decodeURIComponent(refreshToken));

  if (!result.ok) {
    const response = NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(AUTH_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", expires: new Date(0), path: "/" });
    response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", expires: new Date(0), path: "/" });
    return response;
  }

  const response = NextResponse.json({ authenticated: true, user: { id: result.user?.id, email: result.user?.email } }, { headers: { "Cache-Control": "no-store" } });
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(AUTH_COOKIE, result.accessToken, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: result.expiresIn });
  response.cookies.set(REFRESH_COOKIE, result.refreshToken, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });

  return response;
}
