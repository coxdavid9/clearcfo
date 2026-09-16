import crypto from "node:crypto";

export type BillingTier = "core" | "pro";

type StripeConfig = {
  secretKey: string;
  corePriceId: string;
  proPriceId: string;
  appUrl: string;
  supabaseUrl: string;
  serviceRoleKey: string;
};

function getConfig(): StripeConfig {
  const values = {
    secretKey: process.env.STRIPE_SECRET_KEY,
    corePriceId: process.env.STRIPE_PRICE_CORE,
    proPriceId: process.env.STRIPE_PRICE_PRO,
    appUrl: (process.env.NEXT_PUBLIC_SITE_URL || "https://theclearcfo.com").replace(/\/$/, ""),
    supabaseUrl: process.env.SUPABASE_URL?.replace(/\/$/, ""),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`Stripe billing is not configured. Missing environment variables: ${missing.join(", ")}`);
  }

  return values as StripeConfig;
}

export function getStripePriceId(tier: BillingTier) {
  const config = getConfig();
  return tier === "core" ? config.corePriceId : config.proPriceId;
}

export function getTierFromPriceId(priceId: string | null | undefined): BillingTier | null {
  if (!priceId) return null;
  const config = getConfig();
  if (priceId === config.corePriceId) return "core";
  if (priceId === config.proPriceId) return "pro";
  return null;
}

function formEncode(entries: Array<[string, string]>) {
  const body = new URLSearchParams();
  for (const [key, value] of entries) body.append(key, value);
  return body.toString();
}

async function stripeRequest(path: string, body: string) {
  const { secretKey } = getConfig();
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || "Stripe request failed.";
    throw new Error(message);
  }

  return payload as Record<string, unknown>;
}

export async function createCheckoutSession({
  tier,
  userId,
  email,
}: {
  tier: BillingTier;
  userId: string;
  email?: string | null;
}) {
  const config = getConfig();
  const priceId = tier === "core" ? config.corePriceId : config.proPriceId;

  const entries: Array<[string, string]> = [
    ["mode", "subscription"],
    ["line_items[0][price]", priceId],
    ["line_items[0][quantity]", "1"],
    ["client_reference_id", userId],
    ["metadata[user_id]", userId],
    ["metadata[tier]", tier],
    ["subscription_data[metadata][user_id]", userId],
    ["subscription_data[metadata][tier]", tier],
    ["success_url", `${config.appUrl}/customer?billing=success`],
    ["cancel_url", `${config.appUrl}/?billing=cancelled#pricing`],
    ["submit_type", "subscribe"],
  ];

  if (email) entries.push(["customer_email", email]);

  const session = await stripeRequest("checkout/sessions", formEncode(entries));
  const url = typeof session.url === "string" ? session.url : null;
  if (!url) throw new Error("Stripe did not return a Checkout URL.");

  return { id: String(session.id || ""), url };
}

function safeCompareHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyStripeWebhookSignature(payload: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");

  const parts = signature.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) throw new Error("Invalid Stripe signature header.");

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) throw new Error("Invalid Stripe signature timestamp.");

  const toleranceSeconds = 5 * 60;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > toleranceSeconds) {
    throw new Error("Stripe webhook timestamp is outside the allowed tolerance.");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  if (!signatures.some((candidate) => safeCompareHex(candidate, expected))) {
    throw new Error("Invalid Stripe webhook signature.");
  }
}

type SubscriptionRecord = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  price_id: string | null;
  tier: BillingTier;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const config = getConfig();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Supabase billing storage failed (${response.status}): ${message.slice(0, 300)}`);
  }

  return response;
}

async function findExistingSubscription(stripeSubscriptionId: string | null, stripeCustomerId: string | null) {
  const filters: string[] = [];
  if (stripeSubscriptionId) filters.push(`stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}`);
  if (stripeCustomerId) filters.push(`stripe_customer_id=eq.${encodeURIComponent(stripeCustomerId)}`);
  if (!filters.length) return null;

  const response = await supabaseRequest(`stripe_subscriptions?select=user_id,stripe_subscription_id,stripe_customer_id,tier&or=(${filters.join(",")})&limit=1`);
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function upsertSubscription(record: SubscriptionRecord) {
  await supabaseRequest("stripe_subscriptions?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([record]),
  });
}

export async function getStoredSubscription(userId: string) {
  const response = await supabaseRequest(
    `stripe_subscriptions?select=user_id,stripe_customer_id,stripe_subscription_id,price_id,tier,status,current_period_end,cancel_at_period_end,updated_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function storeStripeSubscription(input: {
  userId?: string | null;
  customerId?: string | null;
  subscriptionId: string;
  priceId?: string | null;
  tier?: BillingTier | null;
  status: string;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
}) {
  let userId = input.userId || null;
  const existing = await findExistingSubscription(input.subscriptionId, input.customerId || null);
  if (!userId && existing?.user_id) userId = existing.user_id;
  if (!userId) throw new Error("Stripe subscription could not be associated with a ClearCFO user.");

  const tier = input.tier || getTierFromPriceId(input.priceId) || existing?.tier;
  if (tier !== "core" && tier !== "pro") throw new Error("Stripe subscription tier could not be determined.");

  await upsertSubscription({
    user_id: userId,
    stripe_customer_id: input.customerId || existing?.stripe_customer_id || null,
    stripe_subscription_id: input.subscriptionId,
    price_id: input.priceId || null,
    tier,
    status: input.status,
    current_period_end: input.currentPeriodEnd ? new Date(input.currentPeriodEnd * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(input.cancelAtPeriodEnd),
  });
}
