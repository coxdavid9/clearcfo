import { NextResponse } from "next/server";
import { getAuthCookieNames, signUpWithPassword } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const result = await signUpWithPassword(email, password);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (!result.accessToken || !result.refreshToken) {
      return NextResponse.json({ ok: true, requiresEmailConfirmation: true });
    }

    const response = NextResponse.json({ ok: true, requiresEmailConfirmation: false });
    const { AUTH_COOKIE, REFRESH_COOKIE } = getAuthCookieNames();
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
  } catch (error) {
    console.error("[ClearCFO Auth] Signup failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Authentication is not configured correctly." }, { status: 503 });
  }
}
