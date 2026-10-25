import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { subscriptionPeriodEnd, invoiceUserId } from "../src/lib/billing/stripe-payload.ts";

const end = 1800000000;
const iso = new Date(end * 1000).toISOString();
assert.equal(subscriptionPeriodEnd({ current_period_end: end }), iso);
assert.equal(subscriptionPeriodEnd({ items: { data: [{ current_period_end: end }] } }), iso);
assert.equal(subscriptionPeriodEnd({ items: { data: [] } }), null);
assert.throws(() => subscriptionPeriodEnd({ items: { data: [{ current_period_end: end }, { current_period_end: end + 1 }] } }));
assert.throws(() => subscriptionPeriodEnd({ items: { data: [], has_more: true } }));
assert.throws(() => subscriptionPeriodEnd({ current_period_end: NaN }));
assert.equal(invoiceUserId({ parent: { type: "subscription_details", subscription_details: { metadata: { supabase_user_id: "new" } } } }), "new");
assert.equal(invoiceUserId({ subscription_details: { metadata: { supabase_user_id: "old" } } }), "old");
assert.equal(invoiceUserId({ parent: { type: "quote_details", subscription_details: { metadata: { supabase_user_id: "wrong" } } } }), undefined);

// Execute the actual route bodies with external services replaced by in-memory doubles.
let writes = [], emails = [], current = null, signatureValid = true, subscription;
const doubles = {
  requireBillingUser: async () => "user1",
  STRIPE_API_VERSION: "2026-08-26.dahlia",
  NextResponse: { json: (body, init) => Response.json(body, init), redirect: url => Response.redirect(url) },
  subscriptionPeriodEnd, invoiceUserId,
  mapStatus: status => ["trialing", "active", "past_due"].includes(status) ? status : "canceled",
  verifyStripeSignature: async () => signatureValid,
  stripeGet: async path => path.startsWith("checkout/sessions/") ? {
    customer: "cus_live", metadata: { supabase_user_id: "user1", plan: "pro", interval: "year" }, subscription,
  } : subscription,
  upsertSubscription: async row => { writes.push(row); },
  updateSubscriptionStatus: async (user_id, status, stripe_subscription_id) => { writes.push({user_id, status, stripe_subscription_id}); },
  getSubscription: async () => current ?? (writes.length ? writes.at(-1) : null),
  sendTrialEmail: async (row, day) => emails.push({ row, day }),
};
globalThis.__billingRegression = doubles;
let loadId = 0;
async function route(file, dependencies = doubles) {
  const source = (await readFile(new URL(file, import.meta.url), "utf8")).replace(/import[^;]+;/g, "");
  const key = "__billingLoad" + loadId++;
  globalThis[key] = dependencies;
  const injected = `const {${Object.keys(dependencies).join(",")}} = globalThis[${JSON.stringify(key)}];\n` + source;
  const js = ts.transpileModule(injected, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  try { return await import("data:text/javascript;base64," + Buffer.from(js).toString("base64")); }
  finally { delete globalThis[key]; }
}
let webhook = await route("../src/app/api/billing/webhook/route.ts");
const returned = await route("../src/app/api/billing/return/route.ts");
async function deliver(type, object) {
  writes = []; emails = [];
  return webhook.POST(new Request("https://theclearcfo.com/api/billing/webhook", {
    method: "POST", body: JSON.stringify({ type, data: { object } }),
  }));
}
const modern = { id: "sub_live", customer: "cus_live", metadata: { supabase_user_id: "user1", plan: "pro", interval: "year" }, status: "active", items: { data: [{ current_period_end: end }] }, cancel_at_period_end: true };
for (const type of ["customer.subscription.created", "customer.subscription.updated"]) {
  assert.equal((await deliver(type, modern)).status, 200);
  assert.equal(writes[0].current_period_end, iso);
  assert.equal(writes[0].cancel_at_period_end, true);
  assert.equal(writes[0].plan, "pro");
}
subscription = { ...modern, status: "trialing", trial_end: end };
await deliver("checkout.session.completed", { subscription: "sub_live", customer: "cus_live", metadata: modern.metadata });
assert.equal(writes[0].current_period_end, iso);
assert.equal(writes[0].trial_ends_at, iso);
assert.equal(emails[0].day, 0);
writes = [];
const response = await returned.GET(new Request("https://theclearcfo.com/api/billing/return?session_id=cs_live"));
assert.equal(response.status, 302);
assert.equal(writes[0].current_period_end, iso);
for (const invoice of [
  { parent: { type: "subscription_details", subscription_details: { metadata: modern.metadata } } },
  { subscription_details: { metadata: modern.metadata } },
]) {
  await deliver("invoice.payment_failed", invoice);
  assert.equal(writes[0].user_id, "user1");
  assert.equal(writes[0].status, "past_due");
}
current = { is_comp: true };
for (const type of ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"]) {
  await deliver(type, { ...modern, parent: { type: "subscription_details", subscription_details: { metadata: modern.metadata } } });
  assert.equal(writes.length, 0);
}
current = null;
await deliver("customer.subscription.deleted", modern);
assert.equal(writes[0].status, "canceled");
signatureValid = false;
assert.equal((await deliver("customer.subscription.updated", modern)).status, 400);
assert.equal(writes.length, 0);
console.log("PASS: legacy and modern periods, invoice owners, checkout return, five webhook events, comp preservation, invalid signatures");

const portal = await route("../src/app/api/billing/portal/route.ts");
current = null; writes = [];
const noCustomer = await portal.POST();
assert.equal(noCustomer.status, 400);
assert.equal((await noCustomer.json()).code, "BILLING_NOT_CONNECTED");
console.log("PASS: accounts without Stripe customers receive actionable billing response");

// Exercise the real persistence helper through the webhook. A partial POST
// fails required-column validation; PATCH preserves the rest of the row.
const stripePersistence = await route("../src/lib/billing/stripe.ts", { STRIPE_API_VERSION: doubles.STRIPE_API_VERSION });
const originalFetch = globalThis.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalUpdate = doubles.updateSubscriptionStatus;
let requests = [], databaseFails = false;
let stored = { user_id: "user1", stripe_subscription_id: "sub_live", plan: "pro", interval: "year", status: "active", is_comp: false, trial_email_day0_sent_at: "already-sent" };
try {
  process.env.SUPABASE_URL = "https://database.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "regression-only";
  globalThis.fetch = async (input, init) => {
    const url = new URL(input), body = JSON.parse(init.body);
    requests.push({ url, init, body });
    if (databaseFails) return Response.json({ code: "XX000" }, { status: 500 });
    if (init.method === "POST" && (!body.plan || !body.interval)) return Response.json({ code: "23502" }, { status: 400 });
    assert.equal(init.method, "PATCH");
    assert.equal(url.searchParams.get("user_id"), "eq.user1");
    assert.equal(url.searchParams.get("is_comp"), "eq.false");
    assert.deepEqual(Object.keys(body).sort(), ["status", "updated_at"]);
    assert.ok(Number.isFinite(Date.parse(body.updated_at)));
    if (stored && !stored.is_comp && (!url.searchParams.has("stripe_subscription_id") || url.searchParams.get("stripe_subscription_id") === "eq." + stored.stripe_subscription_id)) stored = { ...stored, ...body };
    return new Response(null, { status: 204 });
  };
  doubles.updateSubscriptionStatus = stripePersistence.updateSubscriptionStatus;
  webhook = await route("../src/app/api/billing/webhook/route.ts");
  signatureValid = true;
  current = null;
  // Repeat delivery succeeds without inserting or erasing plan/email fields.
  for (let i = 0; i < 2; i++) {
    assert.equal((await deliver("customer.subscription.deleted", modern)).status, 200);
    assert.equal(stored.status, "canceled");
    assert.equal(stored.plan, "pro");
    assert.equal(stored.interval, "year");
    assert.equal(stored.trial_email_day0_sent_at, "already-sent");
  }
  assert.equal(requests.length, 2);
  assert.equal(writes.length, 0, "status event must not call upsert");
  assert.equal((await deliver("invoice.payment_failed", { parent: { type: "subscription_details", subscription_details: { metadata: modern.metadata } } })).status, 200);
  assert.equal(stored.status, "past_due");
  assert.equal(stored.plan, "pro");
  assert.equal(writes.length, 0);
  stored.stripe_subscription_id = "sub_replacement";
  await deliver("customer.subscription.deleted", modern);
  assert.equal(stored.status, "past_due", "old cancellation cannot cancel replacement");
  stored.is_comp = true;
  await stripePersistence.updateSubscriptionStatus("user1", "canceled");
  assert.equal(stored.status, "past_due", "atomic filter protects comp account");
  stored = null;
  assert.equal((await deliver("customer.subscription.deleted", modern)).status, 200);
  assert.equal(stored, null, "removed account must not be recreated");
  databaseFails = true;
  const originalError = console.error;
  try {
    console.error = () => {};
    assert.equal((await deliver("customer.subscription.deleted", modern)).status, 500, "database failures must remain retryable");
    assert.equal((await deliver("invoice.payment_failed", { subscription_details: { metadata: modern.metadata } })).status, 500);
  } finally { console.error = originalError; }
  await assert.rejects(stripePersistence.updateSubscriptionStatus("", "canceled"));
  console.log("PASS: real status persistence, duplicate delivery, required field preservation, removed/replacement/comp protection, retryable database errors");
} finally {
  globalThis.fetch = originalFetch;
  doubles.updateSubscriptionStatus = originalUpdate;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
}

delete globalThis.__billingRegression;
