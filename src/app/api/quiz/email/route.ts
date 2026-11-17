import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { isQuizAnswers } from "../../../../lib/quiz";
import { buildQuizEmail } from "../../../../lib/quiz-email";
import { sendEmail } from "../../../../lib/email";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 16 * 1024;

export async function POST(request: Request) {
  const limited = checkRateLimit(request, { limit: 5, windowMs: 15 * 60 * 1000, label: "quiz emails" });
  if (limited) return limited;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Please send your breakdown from the quiz page." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Please submit JSON data." }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Quiz request is too large." }, { status: 413 });
  }
  // Bound streamed bodies too: Content-Length may be absent or inaccurate.
  let raw = "";
  try {
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Invalid quiz data." }, { status: 400 });
    const decoder = new TextDecoder();
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_REQUEST_BYTES) {
          await reader.cancel();
          return NextResponse.json({ error: "Quiz request is too large." }, { status: 413 });
        }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
  } catch {
    return NextResponse.json({ error: "Invalid quiz data." }, { status: 400 });
  }
  let body;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "Invalid quiz data." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || !isQuizAnswers(body.answers)) {
    return NextResponse.json({ error: "Please answer all eight questions before requesting a breakdown." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (email.length > 254 || /[\r\n,<>;]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const recipientLimited = checkRateLimit(new Request(request.url, { headers: { "x-real-ip": email.toLowerCase() } }), {
    limit: 2, windowMs: 60 * 60 * 1000, label: "quiz breakdowns for this address",
  });
  if (recipientLimited) return recipientLimited;
  try {
    // Recompute all content server-side. Do not trust scores, HTML, or links from the client.
    await sendEmail(buildQuizEmail(email, body.answers));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "We couldn't send your breakdown right now. Your results are still here. Please try again shortly." }, { status: 503 });
  }
}
