import { detectCashSqueeze, detectMarginErosion } from "../src/lib/briefing/emerging-constraints.ts";
import {
  aging,
  buildBaseCashSqueezeInput,
  buildEasingCashSqueezeInput,
  buildStableCashSqueezeInput,
  buildConcentratedCashSqueezeInput,
  buildMediumCashSqueezeInput,
  buildResolvedCashSqueezeInput,
  buildWorseningCashSqueezeInput,
  buildBaseMarginErosionInput,
  buildEasingMarginErosionInput,
  buildMediumMarginErosionInput,
  buildOneTimeCogsMarginErosionInput,
  buildRevenueDownMarginErosionInput,
  buildStableMarginErosionInput,
  buildWorseningMarginErosionInput,
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

const margin = detectMarginErosion(buildBaseMarginErosionInput());
if (!margin || margin.id !== "margin_erosion" || margin.status !== "emerging" || margin.confidence !== "High" || margin.dataCompleteness !== "complete") {
  failed++;
  console.error("FAIL: complete margin erosion should be High/emerging/complete", margin);
} else {
  console.log("PASS: complete margin erosion -> High / emerging / complete");
}

const marginWorsening = margin ? detectMarginErosion(buildWorseningMarginErosionInput(margin)) : null;
if (!marginWorsening || marginWorsening.status !== "worsening" || !/accelerated/i.test(marginWorsening.relationship) || !/window to act is narrowing/i.test(marginWorsening.decisionWindow)) {
  failed++;
  console.error("FAIL: worsening margin erosion should use accelerated/narrowing prose", marginWorsening);
} else {
  console.log("PASS: margin erosion worsening -> status-aware prose");
}

const marginStable = margin ? detectMarginErosion(buildStableMarginErosionInput(margin)) : null;
if (!marginStable || marginStable.status !== "stable" || marginStable.relationship === margin?.relationship || !/persisting across briefings/i.test(marginStable.relationship)) {
  failed++;
  console.error("FAIL: stable margin erosion should use persistence prose", marginStable);
} else {
  console.log("PASS: margin erosion stable -> persistence prose");
}

const marginEasing = margin ? detectMarginErosion(buildEasingMarginErosionInput(margin)) : null;
if (!marginEasing || marginEasing.status !== "easing" || marginEasing.relationship === margin?.relationship || !/not resolved/i.test(marginEasing.relationship)) {
  failed++;
  console.error("FAIL: easing margin erosion should use improvement/not-resolved prose", marginEasing);
} else {
  console.log("PASS: margin erosion easing -> improvement/not-resolved prose");
}

const marginMedium = detectMarginErosion(buildMediumMarginErosionInput());
if (!marginMedium || marginMedium.confidence !== "Medium" || marginMedium.dataCompleteness !== "partial" || !marginMedium.evidenceChecked.some((item) => /could not determine which cost lines/i.test(item)) || !marginMedium.evidenceChecked.some((item) => /one-time or recurring/i.test(item))) {
  failed++;
  console.error("FAIL: missing COGS detail should produce Medium honesty output", marginMedium);
} else {
  console.log("PASS: missing COGS detail -> Medium honesty output");
}

const oneTime = detectMarginErosion(buildOneTimeCogsMarginErosionInput());
if (oneTime) {
  failed++;
  console.error("FAIL: one-time COGS item explaining the decline should suppress the pattern", oneTime);
} else {
  console.log("PASS: one-time COGS decline -> no margin-erosion pattern");
}

const revenueDown = detectMarginErosion(buildRevenueDownMarginErosionInput());
if (revenueDown) {
  failed++;
  console.error("FAIL: revenue-down case should suppress margin erosion", revenueDown);
} else {
  console.log("PASS: revenue decline -> margin-erosion suppression");
}

if (failed) process.exit(1);
console.log("\n15/15 emerging-constraint scenarios passed.");
