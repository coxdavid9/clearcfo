import { NextResponse } from "next/server";
import { authRateLimit, checkRateLimit } from "../../../../lib/rate-limit";
import { getAuthCookieNames, signUpWithPassword } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

const profileFields = ["companyName", "industry", "companySize", "contactName", "contactPhone"] as const;
type ProfileField = (typeof profileFields)[number];

function readProfile(body: Record<string, unknown>) {
  const profile = {} as Record<ProfileField, string>;

  for (const field of profileFields) {
    const value = body[field];
    if (value !== undefined && typeof value !== "string") {
      return { error: `Invalid ${field}.` as const };
    }
    profile[field] = typeof value === "string" ? value.trim().slice(0, 200) : "";
  }

  if (!profile.industry || !profile.companySize || !profile.contactName) {
    return { error: "Industry, company size, and primary contact are required." as const };
  }

  return { profile };
}

export async function POST(request: Request) {
  // Rate limit: slows fake-account floods.
  const limited = checkRateLimit(request, authRateLimit);
  if (limited) return limited;

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

    const profileResult = readProfile(body);
    if ("error" in profileResult) {
      return NextResponse.json({ error: profileResult.error }, { status: 400 });
    }

    const result = await signUpWithPassword(email, password, profileResult.profile);

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
