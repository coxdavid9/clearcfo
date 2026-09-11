import { NextResponse } from "next/server";
import { getAuthCookieNames } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

export async function GET() {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/login",
    },
  });

  const { AUTH_COOKIE, REFRESH_COOKIE } = getAuthCookieNames();

  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });

  return response;
}
