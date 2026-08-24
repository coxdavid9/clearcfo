const scenarios = [
  {
    name: 'Healthy growth',
    metrics: { revenueChange: 8, marginChange: 1.5, cashChange: 6, inventoryChange: 7 },
    expect: ['no dominant exception'],
  },
  {
    name: 'Margin compression',
    metrics: { revenueChange: 4, marginChange: -4.2, cashChange: 1, inventoryChange: 2 },
    expect: ['margin compression'],
  },
  {
    name: 'Working capital pressure',
    metrics: { revenueChange: -2, marginChange: 0.2, cashChange: -9, inventoryChange: 11 },
    expect: ['cash decline', 'inventory outpacing revenue'],
  },
  {
    name: 'Expense pressure',
    metrics: { revenueChange: 2, marginChange: -1.5, cashChange: -1, inventoryChange: 1, operatingExpenseChange: 10 },
    expect: ['margin compression', 'operating expenses'],
  },
  {
    name: 'Revenue decline',
    metrics: { revenueChange: -10, marginChange: -0.2, cashChange: 2, inventoryChange: -4 },
    expect: ['no dominant exception'],
  },
  {
    name: 'Unusual spend',
    metrics: { revenueChange: 3, marginChange: 0.5, cashChange: -7, inventoryChange: 1, unusualExpense: 65000 },
    expect: ['cash decline', 'unusual'],
  },
  {
    name: 'MRO pressure',
    metrics: { revenueChange: 1, marginChange: -2, cashChange: -2, inventoryChange: 2, mroSpike: true },
    expect: ['margin compression', 'mro'],
  },
  {
    name: 'Multiple simultaneous pressures',
    metrics: { revenueChange: -4, marginChange: -3.5, cashChange: -12, inventoryChange: 9, operatingExpenseChange: 9, unusualExpense: 30000 },
    expect: ['cash decline', 'margin compression', 'inventory outpacing revenue'],
  },
];

function drivers(m) {
  const result = [];
  if (m.inventoryChange > m.revenueChange + 3 && m.inventoryChange > 0) result.push('inventory outpacing revenue');
  if (m.marginChange < -1) result.push('margin compression');
  if (m.cashChange < -5) result.push('cash decline');
  if (m.operatingExpenseChange > m.revenueChange + 3 && m.operatingExpenseChange > 5) result.push('operating expenses');
  if (m.mroSpike) result.push('mro');
  if (m.unusualExpense > 0) result.push('unusual');
  return result.length ? result : ['no dominant exception'];
}

let failed = 0;
for (const scenario of scenarios) {
  const actual = drivers(scenario.metrics);
  const missing = scenario.expect.filter((expected) => !actual.includes(expected));
  if (missing.length) {
    failed++;
    console.error(`FAIL: ${scenario.name} -> expected ${missing.join(', ')}; got ${actual.join(', ')}`);
  } else {
    console.log(`PASS: ${scenario.name} -> ${actual.join(', ')}`);
  }
}

if (failed) process.exit(1);
console.log(`\n${scenarios.length}/${scenarios.length} reasoning scenarios passed.`);
