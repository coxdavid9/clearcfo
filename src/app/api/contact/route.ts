import { NextResponse } from "next/server";
import tls from "node:tls";
import { checkRateLimit, authRateLimit } from "../../../lib/rate-limit";

export const runtime = "nodejs";

type SmtpClient = {
  socket: ReturnType<typeof tls.connect>;
  buffer: string;
};

function getEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function readResponse(client: SmtpClient): Promise<string> {
  return new Promise((resolve, reject) => {
    const onData = () => {
      const lines = client.buffer.split(/\r?\n/);
      const completeIndex = lines.findIndex((line) => /^\d{3} /.test(line));
      if (completeIndex === -1) return;
      const response = lines.slice(0, completeIndex + 1).join("\n");
      client.buffer = lines.slice(completeIndex + 1).join("\n");
      client.socket.off("data", onData);
      resolve(response);
    };
    client.socket.on("data", (chunk) => {
      client.buffer += chunk.toString("utf8");
      onData();
    });
    client.socket.once("error", reject);
  });
}

async function smtpCommand(client: SmtpClient, command: string, expected: number[]) {
  client.socket.write(`${command}\r\n`);
  const response = await readResponse(client);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) throw new Error(`SMTP command failed with ${code}.`);
  return response;
}

function encodeBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]/g, " ").trim();
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
      return NextResponse.json({ error: "Please choose a topic and provide your email and message." }, { status: 400 });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: "Please keep your message under 5,000 characters." }, { status: 400 });
    }

    const host = process.env.CONTACT_SMTP_HOST?.trim() || "mail.spacemail.com";
    const port = Number(process.env.CONTACT_SMTP_PORT || 465);
    const username = getEnv("CONTACT_SMTP_USERNAME");
    const password = getEnv("CONTACT_SMTP_PASSWORD");
    const from = process.env.CONTACT_FROM_EMAIL?.trim() || "contact@theclearcfo.com";
    const to = process.env.CONTACT_TO_EMAIL?.trim() || "contact@theclearcfo.com";

    const socket = tls.connect({ host, port, servername: host, timeout: 10000 });
    const client: SmtpClient = { socket, buffer: "" };
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
      socket.once("timeout", () => reject(new Error("SMTP connection timed out.")));
    });

    await readResponse(client);
    await smtpCommand(client, `EHLO theclearcfo.com`, [220, 250]);
    await smtpCommand(client, "AUTH LOGIN", [334]);
    await smtpCommand(client, encodeBase64(username), [334]);
    await smtpCommand(client, encodeBase64(password), [235]);
    await smtpCommand(client, `MAIL FROM:<${sanitizeHeader(from)}>`, [250]);
    await smtpCommand(client, `RCPT TO:<${sanitizeHeader(to)}>`, [250, 251]);
    await smtpCommand(client, "DATA", [354]);

    const subject = `ClearCFO website inquiry: ${sanitizeHeader(topic)}`;
    const bodyText = [
      `Topic: ${topic}`,
      `From: ${email}`,
      "",
      message,
      "",
      `Reply directly to this email to respond to ${email}.`,
    ].join("\n");

    const headers = [
      `From: ClearCFO Website <${sanitizeHeader(from)}>`,
      `To: ${sanitizeHeader(to)}`,
      `Reply-To: ${sanitizeHeader(email)}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
    ].join("\r\n");

    const data = `${headers}\r\n\r\n${bodyText.replace(/^\./gm, "..")}\r\n.`;
    await smtpCommand(client, data, [250]);
    await smtpCommand(client, "QUIT", [221]);
    socket.end();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ClearCFO Contact] Email failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "We couldn't send your message right now. Please try again shortly." }, { status: 503 });
  }
}
