// ClearCFO alert engine scenario tests — Step 4.
// Runs the real engine (src/lib/alerts/engine.ts) against fixed scenarios.
// Node 24 strips types natively, so the TypeScript engine imports directly.

import { evaluateAlerts } from "../src/lib/alerts/engine.ts";

const HEALTHY = {
  revenue: 120000,
  revenueChange: 6,
  grossMargin: 42,
  marginChange: 0.8,
  cash: 85000,
  cashChange: 4,
  inventory: 30000,
  inventoryChange: 5,
  operatingExpense: 40000,
  previousOperatingExpense: 39000,
  drivers: [],
};

const scenarios = [
  {
    name: "Custom cash threshold fires when breached",
    snapshot: { ...HEALTHY, cash: 8200 },
    rules: [{ id: "r1", metric: "cash", operator: "below", value: 10000, severity: "high", enabled: true }],
    expectCount: 1,
    expectTitle: "Cash fell below $10,000",
  },
  {
    name: "Custom cash threshold silent when healthy",
    snapshot: { ...HEALTHY },
    rules: [{ id: "r1", metric: "cash", operator: "below", value: 10000, severity: "high", enabled: true }],
    expectCount: 0,
  },
  {
    name: "Disabled custom rule never fires",
    snapshot: { ...HEALTHY, cash: 8200 },
    rules: [{ id: "r1", metric: "cash", operator: "below", value: 10000, severity: "high", enabled: false }],
    expectCount: 0,
  },
  {
    name: "Margin drop of 4 points is high severity",
    snapshot: { ...HEALTHY, marginChange: -4, grossMargin: 38 },
    rules: [],
    expectCount: 1,
    expectSeverity: "high",
    expectTitle: "Gross margin dropped 4.0 pts",
  },
  {
    name: "Margin dip of 1 point does not alert",
    snapshot: { ...HEALTHY, marginChange: -1, grossMargin: 41 },
    rules: [],
    expectCount: 0,
  },
  {
    name: "Spending outpacing revenue by 12 points alerts",
    snapshot: { ...HEALTHY, revenueChange: 2, operatingExpense: 43680, previousOperatingExpense: 39000 },
    rules: [],
    expectCount: 1,
    expectTitle: "Spending is outpacing revenue",
  },
  {
    name: "Revenue decline of 12 percent is high severity",
    snapshot: { ...HEALTHY, revenueChange: -12, inventoryChange: -12, operatingExpense: 40000, previousOperatingExpense: 42000 },
    rules: [],
    expectCount: 1,
    expectSeverity: "high",
  },
  {
    name: "Inventory outpacing revenue by 20 points alerts",
    snapshot: { ...HEALTHY, revenueChange: 2, inventoryChange: 22 },
    rules: [],
    expectCount: 1,
    expectTitle: "Inventory is outpacing revenue",
  },
  {
    name: "Healthy company produces zero alerts",
    snapshot: { ...HEALTHY },
    rules: [],
    expectCount: 0,
  },
  {
    name: "Worst alert sorts first",
    snapshot: { ...HEALTHY, marginChange: -4, grossMargin: 38, cashChange: -12 },
    rules: [],
    expectCount: 2,
    expectFirstSeverity: "high",
  },
  {
    name: "Immaterial moves stay silent",
    snapshot: { ...HEALTHY, revenue: 1000, revenueChange: -12, inventory: 200, inventoryChange: -12, operatingExpense: 400, previousOperatingExpense: 420, cash: 5000, cashChange: 0 },
    rules: [],
    expectCount: 0,
  },
  {
    name: "Top high-severity driver surfaces",
    snapshot: {
      ...HEALTHY,
      drivers: [{ id: "d1", title: "Freight costs surging", severity: "High", impact: 5200, observation: "Freight up 38% vs prior period." }],
    },
    rules: [],
    expectCount: 1,
    expectTitle: "Cost driver: Freight costs surging",
  },
];

let failures = 0;
for (const scenario of scenarios) {
  const alerts = evaluateAlerts(scenario.snapshot, scenario.rules || []);
  const problems = [];
  if (alerts.length !== scenario.expectCount) {
    problems.push(`expected ${scenario.expectCount} alert(s), got ${alerts.length}`);
  }
  if (scenario.expectTitle && alerts[0]?.title !== scenario.expectTitle) {
    problems.push(`expected title "${scenario.expectTitle}", got "${alerts[0]?.title}"`);
  }
  if (scenario.expectSeverity && alerts[0]?.severity !== scenario.expectSeverity) {
    problems.push(`expected severity "${scenario.expectSeverity}", got "${alerts[0]?.severity}"`);
  }
  if (scenario.expectFirstSeverity && alerts[0]?.severity !== scenario.expectFirstSeverity) {
    problems.push(`expected first severity "${scenario.expectFirstSeverity}", got "${alerts[0]?.severity}"`);
  }
  if (problems.length) {
    failures += 1;
    console.error(`FAIL: ${scenario.name}\n  - ${problems.join("\n  - ")}`);
  } else {
    console.log(`PASS: ${scenario.name}`);
  }
}

if (failures) {
  console.error(`\n${failures} scenario(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${scenarios.length} alert scenarios passed.`);
