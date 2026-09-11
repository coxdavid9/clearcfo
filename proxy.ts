import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "clearcfo_access_token";

async function isAuthenticated(accessToken: string) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return false;
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE)?.value;
  const pathname = request.nextUrl.pathname;
  const customerRoute = pathname.startsWith("/customer");

  if (!accessToken) {
    return customerRoute
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!(await isAuthenticated(accessToken))) {
    return customerRoute
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/customer/:path*", "/api/cfo-analysis"],
};
