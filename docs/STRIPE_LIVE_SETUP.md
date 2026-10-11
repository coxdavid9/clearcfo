# ClearCFO live payment cutover

Keep production in its current billing mode until the policy pages and signup change have been deployed and the live Stripe configuration is ready.

1. Complete Stripe account activation and payout-bank verification in the ClearCFO account. Do not share credentials or bank details in chat.
2. In live mode create Core and Pro recurring USD prices: Core $39/month and $390/year; Pro $79/month and $790/year. Test prices and customers do not become live objects when the API key changes.
3. Set Stripe business support contact, Terms URL `https://theclearcfo.com/terms`, and Privacy URL `https://theclearcfo.com/privacy`. Checkout now requires terms acceptance, so its Terms URL must be configured before deployment.
4. Enable the default live Customer Portal with payment-method updates and cancellation at period end. Add the same legal URLs. Check the app's Manage billing flow.
5. Create a live webhook endpoint at `https://theclearcfo.com/api/billing/webhook`. Subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed`. Use Snapshot payloads and API version `2026-08-26.dahlia`, matching the pinned request version. The parser supports item-level billing periods and parent subscription metadata, with legacy fallback. Check both against a delivered event.
6. Set the web service environment variables together: `STRIPE_SECRET_KEY` (live secret), `STRIPE_WEBHOOK_SECRET` (the live endpoint secret), `STRIPE_CORE_MONTHLY_PRICE_ID`, `STRIPE_CORE_ANNUAL_PRICE_ID`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`. Keep secrets out of GitHub and chat. Preserve `NEXT_PUBLIC_SITE_URL=https://theclearcfo.com`.
7. Run `node scripts/verify-stripe-live.mjs` with the configured environment. It only reads Stripe configuration. It cannot verify account activation, bank payouts, the actual signing-secret match or delivery.
8. Inspect existing subscription rows before cutover. Existing test subscriptions can block checkout or grant access after switching keys. Reconcile only identified disposable test rows; preserve comp accounts and real subscriptions. Never bulk-delete subscriptions.
9. Verify signup, policy links, all four checkout prices, clear 7-day automatic billing disclosure, signed webhook delivery, access after checkout, email confirmation/trial email and cancellation through Manage billing. The user completes any real card transaction; do not charge a customer just to test.

## Policy decisions and acceptance record

The proposed policies replace attorney placeholders with complete language and describe actual code behavior. They have not been attorney approved. No mandatory arbitration or invented aggregate liability cap was added. The Terms retain statutory-rights exceptions and general exclusions from the earlier draft.

New signup acceptance stores the server-generated timestamp and both policy versions in Supabase Auth user metadata. This is a basic signup record, not an immutable audit log: Supabase user metadata can be edited by the user through its Auth API. It must never be used as an authorization claim. An append-only, server-controlled acceptance table is a follow-up for stronger evidence; existing accounts have not been retroactively marked as accepting this version.

No raw workbook or zero-retention guarantee is made. Derived financial records, provider processing and browser caches are disclosed. Keep the versioned Markdown files alongside the code for a record of the published wording.
