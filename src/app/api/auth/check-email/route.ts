import { NextResponse } from "next/server";
import { authRateLimit, checkRateLimit } from "../../../../lib/rate-limit";
import { supabaseAuthUserExists } from "../../../../lib/supabase-auth";

export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, authRateLimit);
  if (limited) return limited;

  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const exists = await supabaseAuthUserExists(email);
    return NextResponse.json({ exists });
  } catch (error) {
    console.error("[ClearCFO Auth] Email check failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to check this email right now." }, { status: 503 });
  }
}
