import assert from "node:assert/strict";
import fs from "node:fs";

const templates = fs.readFileSync(new URL("../src/lib/alerts/templates.ts", import.meta.url), "utf8");
const email = fs.readFileSync(new URL("../src/lib/email.ts", import.meta.url), "utf8");

assert.match(templates, /function footerText\(companyName: string\)/);
assert.match(templates, /Manage preferences: " \+ appUrl\(\) \+ "\/alerts"/);
assert.match(templates, /Please don't reply to this email/);
assert.match(templates, /footerHtml\(companyName\)/);
assert.match(templates, /footerText\(companyName\)/);
assert.match(templates, /export function buildAlertEmail/);
assert.match(templates, /export function buildWeeklyReportEmail/);

assert.match(email, /"List-Unsubscribe": "<" \+ preferencesUrl \+ ">"/);
assert.match(email, /"Reply-To": "support@theclearcfo\.com"/);
assert.match(email, /headers:/);

console.log("Email template footer and Resend header assertions passed.");
