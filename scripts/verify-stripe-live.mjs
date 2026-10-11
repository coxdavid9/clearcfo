// Read-only readiness check. Never prints credentials or customer/payment data.
import assert from 'node:assert/strict';
const key = process.env.STRIPE_SECRET_KEY?.trim();
assert.ok(key && /^(sk|rk)_live_/.test(key), 'STRIPE_SECRET_KEY must be a live-mode key.');
assert.ok(process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'), 'Configure the live endpoint signing secret.');
const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://theclearcfo.com').replace(/\/$/, '');
async function get(path) {
  const response = await fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: 'Bearer ' + key } });
  assert.ok(response.ok, 'Stripe readiness request failed: ' + response.status);
  return response.json();
}
for (const [name, amount, interval] of [
  ['STRIPE_CORE_MONTHLY_PRICE_ID', 3900, 'month'], ['STRIPE_CORE_ANNUAL_PRICE_ID', 39000, 'year'],
  ['STRIPE_PRO_MONTHLY_PRICE_ID', 7900, 'month'], ['STRIPE_PRO_ANNUAL_PRICE_ID', 79000, 'year'],
]) {
  const id = process.env[name];
  assert.ok(id?.startsWith('price_'), name + ' is missing.');
  const p = await get('prices/' + encodeURIComponent(id));
  assert.ok(p.livemode && p.active && p.currency === 'usd' && p.unit_amount === amount && p.recurring?.interval === interval && p.recurring?.interval_count === 1, name + ' does not match the published plan.');
  console.log('PASS: ' + name);
}
const required = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_failed'];
const endpoints = await get('webhook_endpoints?limit=100');
const endpoint = endpoints.data.find(e => e.url === site + '/api/billing/webhook' && e.status === 'enabled' && e.livemode && required.every(t => e.enabled_events.includes('*') || e.enabled_events.includes(t)));
assert.ok(endpoint, 'Live webhook endpoint or required events missing.');
console.log('PASS: enabled live webhook and events (signing-secret match still requires a delivered event)');
const configs = await get('billing_portal/configurations?limit=100');
assert.ok(configs.data.some(c => c.is_default && c.active && c.livemode && c.features?.subscription_cancel?.enabled && c.features?.payment_method_update?.enabled), 'Default live billing portal must allow cancellation and payment-method updates.');
console.log('PASS: live billing portal');
console.log('NEXT: verify a delivered signed webhook, then complete checkout and cancel a subscription. This script makes no charges.');
