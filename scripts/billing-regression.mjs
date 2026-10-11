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
  NextResponse: { json: (body, init) => Response.json(body, init), redirect: url => Response.redirect(url) },
  subscriptionPeriodEnd, invoiceUserId,
  mapStatus: status => ["trialing", "active", "past_due"].includes(status) ? status : "canceled",
  verifyStripeSignature: async () => signatureValid,
  stripeGet: async path => path.startsWith("checkout/sessions/") ? {
    customer: "cus_live", metadata: { supabase_user_id: "user1", plan: "pro", interval: "year" }, subscription,
  } : subscription,
  upsertSubscription: async row => { writes.push(row); },
  getSubscription: async () => current ?? (writes.length ? writes.at(-1) : null),
  sendTrialEmail: async (row, day) => emails.push({ row, day }),
};
globalThis.__billingRegression = doubles;
async function route(file) {
  const source = (await readFile(new URL(file, import.meta.url), "utf8")).replace(/import[^;]+;/g, "");
  const injected = `const {${Object.keys(doubles).join(",")}} = globalThis.__billingRegression;\n` + source;
  const js = ts.transpileModule(injected, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}
const webhook = await route("../src/app/api/billing/webhook/route.ts");
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
delete globalThis.__billingRegression;
console.log("PASS: legacy and modern periods, invoice owners, checkout return, five webhook events, comp preservation, invalid signatures");
