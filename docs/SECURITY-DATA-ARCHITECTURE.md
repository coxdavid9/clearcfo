# ClearCFO Security & Data Architecture — MVP

## Current data flow

### Excel upload
1. The workbook is selected in the browser.
2. The browser parses the workbook locally with SheetJS.
3. ClearCFO's deterministic financial engine calculates KPIs, trends, drivers, evidence gaps, and recommendations in the browser.
4. Only the derived analysis payload needed for AI reasoning is sent to `/api/cfo-analysis`.
5. The server sends that derived payload to OpenAI with `store: false`.
6. The AI result is returned to the browser and is not persisted by ClearCFO.

The uploaded workbook itself is not intentionally persisted by the current application architecture.

## Data that is currently persisted

- Supabase authentication account data.
- Customer profile fields stored in Supabase user metadata.
- QuickBooks OAuth connections, with access and refresh tokens encrypted by ClearCFO before storage.

## Data that is not intended to be persisted by default

- Uploaded Excel workbooks.
- Raw workbook transaction detail.
- General ledger detail from uploaded workbooks.
- QuickBooks report payloads after the request completes.
- Bank transaction data.
- AI financial analysis history.

## Security controls currently implemented

- Authenticated customer routes and the AI analysis route.
- HTTP-only authentication cookies.
- `SameSite=Lax` authentication cookies.
- Production `Secure` cookies.
- Expired customer access sessions can refresh through the existing refresh-token flow.
- Refresh redirects are restricted to same-site relative paths.
- QuickBooks OAuth state is bound to the authenticated ClearCFO user and protected with an HMAC signature.
- AES-256-GCM encryption for QuickBooks OAuth tokens at rest.
- Supabase RLS enabled on the QuickBooks connection table with no browser-facing policy.
- OpenAI Responses API requests explicitly use `store: false`.
- AI request body limit of 250 KB.
- Customer profile request body limit of 16 KB.
- `Cache-Control: no-store` on customer profile and QuickBooks financial responses.
- Production security headers including HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` on protected routes.
- Automated full dependency audit and security regression checks in CI.

## Remaining security work

- Complete active penetration/security testing against the deployed application.
- Add robust distributed rate limiting for authentication and AI requests before public launch.
- Remove any remaining logging that could expose derived financial detail.
- Confirm Render/Supabase/OpenAI retention and logging settings against the final privacy policy.
- Complete a final third-party security/privacy review before onboarding paying customers.

## Product boundary

ClearCFO should be designed so that the minimum data necessary to produce a financial insight leaves the customer's device. Persistent storage should be added only when a product requirement clearly justifies it and the associated retention, access control, deletion, and privacy requirements are implemented at the same time.
