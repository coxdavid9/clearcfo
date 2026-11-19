import { NextResponse } from "next/server";
import { requireBillingUser } from "../../../../../lib/billing/entitlements";
import { validatePromo } from "../../../../../lib/billing/promo";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const id = await requireBillingUser();
    const body = await request.json();
    const terms = await validatePromo(body?.code, id);
    return NextResponse.json(terms ? { valid: true, trialDays: terms.trialDays, cardRequired: terms.cardRequired } : { valid: false });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
