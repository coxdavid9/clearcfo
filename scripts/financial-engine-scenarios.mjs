/*
 * ClearCFO deterministic financial-engine regression tests.
 *
 * These scenarios mirror the production decision thresholds in
 * CFOBriefing.tsx. They are intentionally synthetic so they can be
 * rerun without exposing customer financial data.
 */

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const pctChange = (current, prior) => {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
};

const classify = ({ revenueChange, marginChange, cashChange, inventoryChange, operatingExpenseChange }) => ({
  inventory: inventoryChange > revenueChange + 3 && inventoryChange > 0,
  margin: marginChange < -1,
  cash: cashChange < -5,
  opex: operatingExpenseChange > revenueChange + 3 && operatingExpenseChange > 5,
});

const run = (name, input, expected) => {
  const result = classify(input);
  for (const [key, value] of Object.entries(expected)) {
    assert(result[key] === value, `${name}: expected ${key}=${value}, got ${result[key]}`);
  }
  console.log(`PASS  ${name}`);
};

// Known-answer workbook: Revenue 1,000,000 -> 900,000;
// Inventory 300,000 -> 360,000; Cash 500,000 -> 425,000;
// Operating Expenses 200,000 -> 230,000.
const known = {
  revenueChange: pctChange(900000, 1000000),
  marginChange: 0,
  cashChange: pctChange(425000, 500000),
  inventoryChange: pctChange(360000, 300000),
  operatingExpenseChange: pctChange(230000, 200000),
};

assert(Math.abs(known.revenueChange + 10) < 0.0001, 'Known-answer revenue should be -10%.');
assert(Math.abs(known.cashChange + 15) < 0.0001, 'Known-answer cash should be -15%.');
assert(Math.abs(known.inventoryChange - 20) < 0.0001, 'Known-answer inventory should be +20%.');
assert(Math.abs(known.operatingExpenseChange - 15) < 0.0001, 'Known-answer OpEx should be +15%.');

run('Known-answer working-capital pressure', known, {
  inventory: true,
  margin: false,
  cash: true,
  opex: true,
});

run('Healthy growth should not create exceptions', {
  revenueChange: 10,
  marginChange: 2,
  cashChange: 12,
  inventoryChange: 8,
  operatingExpenseChange: 7,
}, {
  inventory: false,
  margin: false,
  cash: false,
  opex: false,
});

run('Margin compression', {
  revenueChange: 8,
  marginChange: -5,
  cashChange: 2,
  inventoryChange: 4,
  operatingExpenseChange: 5,
}, {
  inventory: false,
  margin: true,
  cash: false,
  opex: false,
});

run('Inventory pressure', {
  revenueChange: -6.7,
  marginChange: 0.2,
  cashChange: -9,
  inventoryChange: 14.7,
  operatingExpenseChange: 1,
}, {
  inventory: true,
  margin: false,
  cash: true,
  opex: false,
});

run('Expense pressure', {
  revenueChange: 2,
  marginChange: -1.5,
  cashChange: -1,
  inventoryChange: 1,
  operatingExpenseChange: 10,
}, {
  inventory: false,
  margin: true,
  cash: false,
  opex: true,
});

run('Multiple simultaneous pressures', {
  revenueChange: -4,
  marginChange: -3.5,
  cashChange: -12,
  inventoryChange: 9,
  operatingExpenseChange: 9,
}, {
  inventory: true,
  margin: true,
  cash: true,
  opex: true,
});

run('Threshold boundary: inventory exactly 3 points above revenue', {
  revenueChange: 5,
  marginChange: 0,
  cashChange: 0,
  inventoryChange: 8,
  operatingExpenseChange: 0,
}, {
  inventory: false,
  margin: false,
  cash: false,
  opex: false,
});

run('Threshold boundary: cash exactly -5%', {
  revenueChange: 0,
  marginChange: 0,
  cashChange: -5,
  inventoryChange: 0,
  operatingExpenseChange: 0,
}, {
  inventory: false,
  margin: false,
  cash: false,
  opex: false,
});

run('Threshold boundary: margin exactly -1 point', {
  revenueChange: 0,
  marginChange: -1,
  cashChange: 0,
  inventoryChange: 0,
  operatingExpenseChange: 0,
}, {
  inventory: false,
  margin: false,
  cash: false,
  opex: false,
});

// Missing/zero prior values must not produce Infinity or a false percentage.
assert(pctChange(100, 0) === null, 'A zero prior value must produce an unknown change, not Infinity.');
assert(pctChange(Number.NaN, 100) === null, 'Non-finite values must produce an unknown change.');

console.log('PASS  Missing/zero-prior safeguards');
console.log('\nAll deterministic financial-engine regression scenarios passed.');
