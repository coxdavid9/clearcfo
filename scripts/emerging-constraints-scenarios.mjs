import { detectCashSqueeze } from "../src/lib/briefing/emerging-constraints.ts";
import {
  aging,
  buildBaseCashSqueezeInput,
  buildConcentratedCashSqueezeInput,
  buildMediumCashSqueezeInput,
  buildResolvedCashSqueezeInput,
  buildWorseningCashSqueezeInput,
} from "../src/lib/briefing/emerging-constraints-preview.ts";

let failed = 0;

const high = detectCashSqueeze(buildBaseCashSqueezeInput());
if (!high || high.status !== "emerging" || high.confidence !== "High" || high.dataCompleteness !== "complete") {
  failed++;
  console.error("FAIL: complete cash squeeze should be High/emerging/complete", high);
} else {
  console.log("PASS: complete cash squeeze -> High / emerging / complete");
}

const worsening = high ? detectCashSqueeze(buildWorseningCashSqueezeInput(high)) : null;
if (!worsening || worsening.status !== "worsening") {
  failed++;
  console.error("FAIL: stronger pattern should become worsening", worsening);
} else {
  console.log("PASS: stronger pattern -> worsening");
}

const medium = detectCashSqueeze(buildMediumCashSqueezeInput());
if (!medium || medium.confidence !== "Medium" || medium.dataCompleteness !== "partial") {
  failed++;
  console.error("FAIL: missing financing check should produce Medium/partial", medium);
} else {
  console.log("PASS: incomplete validation -> Medium / partial");
}

const resolved = high ? detectCashSqueeze(buildResolvedCashSqueezeInput(high)) : null;
if (!resolved || resolved.status !== "resolved") {
  failed++;
  console.error("FAIL: threshold exit should resolve prior constraint", resolved);
} else {
  console.log("PASS: threshold exit -> resolved");
}

const concentrated = detectCashSqueeze(buildConcentratedCashSqueezeInput());
if (concentrated) {
  failed++;
  console.error("FAIL: concentrated A/R deterioration should not fire", concentrated);
} else {
  console.log("PASS: concentrated A/R deterioration rejected");
}

if (failed) process.exit(1);
console.log("\n5/5 emerging-constraint scenarios passed.");
