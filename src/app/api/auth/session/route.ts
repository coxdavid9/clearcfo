import { NextResponse } from "next/server";
import { getAuthCookieNames, getSupabaseUser } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { AUTH_COOKIE } = getAuthCookieNames();
  const accessToken = request.headers.get("cookie")?.match(new RegExp(`${AUTH_COOKIE}=([^;]+)`))?.[1];

  if (!accessToken) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await getSupabaseUser(decodeURIComponent(accessToken));

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email } });
}
