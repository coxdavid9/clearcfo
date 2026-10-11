// Match the live webhook destination; do not silently follow account upgrades.
export const STRIPE_API_VERSION = "2026-08-26.dahlia";

type SubscriptionPayload = {
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }>; has_more?: boolean };
};

export function subscriptionPeriodEnd(subscription: SubscriptionPayload): string | null {
  let end = subscription.current_period_end;
  if (end == null) {
    const items = subscription.items?.data ?? [];
    // ClearCFO sells one recurring plan per subscription. Reject ambiguous data.
    if (items.length > 1 || subscription.items?.has_more) {
      throw new Error("Multiple subscription items are not supported.");
    }
    end = items[0]?.current_period_end;
  }
  if (end == null) return null;
  if (!Number.isFinite(end) || end <= 0) throw new Error("Invalid subscription period end.");
  return new Date(end * 1000).toISOString();
}

type Metadata = { supabase_user_id?: string } | null;
type InvoicePayload = {
  parent?: { type?: string; subscription_details?: { metadata?: Metadata } | null } | null;
  subscription_details?: { metadata?: Metadata } | null;
  metadata?: Metadata;
};

export function invoiceUserId(invoice: InvoicePayload): string | undefined {
  const parent = invoice.parent;
  return (parent?.type === "subscription_details" ? parent.subscription_details?.metadata?.supabase_user_id : undefined)
    || invoice.subscription_details?.metadata?.supabase_user_id
    || invoice.metadata?.supabase_user_id;
}
