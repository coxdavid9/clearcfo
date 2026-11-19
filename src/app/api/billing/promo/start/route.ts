import { NextResponse } from "next/server";
import { requireBillingUser, getSubscription, hasAccess, type Plan, type BillingInterval } from "../../../../../lib/billing/entitlements";
import { validatePromo, claimPromoCode, recordPromoRedemption, INVALID_PROMO } from "../../../../../lib/billing/promo";
import { upsertSubscription } from "../../../../../lib/billing/stripe";
import { sendTrialEmail } from "../../../../../lib/billing/trial-email";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const userId = await requireBillingUser();
    const body = await request.json().catch(() => ({}));
    const plan = body?.plan as Plan, interval = body?.interval as BillingInterval;
    if (!["core", "pro"].includes(plan) || !["month", "year"].includes(interval))
      return NextResponse.json({ error: "Invalid plan selection." }, { status: 400 });
    const terms = await validatePromo(body?.code, userId);
    if (!terms || terms.cardRequired)
      return NextResponse.json({ error: INVALID_PROMO }, { status: 400 });
    if (body?.termsAccepted !== true)
      return NextResponse.json({ error: "Please accept the Terms of Service to start your trial." }, { status: 400 });
    const existing = await getSubscription(userId);
    if (existing && hasAccess(existing))
      return NextResponse.json({ error: "A subscription already exists." }, { status: 409 });
    if (existing && (existing.stripe_subscription_id || !existing.promo_code || existing.is_comp))
      return NextResponse.json({ error: INVALID_PROMO }, { status: 400 });
    if (!await claimPromoCode(terms.code, userId))
      return NextResponse.json({ error: INVALID_PROMO }, { status: 400 });

    const now = new Date(), trialEndsAt = new Date(now.getTime() + terms.trialDays * 86400000).toISOString();
    await upsertSubscription({
      user_id: userId, stripe_customer_id: null, stripe_subscription_id: null,
      plan, interval, status: "trialing", trial_ends_at: trialEndsAt,
      current_period_end: trialEndsAt, cancel_at_period_end: false, is_comp: false,
      promo_code: terms.code, trial_card_required: false, terms_accepted_at: now.toISOString(),
      // Reset the schedule when replacing an expired in-app trial.
      created_at: now.toISOString(), trial_email_day0_sent_at: null,
      trial_email_day2_sent_at: null, trial_email_day5_sent_at: null, trial_email_day7_sent_at: null,
    });
    await recordPromoRedemption(terms.code, userId);
    try {
      const saved = await getSubscription(userId);
      if (saved && !saved.trial_email_day0_sent_at) await sendTrialEmail(saved, 0);
    } catch (error) {
      console.error("[Billing] promo welcome email", error);
    }
    return NextResponse.json({ ok: true, trialEndsAt });
  } catch (error) {
    console.error("[Billing] promo start", error);
    return NextResponse.json({ error: "Unable to start trial." }, { status: 500 });
  }
}
