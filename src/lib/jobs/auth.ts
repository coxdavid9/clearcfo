import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authRateLimit, checkRateLimit } from "../rate-limit";

export function authorizeCron(request: Request): NextResponse | null {
  const limited = checkRateLimit(request, authRateLimit);
  if (limited) return limited;

  const configured = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get("authorization") || "";
  const expected = configured ? `Bearer ${configured}` : "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  const valid = Boolean(configured) && a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return null;
}
