// src/lib/rate-limit.ts
//
// In-memory sliding-window rate limiter (per server instance).
// Protects expensive or abuse-prone endpoints: the AI analysis route
// (each call costs OpenAI API money) and the auth routes (brute force).
//
// NOTE: This store lives in the Node.js process memory. That is fine on a
// single Render instance. If the app ever runs on multiple instances behind
// a load balancer, replace the Map with a shared store (e.g. Upstash Redis)
// — the checkRateLimit() call signature in the routes stays the same.

import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Prune expired buckets every 5 minutes so the map cannot grow forever.
let lastPrune = 0;
function prune(now: number) {
  if (now - lastPrune < 5 * 60 * 1000) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the LAST entry: every trusted proxy appends the address it saw, so
    // the final entry is the one added by our own edge (Render). The first
    // entry is client-controlled and can be spoofed to dodge rate limits.
    const entries = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const last = entries[entries.length - 1];
    if (last) return last;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export type RateLimitOptions = {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Label used in the 429 message, e.g. "AI analyses". */
  label?: string;
};

/**
 * Returns a 429 NextResponse when the caller is over the limit, otherwise null.
 *
 * Usage at the top of a route handler:
 *   const limited = checkRateLimit(request, aiRateLimit);
 *   if (limited) return limited;
 */
export function checkRateLimit(
  request: Request,
  { limit, windowMs, label = "requests" }: RateLimitOptions
): NextResponse | null {
  const now = Date.now();
  prune(now);

  const key = `${label}:${getClientIp(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      { error: `Too many ${label}. Please try again shortly.` },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  bucket.count += 1;
  return null;
}

/** AI analysis endpoint: each call costs OpenAI API money, so keep it tight. */
export const aiRateLimit = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
  label: "AI analyses",
} satisfies RateLimitOptions;

/** Login/signup: slows credential-stuffing and fake-account floods. */
export const authRateLimit = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
  label: "auth attempts",
} satisfies RateLimitOptions;
