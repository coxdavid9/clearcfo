import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveVerifiedAnalysisCompanyId as verified } from "../src/lib/analysis-company-authz.ts";

const accountA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const accountB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// A customer can use only their server-verified active company.
assert.equal(verified(accountA, accountA), accountA);
assert.equal(verified(accountB, accountB), accountB);
assert.equal(verified(accountA, " " + accountA + " "), accountA);
assert.equal(verified(accountA, accountB), null);
assert.equal(verified(accountB, accountA), null);
console.log("PASS: two different customers cannot submit another company's ID");

// Maintain backward compatibility for older clients with no companyId field.
assert.equal(verified(accountA, undefined), accountA);
assert.equal(verified(accountA, null), accountA);
assert.equal(verified(accountA, ""), accountA);
assert.equal(verified(null, accountA), null);
assert.equal(verified(undefined, undefined), null);
for (const invalid of ["  ", "not-a-company", 17, [], {}, false]) {
  assert.equal(verified(accountA, invalid), null);
}
console.log("PASS: missing company uses authenticated active company; invalid requests fail closed");

// Check that the real API route validates ownership before incurring the AI call,
// and uses the verified ID rather than a request-body field in the tracking write.
const route = fs.readFileSync("src/app/api/cfo-analysis/route.ts", "utf8");
const validation = route.indexOf("const verifiedCompanyId = resolveVerifiedAnalysisCompanyId(activeCompany?.id, bodyObject.companyId)");
const modelRequest = route.indexOf("const response = await fetch(", route.indexOf("export async function POST("));
assert(validation > -1 && modelRequest > validation, "AI route must verify the company before its provider call.");
assert(route.includes("await recordExcelBriefing(userId, verifiedCompanyId);"), "Tracking must use verified company ID.");
assert(!route.includes("await recordExcelBriefing(userId, companyId);"), "Untrusted companyId cannot be recorded.");
console.log("PASS: AI route checks business context before provider call and records verified company ID");
