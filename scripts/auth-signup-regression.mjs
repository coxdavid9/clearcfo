import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { signUpWithPassword, DUPLICATE_SIGNUP_ERROR } from "../src/lib/supabase-auth.ts";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-key";
process.env.NEXT_PUBLIC_SITE_URL = "https://theclearcfo.com";

const originalFetch = globalThis.fetch;

async function withSignupResponse(payload, status = 200) {
  globalThis.fetch = async () => new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  try {
    return await signUpWithPassword("existing@example.com", "Password1!", {
      companyName: "",
      industry: "Services",
      companySize: "1-10",
      contactName: "Test User",
      contactPhone: "",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const duplicate = await withSignupResponse({
  id: "obfuscated",
  email: "existing@example.com",
  identities: [],
  session: null,
});

assert.equal(duplicate.ok, false);
assert.equal(duplicate.code, "DUPLICATE_EMAIL");
assert.equal(duplicate.error, DUPLICATE_SIGNUP_ERROR);
console.log("PASS: confirmed duplicate email returns duplicate-signup result");

const newSignup = await withSignupResponse({
  id: "new-user",
  email: "new@example.com",
  identities: [{ id: "identity-1" }],
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600,
});

assert.equal(newSignup.ok, true);
assert.equal(newSignup.accessToken, "access-token");
assert.equal(newSignup.refreshToken, "refresh-token");
console.log("PASS: genuine new signup keeps success path");

const unconfirmed = await withSignupResponse({
  id: "unconfirmed-user",
  email: "existing@example.com",
  identities: [{ id: "identity-1" }],
  access_token: null,
  refresh_token: null,
});

assert.equal(unconfirmed.ok, true);
assert.equal(unconfirmed.accessToken, null);
assert.equal(unconfirmed.refreshToken, null);
console.log("PASS: unconfirmed existing account keeps confirmation path");

const emailCheckRoute = await readFile(new URL("../src/app/api/auth/check-email/route.ts", import.meta.url), "utf8");
const loginPage = await readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
const authSource = await readFile(new URL("../src/lib/supabase-auth.ts", import.meta.url), "utf8");
assert.match(authSource, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(emailCheckRoute, /checkRateLimit\(request, authRateLimit\)/);
assert.match(emailCheckRoute, /supabaseAuthUserExists\(email\)/);
console.log("PASS: step-1 email check route uses the server-side Supabase admin key and rate limit");
assert.match(loginPage, /\/api\/auth\/check-email/);
assert.match(loginPage, /An account with this email already exists\. Try logging in instead\./);
assert.match(loginPage, /setMode\("login"\)/);
assert.match(loginPage, /setEmail/);
console.log("PASS: signup step 1 checks email and offers login without advancing");
assert.doesNotMatch(loginPage, /signup-diagnostic/);
console.log("PASS: temporary signup diagnostic is removed");

const route = await readFile(new URL("../src/app/api/auth/signup/route.ts", import.meta.url), "utf8");
assert.match(route, /result\.code === "DUPLICATE_EMAIL" \? 409 : 400/);
assert.match(loginPage, /data\.error/);
console.log("PASS: signup route returns 409 and client surfaces API error copy");

assert.equal(DUPLICATE_SIGNUP_ERROR, "An account with this email already exists. Try logging in instead.");
console.log("PASS: duplicate signup message matches product copy exactly");

const { LEGAL_VERSION, legalAcceptance } = await import("../src/lib/legal.ts");
for (const acceptTerms of [undefined, false, "true", 1]) {
  assert.equal(legalAcceptance({ acceptTerms, legalVersion: LEGAL_VERSION }), null);
}
assert.equal(legalAcceptance({ acceptTerms: true, legalVersion: "old" }), null);
const accepted = legalAcceptance({ acceptTerms: true, legalVersion: LEGAL_VERSION, acceptedAt: "forged" });
assert.equal(accepted.termsVersion, LEGAL_VERSION);
assert.equal(accepted.privacyVersion, LEGAL_VERSION);
assert.ok(Number.isFinite(Date.parse(accepted.acceptedAt)));
assert.notEqual(accepted.acceptedAt, "forged");
let captured;
globalThis.fetch = async (_url, options) => {
  captured = JSON.parse(options.body);
  return new Response(JSON.stringify({ id: "new-user", identities: [{ id: "identity" }] }));
};
try { await signUpWithPassword("new@example.com", "Password1!", undefined, accepted); }
finally { globalThis.fetch = originalFetch; }
assert.deepEqual(captured.data.legalAcceptance, accepted);
assert.match(route, /legalAcceptance\(body\)/);
assert.match(loginPage, /type="checkbox" required checked=\{acceptTerms\}/);
console.log("PASS: explicit current-policy consent required; server timestamp and versions reach signup storage");
