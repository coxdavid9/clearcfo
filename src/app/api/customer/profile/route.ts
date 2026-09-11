import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieNames, getSupabaseUser } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

const allowedFields = [
  "companyName",
  "industry",
  "companySize",
  "contactName",
  "contactPhone",
] as const;

type ProfileField = (typeof allowedFields)[number];

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const currentUser = await getSupabaseUser(accessToken);
  if (!currentUser) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid profile data." }, { status: 400 });
  }

  const profile: Record<ProfileField, string> = {
    companyName: "",
    industry: "",
    companySize: "",
    contactName: "",
    contactPhone: "",
  };

  for (const field of allowedFields) {
    const value = (body as Record<string, unknown>)[field];
    if (value !== undefined && typeof value !== "string") {
      return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
    }
    profile[field] = typeof value === "string" ? value.trim().slice(0, 200) : "";
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 500 });
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        ...(currentUser.user_metadata || {}),
        ...profile,
      },
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.msg || payload?.message || "Unable to save your profile." },
      { status: response.status }
    );
  }

  return NextResponse.json({
    ok: true,
    profile: payload?.user_metadata || profile,
  });
}
