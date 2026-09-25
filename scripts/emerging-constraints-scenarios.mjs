import { detectCashSqueeze } from "../src/lib/briefing/emerging-constraints.ts";
import {
  aging,
  buildBaseCashSqueezeInput,
  buildEasingCashSqueezeInput,
  buildStableCashSqueezeInput,
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

const stable = high ? detectCashSqueeze(buildStableCashSqueezeInput(high)) : null;
if (!stable || stable.status !== "stable" || stable.relationship === high?.relationship || stable.whyNow === high?.whyNow || stable.decisionWindow === high?.decisionWindow) {
  failed++;
  console.error("FAIL: stable lifecycle should use distinct persistence prose", stable);
} else {
  console.log("PASS: stable lifecycle -> persistence prose");
}

const easing = high ? detectCashSqueeze(buildEasingCashSqueezeInput(high)) : null;
if (!easing || easing.status !== "easing" || easing.relationship === high?.relationship || easing.whyNow === high?.whyNow || easing.decisionWindow === high?.decisionWindow || !/not resolved/i.test(easing.relationship)) {
  failed++;
  console.error("FAIL: easing lifecycle should use distinct improvement/not-resolved prose", easing);
} else {
  console.log("PASS: easing lifecycle -> improvement/not-resolved prose");
}

if (!worsening || !/accelerated from \+50\.0% to \+150\.0%/.test(worsening.relationship) || !/window to act is narrowing/i.test(worsening.decisionWindow)) {
  failed++;
  console.error("FAIL: worsening prose should name the acceleration and narrowing decision window", worsening);
} else {
  console.log("PASS: worsening lifecycle -> acceleration/narrowing prose");
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
console.log("\n8/8 emerging-constraint scenarios passed.");
