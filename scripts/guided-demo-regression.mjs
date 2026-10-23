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
assert(component.includes('demoMode ? <a href="/contact"'), "Demo must not open the authenticated AI page.");
console.log("PASS: Public preview reuses customer UI, while demo mode disables customer APIs and sensitive actions");
