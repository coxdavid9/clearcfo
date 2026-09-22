import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthCookieNames, refreshSession } from "./src/lib/supabase-auth";

const AUTH_COOKIE = "clearcfo_access_token";
const REFRESH_COOKIE = "clearcfo_refresh_token";

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
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

/**
 * Content-Security-Policy: blocks cross-site scripting by allowlisting where
 * each resource type may load from. Notes on the choices:
 * - script-src keeps 'unsafe-inline' because Next.js emits inline scripts;
 *   no 'unsafe-eval' is needed.
 * - style-src keeps 'unsafe-inline' for React inline styles.
 * - connect-src allows same-origin API routes plus Supabase (auth/database).
 * - QuickBooks OAuth is a top-level navigation, which CSP does not restrict.
 */
function buildContentSecurityPolicy(): string {
  let connectSrc = "connect-src 'self'";
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      connectSrc += ` ${new URL(supabaseUrl).origin}`;
    }
  } catch {
    // If the Supabase URL is missing or invalid, fall back to 'self' only.
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function refreshRedirect(request: NextRequest) {
  const next = request.nextUrl.pathname + request.nextUrl.search;
  const refreshUrl = new URL("/api/auth/refresh", request.url);
  refreshUrl.searchParams.set("next", next);
  return addSecurityHeaders(NextResponse.redirect(refreshUrl));
}

async function refreshApiResponse(refreshToken: string) {
  try {
    const result = await refreshSession(decodeURIComponent(refreshToken));
    if (!result.ok) return null;

    const { AUTH_COOKIE, REFRESH_COOKIE } = getAuthCookieNames();
    const response = NextResponse.next();
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

    return addSecurityHeaders(response);
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE)?.value;
  const hasRefreshToken = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
  const pathname = request.nextUrl.pathname;
  const customerRoute = pathname.startsWith("/customer");

  if (!accessToken) {
    if (customerRoute) {
      return addSecurityHeaders(
        hasRefreshToken
          ? refreshRedirect(request)
          : NextResponse.redirect(new URL("/login", request.url))
      );
    }

    if (hasRefreshToken) {
      const refreshed = await refreshApiResponse(
        request.cookies.get(REFRESH_COOKIE)!.value
      );
      if (refreshed) return refreshed;
    }

    return addSecurityHeaders(
      NextResponse.json({ error: "Authentication required." }, { status: 401 })
    );
  }

  if (!(await isAuthenticated(accessToken))) {
    if (customerRoute) {
      return addSecurityHeaders(
        hasRefreshToken
          ? refreshRedirect(request)
          : NextResponse.redirect(new URL("/login", request.url))
      );
    }

    if (hasRefreshToken) {
      const refreshed = await refreshApiResponse(
        request.cookies.get(REFRESH_COOKIE)!.value
      );
      if (refreshed) return refreshed;
    }

    return addSecurityHeaders(
      NextResponse.json({ error: "Authentication required." }, { status: 401 })
    );
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/customer/:path*", "/api/cfo-analysis"],
};
