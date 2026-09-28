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
  user: { id: "obfuscated", identities: [] },
  session: null,
});

assert.equal(duplicate.ok, false);
assert.equal(duplicate.code, "DUPLICATE_EMAIL");
assert.equal(duplicate.error, DUPLICATE_SIGNUP_ERROR);
console.log("PASS: confirmed duplicate email returns duplicate-signup result");

const newSignup = await withSignupResponse({
  user: { id: "new-user", identities: [{ id: "identity-1" }] },
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600,
});

assert.equal(newSignup.ok, true);
assert.equal(newSignup.accessToken, "access-token");
assert.equal(newSignup.refreshToken, "refresh-token");
console.log("PASS: genuine new signup keeps success path");

const unconfirmed = await withSignupResponse({
  user: { id: "unconfirmed-user", identities: [{ id: "identity-1" }] },
  access_token: null,
  refresh_token: null,
});

assert.equal(unconfirmed.ok, true);
assert.equal(unconfirmed.accessToken, undefined);
assert.equal(unconfirmed.refreshToken, undefined);
console.log("PASS: unconfirmed existing account keeps confirmation path");

const route = await readFile(new URL("../src/app/api/auth/signup/route.ts", import.meta.url), "utf8");
assert.match(route, /result\.code === "DUPLICATE_EMAIL" \? 409 : 400/);
assert.match(route, /data\.error/);
console.log("PASS: signup route returns 409 and client surfaces API error copy");

assert.equal(DUPLICATE_SIGNUP_ERROR, "An account with this email already exists. Try logging in instead.");
console.log("PASS: duplicate signup message matches product copy exactly");
