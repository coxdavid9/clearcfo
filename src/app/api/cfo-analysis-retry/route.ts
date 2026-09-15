import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function callAnalysis(request: Request, body: string): Promise<Response> {
  return fetch(new URL("/api/cfo-analysis", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie") as string } : {}),
      ...(request.headers.get("x-forwarded-for") ? { "x-forwarded-for": request.headers.get("x-forwarded-for") as string } : {}),
      ...(request.headers.get("x-real-ip") ? { "x-real-ip": request.headers.get("x-real-ip") as string } : {}),
    },
    body,
    cache: "no-store",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (!body) return NextResponse.json({ error: "Invalid analysis payload." }, { status: 400 });

    let response = await callAnalysis(request, body);
    if (response.ok) return response;

    // OpenAI calls can fail transiently. Give the same request one controlled retry
    // instead of making the user manually click through another failure.
    if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      response = await callAnalysis(request, body);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate the CFO analysis." },
      { status: 500 }
    );
  }
}
