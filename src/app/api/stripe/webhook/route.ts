import { NextResponse } from "next/server";
import {
  getTierFromPriceId,
  storeStripeSubscription,
  verifyStripeWebhookSignature,
  type BillingTier,
} from "../../../../lib/stripe";

export const runtime = "nodejs";

function stringId(value: unknown) {
  return typeof value === "string" ? value : null;
}

function priceIdFromSubscription(subscription: Record<string, unknown>) {
  const items = subscription.items as { data?: Array<{ price?: { id?: string } | string }> } | undefined;
  const price = items?.data?.[0]?.price;
  if (typeof price === "string") return price;
  return price?.id || null;
}

function subscriptionMetadata(subscription: Record<string, unknown>) {
  const metadata = subscription.metadata;
  return metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  try {
    verifyStripeWebhookSignature(payload, signature);
  } catch (error) {
    console.error("[ClearCFO Stripe] Webhook signature verification failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: { type: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    const object = event.data?.object || {};

    if (event.type === "checkout.session.completed") {
      const subscriptionId = stringId(object.subscription);
      if (subscriptionId) {
        const metadata = object.metadata && typeof object.metadata === "object"
          ? object.metadata as Record<string, unknown>
          : {};
        const tier = metadata.tier === "core" || metadata.tier === "pro"
          ? metadata.tier as BillingTier
          : null;

        await storeStripeSubscription({
          userId: stringId(object.client_reference_id) || stringId(metadata.user_id),
          customerId: stringId(object.customer),
          subscriptionId,
          tier,
          status: "active",
        });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscriptionId = stringId(object.id);
      if (subscriptionId) {
        const metadata = subscriptionMetadata(object);
        const priceId = priceIdFromSubscription(object);
        const metadataTier = metadata.tier === "core" || metadata.tier === "pro"
          ? metadata.tier as BillingTier
          : null;

        await storeStripeSubscription({
          userId: stringId(metadata.user_id),
          customerId: stringId(object.customer),
          subscriptionId,
          priceId,
          tier: metadataTier || getTierFromPriceId(priceId),
          status: typeof object.status === "string" ? object.status : "unknown",
          currentPeriodEnd: typeof object.current_period_end === "number" ? object.current_period_end : null,
          cancelAtPeriodEnd: object.cancel_at_period_end === true,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[ClearCFO Stripe] Webhook processing failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
