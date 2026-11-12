import assert from "node:assert/strict";
import fs from "node:fs";
import { publicDemoBriefing as data } from "../src/lib/briefing/public-demo-data.ts";

const previousRevenue = data.revenue / (1 + data.revenueChange / 100);
const previousMargin = data.grossMargin - data.marginChange;
const previousGrossProfit = previousRevenue * previousMargin / 100;
assert.ok(Math.abs(previousRevenue - 120000) < 0.001);
assert.ok(Math.abs(previousGrossProfit - 42000) < 0.001);
assert.equal(data.revenue, 132000);
assert.equal(data.grossProfit, 39600);
assert.ok(Math.abs((data.grossProfit / data.revenue * 100) - data.grossMargin) < 0.001);
assert.equal(data.cash - (data.previousCash ?? 0), -16000);
assert.equal(data.inventory - (data.previousInventory ?? 0), 32000);
assert.equal(data.inventoryChange, 40);
assert.equal(data.drivers.length, 3);
assert.equal(data.source, "demo");
assert.equal(data.companyName.includes("fictional"), true);
assert.equal(data.trendSeries.length, 4);

for (const [name, value] of [["Revenue", data.revenue], ["Gross Margin", data.grossMargin], ["Cash Position", data.cash], ["Inventory", data.inventory]]) {
  const series = data.trendSeries.find(s => s.name === name);
  assert.ok(series, `Missing real briefing KPI series: ${name}`);
  assert.equal(series.values.at(-1), value, `Latest KPI disagrees with its trend: ${name}`);
  assert.equal(series.periods.at(-1), "Sep 2026");
}
for (const key of ["revenue", "inventory"]) {
  const breakdown = data.kpiBreakdowns?.[key];
  assert.ok(breakdown, `Missing ${key} breakdown`);
  assert.equal(breakdown.rows.reduce((sum, row) => sum + row.current, 0), key === "revenue" ? 132000 : 112000);
  assert.equal(breakdown.rows.reduce((sum, row) => sum + row.previous, 0), key === "revenue" ? 120000 : 80000);
}
console.log("PASS: Sample briefing is internally consistent across KPIs, trends, and drill-downs");

const page = fs.readFileSync("src/app/demo/page.tsx", "utf8");
const component = fs.readFileSync("src/components/CFOBriefing.tsx", "utf8");
const realPage = fs.readFileSync("src/app/customer/briefing/page.tsx", "utf8");
const proxy = fs.readFileSync("proxy.ts", "utf8");
assert(realPage.includes('import CFOBriefing from "../../../components/CFOBriefing"'), "Real route must use CFOBriefing component.");
assert(page.includes('import CFOBriefing from "../../components/CFOBriefing"'), "Public demo must use the exact same CFOBriefing component.");
assert(page.includes("<CFOBriefing demoMode />"), "Public page must set read-only demo mode.");
assert(page.includes("fictional"), "Visitors must be told the data is fictional.");
assert(page.includes("robots: { index: false, follow: false }"), "Demo should be unindexed until promotion.");
assert(!page.includes("GuidedDemo"), "The invented marketing UI must not return.");
assert(!page.includes("sessionAware"), "Public demo navbar must not access customer session or company data.");
assert(!proxy.includes('"/demo/:path*"'), "Demo must be publicly accessible.");

assert(component.includes("demoMode ? publicDemoBriefing : demoData"), "Sample data must come from isolated demo fixture.");
assert(component.includes("if (demoMode) return; // The public demo must never call billing"), "Demo must bypass all billing API calls.");
assert(component.includes("if (demoMode) return; // The public demo must never load QuickBooks"), "Demo must bypass QuickBooks, onboarding and cache reads.");
assert(component.includes("!demoMode && billingLoading"), "Demo must never show a plan-loading state.");
assert(component.includes("!demoMode && billingLocked"), "Demo must never show a paywall.");
assert(component.includes('demoMode ? <span') && component.includes("<BusinessSwitcher />"), "Demo must replace live company switcher with a noninteractive label.");
assert(component.includes("!demoMode && <button") && component.includes("Upload Excel"), "Uploads must not be available in demo mode.");
assert(component.includes('!demoMode && <a href="/customer/analysis"'), "Demo must not open the authenticated AI page.");
console.log("PASS: Public preview reuses customer UI, while demo mode disables customer APIs and sensitive actions");

const hero = fs.readFileSync("src/components/Hero.tsx", "utf8");
const pricing = fs.readFileSync("src/components/Pricing.tsx", "utf8");
const sampleSource = fs.readFileSync("src/lib/briefing/public-demo-data.ts", "utf8");
const homepageSignupHref = pricing.match(/<a href="([^"]+)" className={`mt-4 rounded-xl py-3/);
assert(homepageSignupHref, "Could not identify homepage Get Started destination.");
assert.equal(homepageSignupHref[1], "/signup");
assert.equal((page.match(/href="\/signup"/g) || []).length, 2, "Top and bottom demo trial CTAs must point to Get Started destination.");
assert.equal((page.match(/<TrialLine button \/>/g) || []).length, 2, "Demo must contain exactly two trial CTAs.");
assert.equal((page.match(/<TrialLine \/>/g) || []).length, 2, "Card-required fine print must appear below both CTAs.");
assert(pricing.includes("{days}-day free trial · Credit card required"), "Fine print must match homepage pricing copy.");
assert(page.includes("This is a sample CFO Briefing built on fictional data. Connect QuickBooks or upload an Excel file, and ClearCFO generates this briefing from your real numbers automatically at every sync."), "Missing requested explanation under title.");
assert(hero.includes('href="/demo"') && hero.includes("See a sample briefing"), "Homepage hero must link to the actual sample briefing.");
assert(page.includes("Questions? Ask about ClearCFO") && page.includes('href="/contact"'), "Contact CTA must be secondary and near bottom trial CTA.");
const exactTakeaway = "Inventory increased $32,000 (40.0%) versus a $12,000 (10.0%) revenue increase. Cash fell $16,000, from $58,000 to $42,000, while receivables grew by $15,000. These movements do not establish causation.";
assert.equal(component.split(exactTakeaway).length - 1, 1, "The complete summary must appear exactly once, in the takeaway.");
assert(component.includes("{demoMode ? demoTakeaway : deterministicAnalysis}"), "Demo takeaway must retain original paragraph.");
assert(sampleSource.includes('observation: "Cash fell $16,000, from $58,000 to $42,000, while receivables grew by $15,000."'), "Attention card text must omit unsupported-causation line.");
assert(component.includes('demoMode ? "What ClearCFO would tell you" : "AI Analysis"'), "Demo heading must be updated without changing live UI.");
const exactDemoAnalysis = "Three signals point the same direction: sales grew, but the growth consumed cash instead of producing it. Inventory absorbed $32,000 and customers are holding another $15,000 in unpaid invoices, while gross margin slipped from 35% to 30% — so each new sales dollar is costing more to deliver. The decision this sets up: before ordering more stock, find out whether the inventory build is deliberate or drift, and tighten collections on the oldest receivables. Those two moves protect the cash balance without slowing sales.";
assert(component.includes(exactDemoAnalysis), "Demo analysis copy must match supplied text exactly.");
assert(component.includes("Illustrative analysis based on fictional data. With QuickBooks connected or an Excel file uploaded, ClearCFO generates this from your numbers automatically."), "Demo analysis disclaimer must match exact replacement.");
assert(!page.includes("Request a walkthrough") && !page.includes("Talk to ClearCFO about your business"), "Top contact CTA must be replaced with trial CTA, and contact demoted.");
console.log("PASS: Demo trial conversion CTAs, real-layout copy, and one-time takeaway.");
