import { NextResponse } from "next/server";
import { getAuthCookieNames } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  const { AUTH_COOKIE, REFRESH_COOKIE } = getAuthCookieNames();

  response.cookies.set(AUTH_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });

  return response;
}
