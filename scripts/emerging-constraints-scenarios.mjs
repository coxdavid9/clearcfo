const { detectCashSqueeze } = await import("../src/lib/briefing/emerging-constraints.ts");

function aging(rows) {
  return {
    reportData: {
      rows: rows.map(([customer, overdue]) => ({
        cells: [
          { name: "Customer", value: customer },
          { name: "31-60", value: String(overdue) },
          { name: "61-90", value: "0" },
          { name: "91+", value: "0" },
        ],
      })),
    },
  };
}

function payrollReport(values) {
  return {
    Columns: { Column: [{ ColTitle: "" }, { ColTitle: "Jul 2026" }, { ColTitle: "Aug 2026" }, { ColTitle: "Sep 2026" }] },
    Rows: {
      Row: [
        { type: "Data", ColData: [{ value: "Payroll Wages" }, ...values.map((value) => ({ value: String(value) }))] },
      ],
    },
  };
}

function cashFlow(financing = 0) {
  return {
    Columns: { Column: [{ ColTitle: "" }, { ColTitle: "Sep 2026" }] },
    Rows: {
      Row: [
        {
          group: "FinancingActivities",
          type: "Section",
          Summary: { ColData: [{ value: "Net cash provided by financing activities" }, { value: String(financing) }] },
        },
      ],
    },
  };
}

const base = {
  periods: ["Jul 2026", "Aug 2026", "Sep 2026"],
  revenue: [100000, 95000, 85000],
  cash: [50000, 50000, 50000],
  profitAndLossDetail: payrollReport([10000, 10600, 11200]),
  agedReceivables: aging([["A", 3000], ["B", 3000], ["C", 3000]]),
  agedReceivablesPrevious: aging([["A", 2000], ["B", 2000], ["C", 2000]]),
  cashFlowStatement: cashFlow(0),
  now: "2026-09-25T12:00:00.000Z",
};

let failed = 0;

const high = detectCashSqueeze(base);
if (!high || high.status !== "emerging" || high.confidence !== "High" || high.dataCompleteness !== "complete") {
  failed++;
  console.error("FAIL: complete cash squeeze should be High/emerging/complete", high);
} else {
  console.log("PASS: complete cash squeeze -> High / emerging / complete");
}

const worsening = detectCashSqueeze({
  ...base,
  revenue: [100000, 90000, 70000],
  agedReceivablesPrevious: aging([["A", 2000], ["B", 2000], ["C", 2000]]),
  agedReceivables: aging([["A", 5000], ["B", 5000], ["C", 5000]]),
  previousConstraint: high,
});
if (!worsening || worsening.status !== "worsening") {
  failed++;
  console.error("FAIL: stronger pattern should become worsening", worsening);
} else {
  console.log("PASS: stronger pattern -> worsening");
}

const medium = detectCashSqueeze({
  ...base,
  cashFlowStatement: undefined,
});
if (!medium || medium.confidence !== "Medium" || medium.dataCompleteness !== "partial") {
  failed++;
  console.error("FAIL: missing financing check should produce Medium/partial", medium);
} else {
  console.log("PASS: incomplete validation -> Medium / partial");
}

const resolved = detectCashSqueeze({
  ...base,
  revenue: [100000, 99000, 98000],
  previousConstraint: high,
});
if (!resolved || resolved.status !== "resolved") {
  failed++;
  console.error("FAIL: threshold exit should resolve prior constraint", resolved);
} else {
  console.log("PASS: threshold exit -> resolved");
}

const concentrated = detectCashSqueeze({
  ...base,
  agedReceivablesPrevious: aging([["A", 2000], ["B", 1000], ["C", 1000]]),
  agedReceivables: aging([["A", 8000], ["B", 1100], ["C", 1100]]),
});
if (concentrated) {
  failed++;
  console.error("FAIL: concentrated A/R deterioration should not fire", concentrated);
} else {
  console.log("PASS: concentrated A/R deterioration rejected");
}

if (failed) process.exit(1);
console.log("\\n5/5 emerging-constraint scenarios passed.");
