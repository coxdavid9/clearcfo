import { sanitizeHeader, escapeHtml } from "./email-helpers";

export type EmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
};

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function sendEmail({ to, subject, text, html }: EmailPayload) {
  const apiKey = getEnv("RESEND_API_KEY");
  const from = process.env.ALERTS_FROM_EMAIL?.trim() || "notifications@theclearcfo.com";
  const recipients = (Array.isArray(to) ? to : [to]).map((value) => sanitizeHeader(value));
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `ClearCFO <${sanitizeHeader(from)}>`,
      to: recipients,
      subject: sanitizeHeader(subject),
      text,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("[ClearCFO Email] Resend API failed:", response.status, details.slice(0, 500));
    throw new Error(`Resend API returned ${response.status}.`);
  }
}

export { sanitizeHeader, escapeHtml };
