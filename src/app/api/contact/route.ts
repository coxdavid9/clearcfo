import { NextResponse } from "next/server";
import { checkRateLimit, authRateLimit } from "../../../lib/rate-limit";

export const runtime = "nodejs";

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  const limited = checkRateLimit(request, authRateLimit);
  if (limited) return limited;

  try {
    const body = await request.json();
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const website = typeof body?.website === "string" ? body.website.trim() : "";

    if (website) return NextResponse.json({ ok: true });
    if (!topic || !email || !message) {
      return NextResponse.json(
        { error: "Please choose a topic and provide your email and message." },
        { status: 400 },
      );
    }
    if (email.length > 254 || !/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: "Please keep your message under 5,000 characters." }, { status: 400 });
    }

    const apiKey = getEnv("RESEND_API_KEY");
    const from = process.env.CONTACT_FROM_EMAIL?.trim() || "contact@theclearcfo.com";
    const to = process.env.CONTACT_TO_EMAIL?.trim() || "contact@theclearcfo.com";
    const safeTopic = sanitizeHeader(topic);
    const safeEmail = sanitizeHeader(email);
    const subject = `ClearCFO website inquiry: ${safeTopic}`;

    const text = [
      `Topic: ${topic}`,
      `From: ${email}`,
      "",
      message,
      "",
      `Reply directly to this email to respond to ${email}.`,
    ].join("\n");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#17213a;line-height:1.6">
        <div style="padding:28px 0 22px;border-bottom:1px solid #e5e7eb">
          <img src="https://theclearcfo.com/logo.png" alt="ClearCFO" width="224" style="display:block;width:224px;max-width:100%;height:auto;border:0" />
          <div style="font-size:13px;color:#6b7280;margin-top:8px">Financial clarity. Smarter decisions.</div>
        </div>
        <div style="padding:30px 0">
          <h2 style="margin:0 0 20px;font-size:22px;line-height:1.3">New website inquiry</h2>
          <p style="margin:8px 0"><strong>Topic:</strong> ${escapeHtml(topic)}</p>
          <p style="margin:8px 0"><strong>From:</strong> ${escapeHtml(email)}</p>
          <div style="margin-top:24px;padding:20px;background:#f8fafc;border-radius:12px;white-space:pre-wrap">${escapeHtml(message)}</div>
          <p style="margin-top:24px;font-size:14px;color:#6b7280">Reply to this email to respond directly to ${escapeHtml(email)}.</p>
        </div>
        <div style="padding:18px 0 30px;border-top:1px solid #e5e7eb;font-size:12px;color:#94a3b8">ClearCFO · Financial clarity. Smarter decisions.</div>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ClearCFO <${sanitizeHeader(from)}>`,
        to: [sanitizeHeader(to)],
        reply_to: safeEmail,
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("[ClearCFO Contact] Resend API failed:", response.status, details.slice(0, 500));
      throw new Error(`Resend API returned ${response.status}.`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ClearCFO Contact] Email failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "We couldn't send your message right now. Please try again shortly." },
      { status: 503 },
    );
  }
}
