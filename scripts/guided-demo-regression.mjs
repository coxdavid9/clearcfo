import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEMO_FINANCIALS, DEMO_PERIODS, moneyChange,
  percentChange, grossMargin,
} from "../src/lib/demo-business.ts";

assert.deepEqual(DEMO_PERIODS, { prior: "August 2026", current: "September 2026" });
assert.equal(moneyChange("revenue"), 12000);
assert.equal(percentChange("revenue"), 10);
assert.equal(moneyChange("inventory"), 32000);
assert.equal(percentChange("inventory"), 40);
assert.equal(moneyChange("receivables"), 15000);
assert.equal(moneyChange("cash"), -16000);
assert.equal(grossMargin("prior"), 35);
assert.equal(grossMargin("current"), 30);
assert.equal(grossMargin("current") - grossMargin("prior"), -5);
assert.equal(DEMO_FINANCIALS.costOfGoodsSold.prior, 78000);
assert.equal(DEMO_FINANCIALS.costOfGoodsSold.current, 92400);
console.log("PASS: demo movements and gross margins reconcile to the illustrative data");

const page = fs.readFileSync("src/app/demo/page.tsx", "utf8");
const guide = fs.readFileSync("src/components/GuidedDemo.tsx", "utf8");
const proxy = fs.readFileSync("proxy.ts", "utf8");
assert(page.includes("GuidedDemo"), "Demo route must render the guided example.");
assert(page.includes("robots: { index: false, follow: false }"), "Demo should stay unindexed until promotion.");
assert(guide.includes("Fictional business data"), "Demo must explicitly identify fictional figures.");
assert(guide.includes("This is a scripted example"), "No claim of live generated financial analysis.");
assert(guide.includes('href="/contact"'), "Demo should direct visitors to a conversation, not unready self-service onboarding.");
assert(!guide.includes('href="/signup"'), "Demo must not drive signups before backup gate.");
assert(!guide.includes("supabase") && !guide.includes("/api/"), "Demo must never access customer financial data or APIs.");
assert(!proxy.includes('"/demo/:path*"'), "Demo should be publicly viewable without login.");
console.log("PASS: demo is public, self-contained, fictional and uses contact CTA only");
