import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "clearcfo_access_token";

async function isAuthenticated(accessToken: string) {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return false;
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE)?.value;
  const pathname = request.nextUrl.pathname;
  const customerRoute = pathname.startsWith("/customer");

  if (!accessToken) {
    return addSecurityHeaders(
      customerRoute
        ? NextResponse.redirect(new URL("/login", request.url))
        : NextResponse.json({ error: "Authentication required." }, { status: 401 })
    );
  }

  if (!(await isAuthenticated(accessToken))) {
    return addSecurityHeaders(
      customerRoute
        ? NextResponse.redirect(new URL("/login", request.url))
        : NextResponse.json({ error: "Authentication required." }, { status: 401 })
    );
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/customer/:path*", "/api/cfo-analysis"],
};
