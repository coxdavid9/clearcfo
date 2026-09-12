import { NextResponse } from "next/server";
import { getAuthCookieNames, refreshSession } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

function safeNextPath(value: string | null) {
  if (!value) return "/customer";
  if (!value.startsWith("/") || value.startsWith("//")) return "/customer";
  return value;
}

export async function GET(request: Request) {
  const { AUTH_COOKIE, REFRESH_COOKIE } = getAuthCookieNames();
  const refreshToken = request.headers.get("cookie")?.match(new RegExp(`${REFRESH_COOKIE}=([^;]+)`))?.[1];

  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const result = await refreshSession(decodeURIComponent(refreshToken));

  if (!result.ok) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(AUTH_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
    response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
    return response;
  }

  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.url));
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(AUTH_COOKIE, result.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: result.expiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, result.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
