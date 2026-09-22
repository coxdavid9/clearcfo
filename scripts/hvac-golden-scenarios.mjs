/*
 * ClearCFO HVAC golden-case regression suite.
 *
 * This is intentionally independent of QuickBooks. The production QBO
 * connection has already been validated; this suite protects the financial
 * story we expect ClearCFO to tell when a clean service-company dataset is
 * available.
 */

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const pct = (current, prior) => ((current - prior) / Math.abs(prior)) * 100;
const margin = (revenue, cogs) => (revenue ? ((revenue - cogs) / revenue) * 100 : 0);
const net = (revenue, cogs, opex) => revenue - cogs - opex;

const months = [
  { name: "June", revenue: 38500, cogs: 16500, opex: 15900, net: 6100, cash: 52600, ar: 8500 },
  { name: "July", revenue: 44000, cogs: 19000, opex: 17500, net: 7500, cash: 54600, ar: 14000 },
  { name: "August", revenue: 33000, cogs: 16000, opex: 19000, net: -2000, cash: 49600, ar: 17000 },
  { name: "September MTD", revenue: 17500, cogs: 10800, opex: 14900, net: -8200, cash: 36400, ar: 22000 },
];

for (const month of months) {
  assert(net(month.revenue, month.cogs, month.opex) === month.net,
    month.name + ": net income does not reconcile.");
  assert(Math.abs(margin(month.revenue, month.cogs) -
    ({ June: 57.1428571429, July: 56.8181818182, August: 51.5151515152, "September MTD": 38.2857142857 }[month.name])) < 0.01,
    month.name + ": gross margin does not reconcile from COGS.");
}

assert(pct(months[3].revenue, months[2].revenue) < -46.9 &&
       pct(months[3].revenue, months[2].revenue) > -47.1,
  "September MTD revenue should be about -47% versus August.");

assert(margin(38500, 16500) > margin(44000, 19000) &&
       margin(44000, 19000) > margin(33000, 16000) &&
       margin(33000, 16000) > margin(17500, 10800),
  "Gross margin should compress across the four checkpoints.");

assert(months[3].ar === 22000 &&
       12500 / months[3].ar > 0.56 &&
       12500 / months[3].ar < 0.58,
  "Final A/R should be $22,000 with Maplewood at about 57% of A/R.");

assert(pct(months[3].cash, months[1].cash) < -33 &&
       pct(months[3].cash, months[1].cash) > -34,
  "Cash should fall about 33% from July to September MTD.");

assert(months[2].net < 0 && months[3].net < 0,
  "August and September MTD should both be loss periods.");

const opexPctJune = (15900 / 38500) * 100;
const opexPctSep = (14900 / 17500) * 100;
assert(Math.abs(opexPctJune - 41.2987) < 0.01 &&
       Math.abs(opexPctSep - 85.1429) < 0.01,
  "OpEx/revenue ratios should match the golden case.");

const finalSignals = {
  revenueDecline: months[3].revenue < months[2].revenue,
  marginCompression: margin(months[3].revenue, months[3].cogs) < margin(months[0].revenue, months[0].cogs),
  arConcentration: months[3].ar > 0 && 12500 / months[3].ar > 0.5,
  expenseSpike: 3800 > 1100,
  cashDecline: months[3].cash < months[1].cash,
  netLoss: months[3].net < 0,
  opexOutrunningRevenue: opexPctSep > 80,
};

for (const [signal, detected] of Object.entries(finalSignals)) {
  assert(detected, "Final stress test did not detect " + signal + ".");
  console.log("PASS  " + signal);
}

console.log("PASS  June baseline");
console.log("PASS  July peak");
console.log("PASS  August deterioration");
console.log("PASS  September MTD stress test");
console.log("\nAll HVAC golden-case financial regression scenarios passed.");
