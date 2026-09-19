import { sanitizeHeader, escapeHtml } from "./email-helpers";

export type EmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
};

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " is not configured.");
  return value;
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://theclearcfo.com").trim().replace(/\/$/, "");
}

export function buildResendRequest({ to, subject, text, html }: EmailPayload) {
  const apiKey = getEnv("RESEND_API_KEY");
  const recipients = (Array.isArray(to) ? to : [to]).map((value) => sanitizeHeader(value));
  const preferencesUrl = appUrl() + "/alerts";
  const from = process.env.ALERTS_FROM_EMAIL?.trim() || "notifications@theclearcfo.com";
  return {
    url: "https://api.resend.com/emails",
    init: {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ClearCFO <" + sanitizeHeader(from) + ">",
        to: recipients,
        subject: sanitizeHeader(subject),
        text,
        html,
        headers: {
          "List-Unsubscribe": "<" + preferencesUrl + ">",
          "Reply-To": "support@theclearcfo.com",
        },
      }),
    },
  };
}

export async function sendEmail(payload: EmailPayload) {
  const request = buildResendRequest(payload);
  const response = await fetch(request.url, request.init);
  if (!response.ok) {
    const details = await response.text();
    console.error("[ClearCFO Email] Resend API failed:", response.status, details.slice(0, 500));
    throw new Error("Resend API returned " + response.status + ".");
  }
}

export { sanitizeHeader, escapeHtml };
